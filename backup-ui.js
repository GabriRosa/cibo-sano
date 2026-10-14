import {DiaryStore,withDiaryLock,localDate,parseBackup} from './diary.mjs';
import {escapeHTML as e} from './lib.mjs';

export const LAST_EXPORT_KEY='cibo-sano:last-full-export';
const counts=data=>[
  ['Voci del diario',data.entries.length],['Prodotti personali',data.foods.length],['Pesate',(data.weights||[]).length],['Obiettivo calorico precedente (kcal)',data.goal||0],
  ['Versioni delle ricette',(data.personalRecipes||[]).length],['Preferiti',(data.favorites||[]).length],
  ['Obiettivi con data',(data.targets||[]).length],['Giorni completati',(data.completeDays||[]).length],
  ['Pasti pianificati',(data.plans||[]).length],['Voci della dispensa',(data.pantry||[]).length],['Spunte della spesa',(data.shoppingChecks||[]).length]
];
export function initBackup({toast,storage=globalThis.localStorage}) {
  const store=new DiaryStore(storage),$=id=>document.getElementById(id);
  const status=document.createElement('p');status.id='backup-last-export';status.className='small-note backup-status';
  $('diary-export').closest('.backup-actions').after(status);
  function render(){
    try{const value=storage.getItem(LAST_EXPORT_KEY),date=value&&new Date(value),valid=date&&!Number.isNaN(date.valueOf());
      const old=!valid||Date.now()-date.valueOf()>7*86400000;
      status.textContent=valid?`Ultima esportazione completa: ${date.toLocaleString('it-IT')}.${old?' È il momento di salvarne una nuova.':''}`:'Nessun backup completo esportato su questo dispositivo.';
      status.classList.toggle('backup-reminder',old);
    }catch{status.textContent='Esporta regolarmente una copia completa dei tuoi dati.';}
  }
  $('diary-export').addEventListener('click',()=>{
    let url;
    try{
      const raw=store.export();url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`cibo-sano-completo-${localDate()}.json`;link.click();
      try{storage.setItem(LAST_EXPORT_KEY,new Date().toISOString());}catch{}
      render();toast('Backup completo preparato. Controlla i download e conservalo privatamente.');
    }catch(error){toast(error.message);}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
  const dialog=document.createElement('dialog');dialog.id='backup-preview-dialog';dialog.setAttribute('aria-labelledby','backup-preview-title');document.body.append(dialog);
  $('diary-import').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>15000000)throw new Error('Backup troppo grande.');
      const raw=await file.text(),incoming=parseBackup(raw);store.read();
      dialog.innerHTML=`<div class="dialog-toolbar"><h2 id="backup-preview-title">Importa il backup</h2><button type="button" class="text-button" data-backup-close>Chiudi ✕</button></div><div class="diary-dialog-body"><p><strong>${e(file.name)}</strong></p><p>Il file contiene:</p><ul>${counts(incoming).filter(([,count])=>count>0).map(([label,count])=>`<li>${e(label)}: <b>${count}</b></li>`).join('')||'<li>Nessuna registrazione.</li>'}</ul><p>L’importazione aggiunge le voci mancanti. Per elementi con lo stesso identificativo o la stessa data conserva la versione di questo dispositivo. I preferiti vengono uniti. Non elimina i dati già presenti.</p><p id="backup-import-error" role="alert" class="form-error" hidden></p><button type="button" id="backup-confirm" class="primary-button">Unisci ai dati del dispositivo</button></div>`;
      dialog.showModal();
      $('backup-confirm').addEventListener('click',async()=>{
        const button=$('backup-confirm');button.disabled=true;
        try{await withDiaryLock(()=>store.import(raw));dialog.close();toast('Backup importato. Le versioni già presenti sono state conservate.');}
        catch(error){$('backup-import-error').hidden=false;$('backup-import-error').textContent=error.message;button.disabled=false;}
      });
    }catch(error){toast(error.message);}finally{event.target.value='';}
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-backup-close]'))dialog.close();});
  addEventListener('storage',event=>{if(event.key===LAST_EXPORT_KEY||event.key===null)render();});
  render();return {render};
}
