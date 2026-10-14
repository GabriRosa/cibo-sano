import {escapeHTML as e} from './lib.mjs';
import {DIARY_KEY, MEALS, DiaryStore, withDiaryLock, localDate, decimal, sumEntries} from './diary.mjs';
import {TARGET_KEYS, validInsightDate, targetsForDay, setTargets, setDayComplete, weeklySummary} from './targets.mjs';

const labels = {kcal: 'Calorie', protein: 'Proteine', carbs: 'Carboidrati', fat: 'Grassi'};
const fmt = (number, digits = 1) => new Intl.NumberFormat('it-IT', {maximumFractionDigits: digits}).format(number);
const shortDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', {day: 'numeric', month: 'short'});
const fullDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', {day: 'numeric', month: 'long', year: 'numeric'});
const unit = key => key === 'kcal' ? 'kcal' : 'g';
const metric = (number, key) => `${fmt(number, key === 'kcal' ? 0 : 1)} ${unit(key)}`;

function remainder(total, target, key) {
  if (target === null) return key === 'kcal' ? 'Imposta un obiettivo per vedere quanto manca.' : '';
  const difference = target - total;
  if (Math.abs(difference) < 0.05) return `Obiettivo di ${metric(target, key)} raggiunto`;
  return difference > 0 ? `${metric(difference, key)} rimanenti su ${metric(target, key)}` : `${metric(-difference, key)} oltre ${metric(target, key)}`;
}

export function dailyNutritionHTML(data, date) {
  const entries = data.entries.filter(entry => entry.date === date), totals = sumEntries(entries), targets = targetsForDay(data, date);
  return `<div class="daily-calories"><div><span class="eyebrow">ENERGIA REGISTRATA</span><p><strong>${fmt(totals.kcal, 0)}</strong> kcal</p><span>${e(remainder(totals.kcal, targets.kcal, 'kcal'))}</span></div><div class="daily-count">${entries.length}<span>${entries.length === 1 ? 'voce' : 'voci'}</span></div></div>
    ${targets.kcal === null ? '' : `<progress value="${Math.min(totals.kcal, targets.kcal)}" max="${targets.kcal}" aria-label="Calorie registrate rispetto all’obiettivo"></progress>`}
    <div class="daily-macros">${TARGET_KEYS.slice(1).map(key => `<div><span>${labels[key]}</span><strong>${fmt(totals[key])}<small> g</small></strong>${targets[key] === null ? '' : `<span class="daily-target-remainder">${e(remainder(totals[key], targets[key], key))}</span>`}</div>`).join('')}</div>
    ${targets.date ? `<p class="daily-target-date">Obiettivi validi dal ${e(fullDate(targets.date))}.</p>` : ''}`;
}

function totalsHTML(totals) {
  return TARGET_KEYS.map(key => `<div><span>${labels[key]}</span><strong>${fmt(totals[key], key === 'kcal' ? 0 : 1)}<small> ${unit(key)}</small></strong></div>`).join('');
}

