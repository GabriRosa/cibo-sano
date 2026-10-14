import {MEALS,NUTRIENTS,validDate,sumEntries,nutrientsFor} from './diary.mjs';
import {waterDaySummary,waterRangeSummary} from './water.mjs';

function mealDetails(entries) {
  return Object.entries(MEALS).map(([id,label])=>{
    const items=entries.filter(entry=>entry.meal===id);
    return {label,total:sumEntries(items),entries:items.map(entry=>({name:entry.name,quantity:entry.quantity,unit:entry.unit,total:nutrientsFor(entry)}))};
  });
}

export function dailyReport(diary,date) {
  if(!validDate(date))throw new Error('Scegli un giorno valido.');
  const entries=diary.entries.filter(entry=>entry.date===date);
  return {kind:'daily',period:date,total:sumEntries(entries),entryCount:entries.length,
    meals:mealDetails(entries),water:waterDaySummary(diary,date)};
}

export function monthlyReport(diary,month) {
  if(!/^\d{4}-\d{2}$/.test(month)||!validDate(`${month}-01`))throw new Error('Scegli un mese valido.');
  const [year,m]=month.split('-').map(Number),count=new Date(year,m,0,12).getDate();
  const water=waterRangeSummary(diary,`${month}-01`,`${month}-${String(count).padStart(2,'0')}`);
  const buckets=new Map();
  for(const entry of diary.entries)if(entry.date.startsWith(month+'-')){
    if(!buckets.has(entry.date))buckets.set(entry.date,[]);
    buckets.get(entry.date).push(entry);
  }
  const days=Array.from({length:count},(_,i)=>{
    const date=`${month}-${String(i+1).padStart(2,'0')}`,entries=buckets.get(date)||[];
    return {date,entryCount:entries.length,total:entries.length?sumEntries(entries):null,meals:mealDetails(entries),water:water.days[i]};
  });
  const recorded=days.filter(day=>day.entryCount>0),total=Object.fromEntries(NUTRIENTS.map(k=>[k,recorded.reduce((sum,day)=>sum+day.total[k],0)]));
  return {kind:'monthly',period:month,days,recordedDays:recorded.length,
    entryCount:days.reduce((sum,day)=>sum+day.entryCount,0),total,
    average:recorded.length?Object.fromEntries(NUTRIENTS.map(k=>[k,total[k]/recorded.length])):null,water};
}

