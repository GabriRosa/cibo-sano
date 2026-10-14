import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {emptyDiary} from '../diary.mjs';
import {dailyReport,monthlyReport,createReportPDF,pdfText} from '../reports.mjs';

const entry=(date,overrides={})=>({date,name:'Yogurt e caffè',meal:'breakfast',quantity:150,basis:100,unit:'g',nutrients:{kcal:101,protein:8.2,carbs:10.4,fat:3.6},...overrides});
const diary=entries=>({...emptyDiary(),entries});
const context={console,atob,btoa,TextEncoder,TextDecoder,navigator:{userAgent:'node'}};
context.window=context;context.self=context;
runInNewContext(readFileSync(new URL('../vendor/jspdf.umd.min.js',import.meta.url),'utf8'),context);
const JsPDF=context.jspdf.jsPDF;
function MeasuredPDF(options){
  const pdf=new JsPDF(options),original=pdf.text.bind(pdf);pdf.placements=[];
  pdf.text=(value,x,y,opts)=>{
    const text=String(value),w=pdf.getTextWidth(text),left=opts?.align==='right'?x-w:x;
    pdf.placements.push({text,x:left,y,right:left+w,page:pdf.getNumberOfPages()});
    return original(value,x,y,opts);
  };
  return pdf;
}