function weeklyHTML(summary, selectedDate) {
  const statusLabels = {complete: 'Completa', partial: 'Parziale', unregistered: 'Non registrata'};
  return `<p class="insights-help">Le medie includono solo le giornate segnate come complete. I giorni parziali e non registrati non vengono conteggiati come zero.</p>
    <div class="weekly-average"><h3>Media delle giornate complete <span>(${summary.completeCount} su 7)</span></h3>${summary.averages ? `<div class="weekly-metrics">${totalsHTML(summary.averages)}</div>` : '<p class="insights-help">Segna almeno una giornata come completa per calcolare le medie.</p>'}</div>
    <div class="weekly-table-scroll"><table><caption class="insights-sr-only">Valori registrati dal ${e(fullDate(summary.start))} al ${e(fullDate(summary.end))}</caption><thead><tr><th scope="col">Giorno</th><th scope="col">Stato</th><th scope="col">kcal</th><th scope="col">P <span class="insights-sr-only">Proteine</span>(g)</th><th scope="col">C <span class="insights-sr-only">Carboidrati</span>(g)</th><th scope="col">G <span class="insights-sr-only">Grassi</span>(g)</th></tr></thead><tbody>${summary.days.map(day => `<tr${day.date === selectedDate ? ' class="weekly-selected-day"' : ''}><th scope="row"><time datetime="${day.date}">${e(new Date(`${day.date}T12:00:00`).toLocaleDateString('it-IT', {weekday: 'short', day: 'numeric'}))}</time>${day.date === selectedDate ? '<span class="insights-sr-only">, giorno selezionato</span>' : ''}</th><td><span class="day-status day-status-${day.status}">${statusLabels[day.status]}</span></td>${TARGET_KEYS.map(key => `<td>${day.status === 'unregistered' ? '<span aria-label="Nessun dato">—</span>' : fmt(day.totals[key], key === 'kcal' ? 0 : 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="weekly-total"><h3>Totale registrato nella settimana</h3><p class="insights-help">Include anche le giornate parziali.</p><div class="weekly-metrics">${totalsHTML(summary.totals)}</div></div>
    <div class="weekly-distribution"><h3>Distribuzione delle calorie per pasto</h3><p class="insights-help">Calcolata su tutti i pasti registrati nella settimana.</p><ul>${Object.entries(MEALS).map(([key, label]) => {
      const meal = summary.mealDistribution[key], percentage = meal.share === null ? null : meal.share * 100;
      return `<li><div><span>${label}</span><strong>${metric(meal.totals.kcal, 'kcal')}${percentage === null ? '' : ` <small>· ${fmt(percentage, 0)}%</small>`}</strong></div><div class="meal-share-track" aria-hidden="true"><span style="width:${percentage === null ? 0 : Math.max(0, Math.min(100, percentage))}%"></span></div></li>`;
    }).join('')}</ul></div>`;
}

export function initInsights({toast, storage, getDay = localDate}) {
  const meals = document.getElementById('diary-meals'), form = document.getElementById('diary-goal-form');
  if (!meals || !form) return {render() {}};
  if (storage === undefined) { try { storage = window.localStorage; } catch {} }
  const store = new DiaryStore(storage);
  let data = null, selectedDate = validInsightDate(getDay()) ? getDay() : localDate();
  let formDate = selectedDate, baseline = null, dirty = false, busy = false, readable = false;

  const panel = document.createElement('div');
  panel.className = 'diary-insights';
  panel.innerHTML = `<section class="day-completion" aria-label="Stato della giornata"><label><input type="checkbox" id="insights-complete" aria-describedby="insights-complete-help"><span>Giornata completa</span></label><p id="insights-complete-help" class="insights-help"></p><p id="insights-complete-error" class="form-error" role="alert" hidden></p></section><details class="weekly-summary"><summary><span><span class="weekly-kicker">LA TUA SETTIMANA</span><strong id="insights-week-label"></strong></span><span id="insights-week-count" class="weekly-count"></span></summary><div id="insights-week-body" class="weekly-body"></div></details>`;
  meals.before(panel);
  form.innerHTML = `<label class="field insights-effective-date"><span>Validi dal</span><input type="date" id="insights-target-date" min="1900-01-01" max="2200-12-31" required></label><div class="insights-target-grid">${TARGET_KEYS.map(key => `<label class="field"><span>${labels[key]} (${unit(key)})</span><input id="insights-target-${key}" inputmode="decimal" autocomplete="off" placeholder="Facoltativo" aria-describedby="insights-target-help"></label>`).join('')}</div><p id="insights-target-help" class="insights-help">I valori restano validi fino al prossimo cambio. Un campo vuoto non ha un obiettivo; tutti i campi vuoti disattivano gli obiettivi dalla data scelta.</p><p id="insights-target-context" class="insights-help"></p><p id="insights-target-error" class="form-error" role="alert" hidden></p><div class="insights-target-actions"><button type="submit" class="secondary-button" id="insights-target-save">Salva obiettivi</button><button type="button" class="text-button" id="insights-target-reload" hidden>Ricarica valori</button></div><div id="insights-target-history"></div>`;
  const $ = id => document.getElementById(id);

  function error(message, area = 'target') {
    const target = $(`insights-${area}-error`);target.textContent = message;target.hidden = !message;
  }
  function loadForm(date) {
    formDate = date; baseline = targetsForDay(data, date); dirty = false;
    $('insights-target-date').value = date;
    for (const key of TARGET_KEYS) $(`insights-target-${key}`).value = baseline[key] === null ? '' : String(baseline[key]);
    error('');
  }
  function formChangedElsewhere() {
    return readable && baseline && JSON.stringify(targetsForDay(data, formDate)) !== JSON.stringify(baseline);
  }
  function formState() {
    const changed = formChangedElsewhere();
    form.querySelectorAll('input').forEach(input => input.disabled = busy || !readable);
    $('insights-target-save').disabled = busy || !readable || changed;
    $('insights-target-save').textContent = busy ? 'Salvataggio…' : 'Salva obiettivi';
    $('insights-target-reload').hidden = !changed;
    $('insights-target-reload').disabled = busy || !readable;
    $('insights-target-context').textContent = !readable ? 'Gli obiettivi non sono disponibili finché il diario non può essere letto.' : changed ? 'I valori salvati sono cambiati in un’altra finestra. Ricaricali prima di modificare gli obiettivi.' : baseline?.date ? `Per questa data sono in uso gli obiettivi del ${fullDate(baseline.date)}.` : baseline?.kcal !== null ? 'È in uso l’obiettivo calorie salvato in precedenza.' : 'Per questa data non sono impostati obiettivi.';
    panel.querySelectorAll('input').forEach(input => input.disabled = busy || !readable || selectedDate > localDate());
  }
  function render(dateOverride) {
    const candidate = typeof dateOverride === 'string' ? dateOverride : getDay();
    const nextDate = validInsightDate(candidate) ? candidate : selectedDate, dayChanged = nextDate !== selectedDate;
    selectedDate = nextDate;
    try { data = store.read(); readable = true; }
    catch { readable = false; panel.hidden = true; formState(); return; }
    panel.hidden = false;
    if (!baseline || (dayChanged && !dirty)) loadForm(selectedDate);
    else if (!dirty && !form.contains(document.activeElement)) loadForm(formDate);
    const isComplete = (data.completeDays || []).includes(selectedDate);
    $('insights-complete').checked = isComplete;
    $('insights-complete-help').textContent = selectedDate > localDate() ? 'Potrai completare questa giornata dalla data selezionata.' : isComplete ? 'Questa giornata entra nelle medie settimanali. Puoi continuare a correggere le voci.' : 'Spunta quando hai registrato tutto: solo le giornate complete entrano nelle medie.';
    const summary = weeklySummary(data, selectedDate);
    $('insights-week-label').textContent = `${shortDate(summary.start)} – ${fullDate(summary.end)}`;
    $('insights-week-count').textContent = `${summary.completeCount}/7 complete`;
    $('insights-week-body').innerHTML = weeklyHTML(summary, selectedDate);
    const history = [...(data.targets || [])].sort((a, b) => b.date.localeCompare(a.date));
    $('insights-target-history').innerHTML = history.length ? `<details class="insights-target-history"><summary>Storico obiettivi (${history.length})</summary><ul>${history.slice(0, 12).map(target => `<li><button type="button" class="text-button" data-target-date="${target.date}">${e(fullDate(target.date))}</button><span>${TARGET_KEYS.every(key => target[key] === null) ? 'Obiettivi disattivati' : TARGET_KEYS.filter(key => target[key] !== null).map(key => `${key === 'kcal' ? '' : `${labels[key]} `}${metric(target[key], key)}`).join(' · ')}</span></li>`).join('')}</ul>${history.length > 12 ? '<p class="insights-help">Sono mostrati gli ultimi 12 cambi. Scegli una data precedente nel campo “Validi dal” per consultare o modificare i valori più vecchi.</p>' : ''}</details>` : '';
    formState();
  }

  $('insights-target-date').addEventListener('change', () => {
    const date = $('insights-target-date').value;
    if (!validInsightDate(date)) { dirty = true; return; }
    try { data = store.read(); readable = true; loadForm(date); formState(); }
    catch (err) { error(err.message); }
  });
  form.addEventListener('input', event => { if (event.target.id !== 'insights-target-date') { dirty = true; error(''); } });
  $('insights-target-reload').addEventListener('click', () => {
    try { data = store.read(); readable = true; loadForm(formDate); formState(); }
    catch (err) { error(err.message); }
  });
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-target-date]');
    if (!button || busy) return;
    try { data = store.read(); readable = true; loadForm(button.dataset.targetDate); formState(); $('insights-target-date').focus(); }
    catch (err) { error(err.message); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const date = $('insights-target-date').value, target = {date};
    if (!validInsightDate(date)) { error('Scegli una data valida.'); $('insights-target-date').focus(); return; }
    for (const key of TARGET_KEYS) {
      const input = $(`insights-target-${key}`), raw = input.value.trim();
      target[key] = raw === '' ? null : decimal(raw, key === 'kcal' ? 10000 : 1000);
      if (raw !== '' && (target[key] === null || (key === 'kcal' && target[key] <= 0))) {
        error(key === 'kcal' ? 'Inserisci calorie maggiori di zero e fino a 10.000, oppure lascia il campo vuoto.' : `Inserisci ${labels[key].toLowerCase()} da 0 a 1.000 g, oppure lascia il campo vuoto.`);
        input.focus(); return;
      }
    }
    if (date !== formDate) { error('Conferma la data scelta e controlla i valori prima di salvarli.'); $('insights-target-date').focus(); return; }
    busy = true; error(''); formState();
    try {
      await withDiaryLock(() => store.update(current => setTargets(current, target, {expectedTargets: baseline})));
      data = store.read(); loadForm(date); toast(`Obiettivi salvati dal ${fullDate(date)}.`);
    } catch (err) { error(err.message); }
    finally { busy = false; render(); }
  });
  $('insights-complete').addEventListener('change', async event => {
    if (busy) return;
    const date = selectedDate, complete = event.target.checked;
    busy = true; error('', 'complete'); formState();
    try {
      await withDiaryLock(() => store.update(current => setDayComplete(current, date, complete)));
      toast(complete ? 'Giornata segnata come completa.' : 'Giornata da completare.');
    } catch (err) { error(err.message, 'complete'); }
    finally { busy = false; render(); }
  });
  window.addEventListener('storage', event => { if (event.key === DIARY_KEY || event.key === null) render(); });
  window.addEventListener('cibo-sano:diary-change', () => render());
  window.addEventListener('cibo-sano:day-change', event => render(typeof event.detail === 'string' ? event.detail : event.detail?.date));
  render();
  return {render};
}