// Standard PDF fonts cover Italian and Latin-1. Normalize punctuation and omit
// decorative symbols instead of sending unsupported glyphs to the font encoder.
export function pdfText(value) {
  return String(value).normalize('NFKC').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2026/g,'...').replace(/\u2044/g,'/').replace(/[^\x20-\x7e\u00a0-\u00ff]/gu,' ').replace(/\s+/g,' ').trim();
}
const number=(value,digits=1)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits}).format(value);
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
const monthLabel=month=>new Date(month+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'});

export function createReportPDF(report,JsPDF) {
  const doc=new JsPDF({unit:'mm',format:'a4',compress:true});
  const title=report.kind==='daily'?'Riepilogo giornaliero':'Riepilogo mensile';
  const period=report.kind==='daily'?dateLabel(report.period):monthLabel(report.period);
  let pageTitle=title,pagePeriod=period;
  const ink=[32,60,43],muted=[91,108,96],line=[220,227,215];
  const left=16,right=194,width=178,bottom=274;
  let y=0;
  doc.setProperties({title:`Cibo sano - ${title} - ${period}`,author:'Cibo sano',subject:'Diario alimentare: calorie, macronutrienti e acqua',creator:'Cibo sano'});
  function text(value,x,at,{size=10,bold=false,color=ink,align='left'}={}){
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
    doc.text(pdfText(value),x,at,{align});
  }
  function header(){
    text('CIBO SANO / DIARIO ALIMENTARE',left,16,{size:9,bold:true,color:muted});
    text(pageTitle,left,28,{size:22,bold:true});text(pagePeriod,left,36,{size:12});
    doc.setDrawColor(...line);doc.line(left,41,right,41);y=49;
  }
  function space(height,onNewPage){if(y+height>bottom){doc.addPage();header();onNewPage?.();}}
  function paragraph(value,{size=9,color=muted,after=4}={}){
    doc.setFont('helvetica','normal');doc.setFontSize(size);
    const lines=doc.splitTextToSize(pdfText(value),width);
    for(const row of lines){space(5);text(row,left,y,{size,color});y+=5;}y+=after;
  }
  function metrics(values,label){
    space(29);text(label,left,y,{size:9,bold:true,color:muted});y+=4;
    const names=['Calorie (kcal)','Proteine (g)','Carboidrati (g)','Grassi (g)'];
    NUTRIENTS.forEach((k,i)=>{
      const x=left+i*45;doc.setFillColor(237,242,229);doc.roundedRect(x,y,43,20,2,2,'F');
      text(names[i],x+3,y+6,{size:8,color:muted});
      const value=values?number(values[k],k==='kcal'?0:1):'-';
      fitted(value,x+3,y+15,37,{size:16,bold:true});
    });y+=27;
  }
  function fitted(value,x,at,maxWidth,opts={}){
    const str=pdfText(value);let size=opts.size||9;
    doc.setFont('helvetica',opts.bold?'bold':'normal');doc.setFontSize(size);
    const measured=doc.getTextWidth(str);if(measured>maxWidth)size*=maxWidth/measured;
    text(str,x,at,{...opts,size});
  }
  // Shared numeric columns keep calorie and macro totals aligned on every page.
  const columns=[{x:16,w:69},{x:85,w:27},{x:112,w:23},{x:135,w:20},{x:155,w:20},{x:175,w:19}];
  const monthColumns=[{x:16,w:37},{x:53,w:14},{x:67,w:26},{x:93,w:23},{x:116,w:23},{x:139,w:23},{x:162,w:32}];
  function row(cells,{bold=false,fill=false,height=8,size=9,layout=columns}={}){
    if(fill){doc.setFillColor(244,247,240);doc.rect(left,y,width,height,'F');}
    cells.forEach((cell,i)=>fitted(cell,i?layout[i].x+layout[i].w-2:left+2,y+height/2+1.1,layout[i].w-4,{size,bold,align:i?'right':'left'}));
    y+=height;doc.setDrawColor(...line);doc.setLineWidth(0.15);doc.line(left,y,right,y);
  }
  function head(first,second){row([first,second,'kcal','P (g)','C (g)','G (g)'],{bold:true,fill:true,size:8});}
  function values(n){return NUTRIENTS.map(k=>n?number(n[k],k==='kcal'?0:1):'-');}
  function dailyDetails(day){
    metrics(day.entryCount?day.total:null,'TOTALE ALIMENTARE DEL GIORNO');
    space(12);
    text('Acqua',left,y,{size:10,bold:true});
    text(day.water?.recorded?`${number(day.water.totalMl,0)} ml`:'Non registrata',left+23,y,{size:10});
    if(day.water?.recorded)text(`${number(day.water.entryCount,0)} ${day.water.entryCount===1?'registrazione':'registrazioni'}`,right,y,{size:8,color:muted,align:'right'});
    y+=5;
    paragraph(day.entryCount?`${day.entryCount} ${day.entryCount===1?'voce alimentare registrata':'voci alimentari registrate'}. I totali descrivono ciò che hai inserito.`:'Alimenti non registrati.',{size:8,after:2});
    for(const meal of day.meals){
      space(31);
      const mealHeader=(continued=false)=>{
        text(meal.label+(continued?' (continua)':''),left,y,{size:13,bold:true});y+=5;head('Alimento / ricetta','Quantità');
      };
      mealHeader();
      if(!meal.entries.length){row(['Nessuna voce registrata','','-','-','-','-'],{size:8});y+=8;continue;}
      for(const entry of meal.entries){
        doc.setFont('helvetica','normal');doc.setFontSize(9);
        const lines=doc.splitTextToSize(pdfText(entry.name)||'Alimento',columns[0].w-4);
        const height=Math.max(10,lines.length*4+4);space(height+8,()=>mealHeader(true));
        const top=y;row(['',`${number(entry.quantity,2)} ${entry.unit==='porzione'?(entry.quantity===1?'porzione':'porzioni'):entry.unit}`,...values(entry.total)],{height});
        lines.forEach((str,i)=>text(str,left+2,top+5+i*4,{size:9}));
      }
      row(['Totale '+meal.label.toLowerCase(),'',...values(meal.total)],{bold:true,fill:true});y+=8;
    }
  }
  const legend=()=>paragraph('P = proteine; C = carboidrati; G = grassi. Valori nutrizionali stimati. Totali calcolati prima dell’arrotondamento.',{size:8,after:0});
  header();
  if(report.kind==='daily'){
    dailyDetails(report);
    legend();
  }else{
    head('Riepilogo','Giorni');
    row(['Totale del mese',String(report.recordedDays),...values(report.recordedDays?report.total:null)],{bold:true,fill:true});
    row(['Media / giorno con voci',String(report.recordedDays),...values(report.average)]);y+=5;
    paragraph(`${report.recordedDays} ${report.recordedDays===1?'giorno con alimenti':'giorni con alimenti'} su ${report.days.length}. ${report.entryCount} ${report.entryCount===1?'voce alimentare registrata':'voci alimentari registrate'}.`,{size:8,after:0});
    paragraph('Le medie alimentari includono i giorni con voci, anche incompleti. Il trattino indica dati non registrati.',{size:8,after:0});
    const water=report.water;
    paragraph(water?.recordedDays?`Acqua registrata: ${number(water.totalMl,0)} ml in ${water.recordedDays} ${water.recordedDays===1?'giorno':'giorni'} (${number(water.entryCount,0)} ${water.entryCount===1?'registrazione':'registrazioni'}).`:'Acqua: non registrata nel mese.',{size:9,after:0});
    paragraph(water?.recordedDays?`Media sui giorni con acqua registrata (${water.recordedDays}): ${number(water.averageMl,1)} ml.`:'Media sui giorni con acqua registrata: non disponibile (0 giorni).',{size:8,after:1});
    const monthHead=()=>row(['Giorno','Voci','kcal','P (g)','C (g)','G (g)','Acqua (ml)'],{bold:true,fill:true,size:8,layout:monthColumns});
    monthHead();
    for(const day of report.days){
      space(4.5,monthHead);
      const label=`${day.date.slice(8)}/${day.date.slice(5,7)}${day.entryCount?'':day.water?.recorded?' - solo acqua':' - nessuna voce'}`;
      row([label,day.entryCount?String(day.entryCount):'-',...values(day.total),day.water?.recorded?number(day.water.totalMl,0):'-'],{height:4.5,size:8,fill:day.entryCount>0||day.water?.recorded,layout:monthColumns});
    }
    y+=4;
    legend();
    for(const day of report.days.filter(day=>day.entryCount>0||day.water?.recorded)){
      pageTitle='Dettaglio dei pasti';pagePeriod=dateLabel(day.date);
      doc.addPage();header();
      dailyDetails(day);
      legend();
    }
  }
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setDrawColor(...line);doc.line(left,281,right,281);
    text('Creato sul dispositivo dai dati del diario',left,287,{size:8,color:muted});
    text(`${page} / ${pages}`,right,287,{size:8,color:muted,align:'right'});
  }
  return doc;
}
