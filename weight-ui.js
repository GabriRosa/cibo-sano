import {escapeHTML as e} from './lib.mjs';
import {DiaryStore,DIARY_KEY,withDiaryLock,localDate,validDate,decimal} from './diary.mjs';
import {buildWeightChart,weightChartSVG,summarizeWeights,formatWeight,formatWeightChange,formatWeightDate} from './weight.mjs';

const PAGE_SIZE=20;
const PERIODS={1:'1 mese',3:'3 mesi',6:'6 mesi',12:'1 anno'};

export function initWeight({toast=()=>{}}={}) {
  const section=document.getElementById('weight-page');
  if(!section)return {render(){}};
  let storage;
  try{storage=window.localStorage;}catch{}
  const store=new DiaryStore(storage);
  let diary=null,readable=false,months=3,historyPage=1,busy=false,dirty=false;
  let selectedDate=localDate(),baseline=null,undoRecord=null,chartWidth=0;
  let historyRecords=new Map(),seenToday=localDate();
  section.innerHTML=`
    <div class="diary-heading weight-heading"><div><span class="eyebrow"><span></span> UNA MISURAZIONE ALLA VOLTA</span><h1 id="weight-heading">Il tuo <em>peso.</em></h1><p>Registra le pesate e osserva come cambiano nel tempo.</p></div><span class="local-badge">Salvato su questo browser</span></div>
    <div class="notice" id="weight-storage-error" role="alert" hidden><p id="weight-storage-message"></p><button type="button" class="secondary-button" id="weight-retry">Riprova</button></div>
    <div id="weight-content">
      <div class="weight-top-grid">
        <section class="weight-card weight-entry-card" aria-labelledby="weight-form-title"><h2 id="weight-form-title">Registra il peso</h2>
          <form id="weight-form" novalidate>
            <div class="weight-input-grid"><label class="field"><span>Data</span><input id="weight-date" type="date" min="1900-01-01" required aria-describedby="weight-date-help"></label><label class="field"><span>Peso (kg)</span><input id="weight-value" type="text" inputmode="decimal" autocomplete="off" placeholder="Es. 72,5" required aria-describedby="weight-value-help" maxlength="10"></label></div>
            <p class="weight-help" id="weight-date-help">Una pesata per giorno, fino a oggi.</p><p class="weight-help" id="weight-value-help">Da 1 a 500 kg, con al massimo due decimali. Puoi usare la virgola.</p>
            <p id="weight-form-context" class="weight-form-context" role="status"></p><p id="weight-form-error" class="form-error" role="alert" hidden></p>
            <div class="weight-form-actions"><button type="submit" class="primary-button" id="weight-save">Salva peso</button><button type="button" class="text-button" id="weight-reset" hidden>Annulla modifiche</button><button type="button" class="secondary-button" id="weight-reload" hidden>Ricarica dato salvato</button></div>
          </form>
        </section>
        <section class="weight-card weight-summary" aria-label="Riepilogo del peso"><div><span class="weight-kicker">ULTIMA MISURAZIONE</span><p class="weight-latest"><strong id="weight-latest-value">—</strong><span id="weight-latest-unit" hidden> kg</span></p><p id="weight-latest-date" class="weight-summary-note">Non hai ancora registrato il peso.</p></div><div class="weight-change-box"><span class="weight-kicker">VARIAZIONE NEL PERIODO</span><strong id="weight-change">—</strong><p id="weight-change-note" class="weight-summary-note"></p></div></section>
      </div>
      <section class="weight-card weight-chart-card" aria-labelledby="weight-chart-heading">
        <div class="weight-section-heading"><div><h2 id="weight-chart-heading">Andamento</h2><p id="weight-chart-range" class="weight-summary-note"></p></div><div class="weight-periods" role="group" aria-label="Periodo del grafico">${Object.entries(PERIODS).map(([value,label])=>`<button type="button" data-weight-months="${value}" aria-pressed="${Number(value)===months}">${label}</button>`).join('')}</div></div>
        <p id="weight-chart-status" class="weight-chart-status" role="status"></p><div id="weight-chart-frame" class="weight-chart-frame"></div><p id="weight-chart-scale" class="weight-help"></p>
        <p id="weight-chart-explanation" class="weight-help">Ogni punto è una pesata. La linea collega le misurazioni; i giorni senza dati restano senza valori registrati.</p>
        <details class="weight-chart-data" id="weight-chart-data"><summary id="weight-chart-data-label">Dati del grafico</summary><div id="weight-chart-table" class="weight-table-scroll"></div></details>
      </section>
      <div class="undo-notice weight-undo" id="weight-undo" role="status" hidden><span id="weight-undo-label"></span><button type="button" class="text-button" id="weight-undo-button">Annulla rimozione</button></div>
      <section class="weight-card weight-history-card" aria-labelledby="weight-history-heading"><div class="weight-section-heading"><h2 id="weight-history-heading" tabindex="-1">Storico</h2><span id="weight-history-count" class="weight-help"></span></div><p id="weight-action-error" class="form-error" role="alert" hidden></p><div id="weight-history"></div><div class="weight-pagination" id="weight-pagination" hidden><button type="button" class="secondary-button" id="weight-history-prev">← Precedenti</button><span id="weight-history-page"></span><button type="button" class="secondary-button" id="weight-history-next">Successive →</button></div></section>
      <p class="weight-backup-note">Le pesate restano in questo browser e sono incluse nel backup. Per conservarne una copia o trasferirle, apri <a href="#diario">Diario</a> → “Obiettivi e backup completo”.</p>
    </div>`;
  const $=id=>section.querySelector('#'+id);
  $('weight-date').value=selectedDate;

  function error(message,area='form') {
    const target=$(`weight-${area}-error`);target.textContent=message;target.hidden=!message;
  }
  function read() {
    try {
      diary=store.read();readable=true;$('weight-storage-error').hidden=true;$('weight-content').hidden=false;return true;
    } catch(err) {
      readable=false;$('weight-storage-message').textContent=err.message;$('weight-storage-error').hidden=false;$('weight-content').hidden=true;return false;
    }
  }
  function records(){return diary?.weights||[];}
  function recordFor(date){return records().find(record=>record.date===date)||null;}
  function stale() {
    if(!readable || $('weight-date').value!==selectedDate)return false;
    return (recordFor(selectedDate)?.updatedAt??null)!==(baseline?.updatedAt??null);
  }
  function updateFormState() {
    const changed=stale();
    $('weight-date').max=localDate();
    $('weight-date').disabled=busy;$('weight-value').disabled=busy;
    $('weight-save').disabled=busy||!readable||changed;
    $('weight-save').textContent=busy?'Salvataggio…':baseline?'Aggiorna peso':'Salva peso';
    $('weight-reset').hidden=!dirty;$('weight-reset').disabled=busy;
    $('weight-reload').hidden=!changed;$('weight-reload').disabled=busy;
    $('weight-form-context').textContent=changed?'La pesata di questa data è cambiata in un’altra finestra. Ricarica il dato salvato prima di modificarlo.':baseline?`Per il ${formatWeightDate(selectedDate)} hai registrato ${formatWeight(baseline.kg)} kg. Puoi aggiornare questa pesata.`:'';
    section.querySelectorAll('[data-weight-edit],[data-weight-delete]').forEach(button=>button.disabled=busy);
    $('weight-undo-button').disabled=busy;
  }
  function selectDate(date,{focus=false}={}) {
    selectedDate=date;baseline=recordFor(date);baseline=baseline?{...baseline}:null;dirty=false;
    $('weight-date').value=date;$('weight-value').value=baseline?formatWeight(baseline.kg):'';
    error('');updateFormState();
    if(focus)$('weight-value').focus();
  }
  function renderChart() {
    if(!readable)return;
    const frame=$('weight-chart-frame'),width=Math.round(frame.clientWidth)||chartWidth||640;
    chartWidth=width;
    const chart=buildWeightChart(records(),{today:localDate(),months,width,height:width<500?260:290});
    const latest=summarizeWeights(records()).last,summary=chart.summary;
    $('weight-latest-value').textContent=latest?formatWeight(latest.kg):'—';$('weight-latest-unit').hidden=!latest;
    $('weight-latest-date').textContent=latest?formatWeightDate(latest.date):'Non hai ancora registrato il peso.';
    $('weight-change').textContent=formatWeightChange(summary.change);
    $('weight-change-note').textContent=summary.count>1?`Dalla prima all’ultima pesata nel periodo: ${formatWeightDate(summary.first.date)} → ${formatWeightDate(summary.last.date)}.`:summary.count===1?'Serve una seconda pesata nel periodo per calcolare la variazione.':'Nessuna misurazione nel periodo selezionato.';
    $('weight-chart-range').textContent=`${formatWeightDate(chart.window.start)} – ${formatWeightDate(chart.window.end)}`;
    $('weight-chart-status').textContent=!summary.count?'Nessuna pesata in questo periodo. Scegli un altro intervallo o registra una misurazione.':summary.count===1?'Una sola pesata nel periodo: è mostrato il punto nella sua data.':`${summary.count} pesate nel periodo selezionato.`;
    $('weight-chart-status').classList.toggle('weight-chart-empty',!summary.count);
    frame.innerHTML=weightChartSVG(chart);frame.hidden=!summary.count;
    $('weight-chart-scale').hidden=!summary.count;
    $('weight-chart-scale').textContent=summary.count?`Scala verticale: ${formatWeight(chart.yMin)}–${formatWeight(chart.yMax)} kg${chart.yMin>0?'; l’asse non parte da zero.':'.'}`:'';
    $('weight-chart-explanation').hidden=summary.count<2;
    $('weight-chart-data').hidden=!summary.count;
    $('weight-chart-data-label').textContent=`Dati del grafico (${summary.count})`;
    $('weight-chart-table').innerHTML=summary.count?`<table><caption class="weight-sr-only">Misurazioni nel periodo selezionato</caption><thead><tr><th scope="col">Data</th><th scope="col">Peso (kg)</th></tr></thead><tbody>${chart.points.map(record=>`<tr><th scope="row"><time datetime="${e(record.date)}">${e(formatWeightDate(record.date))}</time></th><td>${e(formatWeight(record.kg))}</td></tr>`).join('')}</tbody></table>`:'';
    section.querySelectorAll('[data-weight-months]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.weightMonths)===months)));
  }
  function renderHistory() {
    const all=records().slice().sort((a,b)=>b.date.localeCompare(a.date));
    const pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE));historyPage=Math.min(historyPage,pages);
    const current=all.slice((historyPage-1)*PAGE_SIZE,historyPage*PAGE_SIZE);
    historyRecords=new Map(current.map(record=>[record.date,{...record}]));
    $('weight-history-count').textContent=`${all.length} ${all.length===1?'pesata':'pesate'}`;
    $('weight-history').innerHTML=all.length?`<ul class="weight-history-list">${current.map(record=>`<li><div><time datetime="${e(record.date)}">${e(formatWeightDate(record.date))}</time><strong>${e(formatWeight(record.kg))}<small> kg</small></strong></div><div class="weight-history-actions"><button type="button" class="text-button" data-weight-edit="${e(record.date)}" aria-label="Modifica la pesata del ${e(formatWeightDate(record.date))}">Modifica</button><button type="button" class="text-button" data-weight-delete="${e(record.date)}" aria-label="Rimuovi la pesata del ${e(formatWeightDate(record.date))}">Rimuovi</button></div></li>`).join('')}</ul>`:'<p class="weight-history-empty">La prima pesata che registri comparirà qui.</p>';
    $('weight-pagination').hidden=pages<=1;
    $('weight-history-page').textContent=`${historyPage} / ${pages}`;
    $('weight-history-prev').disabled=historyPage===1;$('weight-history-next').disabled=historyPage===pages;
    updateFormState();
  }
  function render() {
    if(!read()){updateFormState();return;}
    if(!busy && !dirty && ![$('weight-date'),$('weight-value')].includes(document.activeElement))selectDate($('weight-date').value||localDate());
    renderChart();renderHistory();
  }
  function setBusy(value) {busy=value;updateFormState();}

  $('weight-form').addEventListener('input',()=>{dirty=true;error('');updateFormState();});
  $('weight-date').addEventListener('change',()=>{
    const date=$('weight-date').value;
    if(!validDate(date) || date>localDate()){dirty=true;updateFormState();return;}
    if(read())selectDate(date);
    renderChart();renderHistory();
  });
  $('weight-reset').addEventListener('click',()=>{if(read())selectDate($('weight-date').value||localDate(),{focus:true});renderChart();renderHistory();});
  $('weight-reload').addEventListener('click',()=>{if(read())selectDate($('weight-date').value||localDate(),{focus:true});renderChart();renderHistory();});
  $('weight-retry').addEventListener('click',render);
  $('weight-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const date=$('weight-date').value,raw=$('weight-value').value.trim(),kg=decimal(raw,500);
    if(!validDate(date) || date>localDate()){error('Scegli una data valida, non successiva a oggi.');$('weight-date').focus();return;}
    if(kg===null || kg<1 || !/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(raw)){error('Inserisci un peso da 1 a 500 kg, con al massimo due decimali.');$('weight-value').focus();return;}
    const expectedUpdatedAt=selectedDate===date?baseline?.updatedAt??null:null,wasUpdate=expectedUpdatedAt!==null;
    setBusy(true);error('');
    try {
      await withDiaryLock(()=>store.saveWeight(date,kg,{expectedUpdatedAt}));
      dirty=false;
      if(read())selectDate(date);
      toast(wasUpdate?'Peso aggiornato.':'Peso registrato.');
    } catch(err) {error(err.message);}
    finally {setBusy(false);render();}
  });
  section.addEventListener('click',async event=>{
    const period=event.target.closest('[data-weight-months]');
    if(period){months=Number(period.dataset.weightMonths);renderChart();return;}
    const edit=event.target.closest('[data-weight-edit]');
    if(edit && !busy){if(read()){selectDate(edit.dataset.weightEdit,{focus:true});$('weight-form-title').scrollIntoView({block:'nearest'});renderChart();renderHistory();}return;}
    const remove=event.target.closest('[data-weight-delete]');
    if(!remove || busy)return;
    const record=historyRecords.get(remove.dataset.weightDelete);if(!record)return;
    setBusy(true);error('','action');
    try {
      await withDiaryLock(()=>store.removeWeight(record.date,{expectedUpdatedAt:record.updatedAt}));
      undoRecord=record;$('weight-undo-label').textContent=`Rimossa la pesata del ${formatWeightDate(record.date)}.`;$('weight-undo').hidden=false;
      toast('Pesata rimossa. Puoi annullare la rimozione.');
    }catch(err){error(err.message,'action');}
    finally {setBusy(false);render();if(undoRecord===record)$('weight-undo-button').focus();}
  });
  $('weight-undo-button').addEventListener('click',async()=>{
    if(busy || !undoRecord)return;
    const record={...undoRecord};setBusy(true);error('','action');
    try {
      await withDiaryLock(()=>store.restoreWeight(record));undoRecord=null;$('weight-undo').hidden=true;
      toast('Pesata ripristinata.');
    }catch(err){error(err.message,'action');}
    finally {setBusy(false);render();if(!undoRecord)$('weight-history-heading').focus();}
  });
  $('weight-history-prev').addEventListener('click',()=>{historyPage--;renderHistory();});
  $('weight-history-next').addEventListener('click',()=>{historyPage++;renderHistory();});
  window.addEventListener('storage',event=>{if(event.key===DIARY_KEY || event.key===null)render();});
  window.addEventListener('cibo-sano:diary-change',render);
  function checkDay() {
    const today=localDate();
    if(today!==seenToday){
      if(!busy && !dirty && selectedDate===seenToday && ![$('weight-date'),$('weight-value')].includes(document.activeElement)){
        if(read())selectDate(today);
      }
      seenToday=today;render();
    }
  }
  setInterval(()=>{if(!document.hidden)checkDay();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkDay();render();}});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{
    const width=Math.round(entries[0]?.contentRect.width||0);if(width>0 && width!==chartWidth)renderChart();
  }).observe($('weight-chart-frame'));
  render();
  return {render};
}