test('daily PDF totals use saved quantities and nutrients, with no intermediate rounding',()=>{
  const report=dailyReport(diary([entry('2026-10-14'),entry('2026-10-14',{quantity:0.5,basis:1,unit:'porzione',meal:'dinner'}),entry('2026-10-15')]),'2026-10-14');
  assert.equal(report.entryCount,2);assert.equal(report.total.kcal,202);assert.equal(report.total.protein,16.4);
  assert.equal(report.meals[0].entries[0].total.kcal,151.5);assert.equal(report.meals[3].total.kcal,50.5);
  assert.equal(report.meals[1].entries.length,0);
});
test('monthly PDF averages omit missing days but include explicitly logged zero-calorie days',()=>{
  const report=monthlyReport(diary([entry('2024-02-01'),entry('2024-02-01'),entry('2024-02-29',{nutrients:{kcal:0,protein:0,carbs:0,fat:0}}),entry('2024-03-01')]),'2024-02');
  assert.equal(report.days.length,29);assert.equal(report.recordedDays,2);assert.equal(report.entryCount,3);
  assert.equal(report.total.kcal,303);assert.equal(report.average.kcal,151.5);
  assert.equal(report.days[1].total,null);assert.equal(report.days[28].total.kcal,0);
});
test('empty reports retain no-data meaning and calendar validation',()=>{
  const report=monthlyReport(diary([]),'2026-10');
  assert.equal(report.average,null);assert.equal(report.days.length,31);assert.equal(report.recordedDays,0);
  assert(report.days.every(day=>day.total===null));assert.equal(dailyReport(diary([]),'2026-10-14').entryCount,0);
  for(const month of ['2026-13','2026-00','2026-1','2026-02-02','1899-01'])assert.throws(()=>monthlyReport(diary([]),month));
  assert.throws(()=>dailyReport(diary([]),'2026-02-29'));
  assert.equal(monthlyReport(diary([]),'2026-02').days.length,28);
  assert.equal(monthlyReport(diary([]),'2026-04').days.length,30);
});
test('actual vendored PDF output paginates long daily reports without clipping text',()=>{
  const entries=Array.from({length:80},(_,i)=>entry('2026-10-14',{name:`Voce ${i+1} - Caffè e yogurt con una descrizione lunga per controllare la leggibilità delle ricette e il passaggio alla pagina successiva`,meal:i<70?'lunch':'dinner'}));
  const pdf=createReportPDF(dailyReport(diary(entries),'2026-10-14'),MeasuredPDF);
  assert(pdf.getNumberOfPages()>2);assert(Buffer.from(pdf.output('arraybuffer')).subarray(0,5).equals(Buffer.from('%PDF-')));
  assert(pdf.placements.some(p=>p.text==='Pranzo (continua)'));
  for(const p of pdf.placements){assert(p.x>=15.9&&p.right<=194.1,JSON.stringify(p));assert(p.y>=15&&p.y<=287,JSON.stringify(p));}
  assert.equal(pdf.placements.filter(p=>p.text.startsWith('Voce ')).length,80);
});
test('monthly overview fits one page and each recorded day has four meal sections',()=>{
  const report=monthlyReport(diary([entry('2026-10-01'),entry('2026-10-31')]),'2026-10');
  const pdf=createReportPDF(report,MeasuredPDF);
  assert.equal(pdf.getNumberOfPages(),3);
  assert(pdf.placements.some(p=>p.page===1&&p.text==='31/10'));
  assert(pdf.placements.some(p=>p.page===1&&p.text==='02/10 - nessuna voce'));
  for(const [page,date] of [[2,'1 ottobre 2026'],[3,'31 ottobre 2026']]){
    const texts=pdf.placements.filter(p=>p.page===page).map(p=>p.text);
    assert(texts.includes(date));
    for(const label of ['Colazione','Spuntino','Pranzo','Cena'])assert(texts.includes(label));
    assert.equal(texts.filter(text=>text==='Nessuna voce registrata').length,3);
    assert(texts.includes('Yogurt e caffè'));assert(texts.includes('150 g'));
    assert(texts.includes('Totale colazione'));
  }
  for(const p of pdf.placements)assert(p.x>=15.9&&p.right<=194.1&&p.y<=287,JSON.stringify(p));
});
test('monthly meal details match daily reports and preserve dates, quantities and all nutrients',()=>{
  const data=diary([
    entry('2026-10-02',{name:'Cena secondo giorno',meal:'dinner',quantity:0.5,basis:1,unit:'porzione'}),
    entry('2026-10-01',{name:'Latte',quantity:230,unit:'ml'}),
    entry('2026-10-01',{name:'Pranzo primo giorno',meal:'lunch',quantity:175}),
    entry('2026-11-01',{name:'Fuori mese'})
  ]);
  const report=monthlyReport(data,'2026-10');
  for(const day of report.days){
    const daily=dailyReport(data,day.date);
    assert.deepEqual(day.meals,daily.meals);
    if(day.entryCount)assert.deepEqual(day.total,daily.total);
  }
  const pdf=createReportPDF(report,MeasuredPDF),texts=pdf.placements.map(p=>p.text);
  assert(!texts.includes('Fuori mese'));
  assert.equal(texts.filter(text=>text==='Latte').length,1);
  assert(texts.includes('230 ml'));assert(texts.includes('0,5 porzioni'));
  assert.equal(pdf.placements.find(p=>p.text==='Pranzo primo giorno').page,2);
  assert.equal(pdf.placements.find(p=>p.text==='Cena secondo giorno').page,3);
  const zeroDay=createReportPDF(monthlyReport(diary([]),'2026-10'),MeasuredPDF);
  assert.equal(zeroDay.getNumberOfPages(),1);
  assert(!zeroDay.placements.some(p=>p.text==='Dettaglio dei pasti'));
});
test('long monthly meal details repeat their date and meal without losing entries or the next day',()=>{
  const entries=Array.from({length:60},(_,i)=>entry('2026-10-05',{name:`Dettaglio ${i+1}`,meal:'lunch'}));
  entries.push(entry('2026-10-06',{name:'Ultimo giorno',meal:'dinner'}));
  const pdf=createReportPDF(monthlyReport(diary(entries),'2026-10'),MeasuredPDF);
  assert(pdf.getNumberOfPages()>3);
  assert.equal(pdf.placements.filter(p=>/^Dettaglio \d+$/.test(p.text)).length,60);
  const continued=pdf.placements.filter(p=>p.text==='Pranzo (continua)');
  assert(continued.length>0);
  for(const item of continued)assert(pdf.placements.some(p=>p.page===item.page&&p.text==='5 ottobre 2026'));
  const lastPage=pdf.placements.find(p=>p.text==='Ultimo giorno').page;
  assert(pdf.placements.some(p=>p.page===lastPage&&p.text==='6 ottobre 2026'));
  assert.equal(pdf.placements.filter(p=>p.text==='Totale pranzo').length,1);
  for(const p of pdf.placements)assert(p.x>=15.9&&p.right<=194.1&&p.y<=287,JSON.stringify(p));
});
test('PDF fonts preserve Italian accents and normalize unsupported decorations',()=>{
  assert.equal(pdfText('Caffè – quantità “½” 🥗\n'), 'Caffè - quantità "1/2"');
});
