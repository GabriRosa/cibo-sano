import {escapeHTML as e} from './lib.mjs';
import {DiaryStore, DIARY_KEY, withDiaryLock, localDate} from './diary.mjs';
import {parseWaterAmount, createWaterEntry, waterDaySummary} from './water.mjs';

const fmt = value => new Intl.NumberFormat('it-IT', {maximumFractionDigits: 3}).format(value);
const amount = ml => ml >= 1000 ? `${fmt(ml / 1000)} L` : `${fmt(ml)} ml`;
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', {day: 'numeric', month: 'long'});

export function initWater({toast = () => {}, storage, getDay = localDate} = {}) {
  const totals = document.getElementById('diary-totals');
  if (!totals) return {render() {}};
  if (storage === undefined) { try { storage = window.localStorage; } catch {} }
  const store = new DiaryStore(storage), $ = id => document.getElementById(id);
  let data = null, day = getDay(), busy = false, readable = false, editing = null, removed = null;
  const panel = document.createElement('section');
  panel.className = 'water-card'; panel.id = 'water-card'; panel.setAttribute('aria-labelledby', 'water-title');
  panel.innerHTML = `<header class="water-heading"><h2 id="water-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/></svg>Acqua</h2><p>Registra quanto hai bevuto nel giorno selezionato.</p></header>
    <div class="water-card-grid"><div class="water-daily-total" aria-live="polite"><strong id="water-total">—</strong><p id="water-total-note"></p></div>
    <div class="water-controls"><div class="water-quick"><button type="button" class="secondary-button" data-water-add="250" aria-label="Aggiungi 250 ml di acqua">+ 250 ml</button><button type="button" class="secondary-button" data-water-add="500" aria-label="Aggiungi 500 ml di acqua">+ 500 ml</button></div>
    <form id="water-add-form" class="water-add-form"><label class="field"><span>Quantità d’acqua</span><input id="water-amount" inputmode="decimal" autocomplete="off" placeholder="Es. 300" required aria-describedby="water-amount-help"></label><label class="field"><span>Unità</span><select id="water-unit" aria-label="Unità dell’acqua"><option value="ml">ml</option><option value="L">L</option></select></label><button type="submit" class="primary-button">Registra acqua</button></form><p id="water-amount-help" class="water-help">Puoi usare anche litri, ad esempio 0,3 L.</p></div></div>
    <p id="water-error" class="form-error" role="alert" hidden></p><div id="water-undo" class="water-undo" role="status" hidden><span id="water-undo-label"></span><button type="button" class="text-button" id="water-undo-button">Annulla rimozione acqua</button></div>
    <details class="water-history" open><summary>Registrazioni del giorno <span id="water-count"></span></summary><div id="water-entries"></div></details>`;
  totals.after(panel);
  const dialog = document.createElement('dialog');
  dialog.id = 'water-dialog'; dialog.setAttribute('aria-labelledby', 'water-dialog-title'); document.body.append(dialog);

  function showError(message) {
    const target = dialog.open ? $('water-edit-error') : $('water-error');
    if (target) { target.textContent = message; target.hidden = !message; }
  }
  function disabledState() {
    for (const root of [panel, dialog]) root.querySelectorAll('button,input,select').forEach(element => element.disabled = busy || !readable);
  }
  function render() {
    const nextDay = getDay();
    if (nextDay !== day) { day = nextDay; $('water-amount').value = ''; }
    try { data = store.read(); readable = true; }
    catch (error) { readable = false; $('water-total').textContent = '—'; $('water-total-note').textContent = 'Acqua non disponibile finché il diario non può essere letto.'; disabledState(); return; }
    const summary = waterDaySummary(data, day);
    $('water-total').textContent = summary.recorded ? amount(summary.totalMl) : '—';
    $('water-total-note').textContent = summary.recorded ? `${fmt(summary.totalMl)} ml registrati il ${dateLabel(day)}.` : 'Nessuna acqua registrata per questo giorno.';
    $('water-count').textContent = `(${summary.entryCount})`;
    const entries = (data.waterEntries || []).filter(entry => entry.date === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    $('water-entries').innerHTML = entries.length ? `<ul>${entries.map((entry, index) => `<li><div><strong>${e(amount(entry.ml))}</strong><small>Registrazione ${index + 1}</small></div><div class="water-entry-actions"><button type="button" class="text-button" data-water-edit="${e(entry.id)}" aria-label="Modifica acqua: registrazione ${index + 1}">Modifica</button><button type="button" class="text-button" data-water-remove="${e(entry.id)}" aria-label="Rimuovi acqua: registrazione ${index + 1}">Rimuovi</button></div></li>`).join('')}</ul>` : '<p class="water-help">Le registrazioni compariranno qui.</p>';
    $('water-undo').hidden = !removed;
    if (removed) $('water-undo-label').textContent = `${amount(removed.ml)} del ${dateLabel(removed.date)} rimossi.`;
    disabledState();
  }
  async function mutate(operation, onSuccess, message) {
    if (busy || !readable) return;
    busy = true; showError(''); disabledState();
    try { await withDiaryLock(operation); onSuccess?.(); if (message) toast(message); }
    catch (error) { showError(error.message); }
    finally { busy = false; render(); }
  }
  function add(ml) {
    if (ml === null) { showError('Inserisci una quantità da 1 a 10.000 ml, oppure da 0,001 a 10 L. Usa millilitri interi.'); return; }
    let entry;
    try { entry = createWaterEntry({date: day, ml}); } catch (error) { showError(error.message); return; }
    mutate(() => store.addWater(entry), () => { $('water-amount').value = ''; }, `${amount(ml)} di acqua registrati.`);
  }
  function openEditor(entry) {
    editing = {...entry};
    dialog.innerHTML = `<div class="dialog-toolbar"><h2 id="water-dialog-title">Modifica acqua</h2><button type="button" class="text-button" data-water-close>Chiudi ✕</button></div><form id="water-edit-form" class="diary-dialog-body"><label class="field"><span>Giorno dell’acqua</span><input id="water-edit-date" type="date" min="1900-01-01" max="2200-12-31" value="${entry.date}" required></label><div class="form-grid"><label class="field"><span>Quantità d’acqua</span><input id="water-edit-amount" inputmode="decimal" value="${entry.ml}" required></label><label class="field"><span>Unità</span><select id="water-edit-unit" aria-label="Unità dell’acqua"><option value="ml">ml</option><option value="L">L</option></select></label></div><p class="water-help">Puoi correggere la quantità o spostare la registrazione a un altro giorno.</p><p id="water-edit-error" class="form-error" role="alert" hidden></p><div class="entry-actions"><button type="submit" class="primary-button">Salva acqua</button><button type="button" class="text-button danger-button" data-water-remove-edit>Rimuovi registrazione acqua</button></div></form>`;
    dialog.showModal(); disabledState();
  }
  function remove(entry) {
    mutate(() => store.removeWater(entry.id, {expectedUpdatedAt: entry.updatedAt}), () => {
      removed = {...entry}; if (dialog.open) dialog.close();
    });
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.waterAdd) { add(Number(button.dataset.waterAdd)); return; }
    const id = button.dataset.waterEdit || button.dataset.waterRemove;
    if (id) {
      const entry = data?.waterEntries?.find(item => item.id === id);
      if (!entry) { showError('Questa registrazione dell’acqua non è più disponibile.'); render(); return; }
      if (button.dataset.waterEdit) openEditor(entry); else remove(entry);
    }
  });
  $('water-add-form').addEventListener('submit', event => { event.preventDefault(); add(parseWaterAmount($('water-amount').value, $('water-unit').value)); });
  $('water-unit').addEventListener('change', () => { $('water-amount').placeholder = $('water-unit').value === 'L' ? 'Es. 0,3' : 'Es. 300'; });
  $('water-undo-button').addEventListener('click', () => {
    if (!removed) return;
    const entry = {...removed}; mutate(() => store.restoreWater(entry), () => { removed = null; }, 'Registrazione dell’acqua ripristinata.');
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-water-close]')) { if (!busy) dialog.close(); }
    if (event.target.closest('[data-water-remove-edit]') && editing) remove({...editing});
  });
  dialog.addEventListener('submit', event => {
    event.preventDefault(); if (!editing || busy) return;
    const ml = parseWaterAmount($('water-edit-amount').value, $('water-edit-unit').value);
    if (ml === null) { showError('Inserisci una quantità da 1 a 10.000 ml, in millilitri interi.'); return; }
    const entry = {...editing};
    mutate(() => store.editWater(entry.id, {date: $('water-edit-date').value, ml}, {expectedUpdatedAt: entry.updatedAt}), () => dialog.close(), 'Registrazione dell’acqua aggiornata.');
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { editing = null; });
  addEventListener('storage', event => { if (event.key === DIARY_KEY || event.key === null) render(); });
  addEventListener('cibo-sano:diary-change', render);
  addEventListener('cibo-sano:day-change', render);
  render();
  return {render};
}
