import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {emptyDiary} from '../diary.mjs';
import {dailyReport,monthlyReport,createReportPDF,pdfText} from '../reports.mjs';

const entry=(date,overrides={})=>({date,name:'Yogurt e caffè',meal:'breakfast',quantity:150,basis:100,unit:'g',nutrients:{kcal:101,protein:8.2,carbs:10.4,fat:3.6},...overrides});
const diary=entries=>({...emptyDiary(),entries});
let waterId=0;
const water=(date,ml)=>({id:`water-${++waterId}`,date,ml,createdAt:`${date}T12:00:00Z`,updatedAt:`${date}T12:00:00Z`});
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

test('daily reports keep water separate from food totals and include only the selected date',()=>{
  const original=diary([entry('2026-10-14'),entry('2026-10-15')]);
  original.waterEntries=[water('2026-10-14',250),water('2026-10-14',375),water('2026-10-15',1000)];
  const before=JSON.stringify(original),report=dailyReport(original,'2026-10-14');
  assert.deepEqual(report.water,{date:'2026-10-14',recorded:true,entryCount:2,totalMl:625});
  assert.deepEqual(report.total,dailyReport({...original,waterEntries:[]},'2026-10-14').total);
  assert.equal(report.entryCount,1);
  assert.equal(JSON.stringify(original),before);
  const pdf=createReportPDF(report,MeasuredPDF),texts=pdf.placements.map(item=>item.text);
  assert(texts.includes('Acqua'));assert(texts.includes('625 ml'));assert(texts.includes('2 registrazioni'));
});

test('monthly water averages count water dates independently of food and complete-day markers',()=>{
  const data=diary([entry('2026-10-01'),entry('2026-10-03',{nutrients:{kcal:0,protein:0,carbs:0,fat:0}})]);
  data.completeDays=['2026-10-02'];
  data.waterEntries=[water('2026-10-02',250),water('2026-10-02',125),water('2026-10-03',500),water('2026-11-01',9000)];
  const report=monthlyReport(data,'2026-10');
  assert.equal(report.recordedDays,2);assert.equal(report.entryCount,2);
  assert.equal(report.average.kcal,75.75);
  assert.equal(report.water.totalMl,875);assert.equal(report.water.entryCount,3);
  assert.equal(report.water.recordedDays,2);assert.equal(report.water.missingDays,29);assert.equal(report.water.averageMl,437.5);
  assert.equal(report.days[0].water.recorded,false);
  assert.equal(report.days[1].entryCount,0);assert.equal(report.days[1].total,null);assert.equal(report.days[1].water.totalMl,375);
  assert.equal(report.days[2].total.kcal,0);assert.equal(report.days[2].water.totalMl,500);
  const texts=createReportPDF(report,MeasuredPDF).placements.map(item=>item.text);
  assert(texts.includes('Media sui giorni con acqua registrata (2): 437,5 ml.'));
  assert(texts.includes('02/10 - solo acqua'));
  assert(texts.includes('2 ottobre 2026'));
});

test('legacy diaries show water as unregistered, with no fabricated zero or unavailable-number output',()=>{
  const data=diary([entry('2026-10-14')]),day=dailyReport(data,'2026-10-14'),month=monthlyReport(data,'2026-10');
  assert.deepEqual(day.water,{date:'2026-10-14',recorded:false,entryCount:0,totalMl:0});
  assert.equal(month.water.averageMl,null);assert.equal(month.water.recordedDays,0);
  const dailyText=createReportPDF(day,MeasuredPDF).placements.map(item=>item.text);
  const monthlyText=createReportPDF(month,MeasuredPDF).placements.map(item=>item.text);
  assert(dailyText.includes('Non registrata'));
  assert(monthlyText.includes('Acqua: non registrata nel mese.'));
  assert(monthlyText.includes('Media sui giorni con acqua registrata: non disponibile (0 giorni).'));
  assert(![...dailyText,...monthlyText].some(text=>/NaN|undefined|\b0 ml\b/.test(text)));
});

test('water-only dates produce daily and monthly PDFs while food remains explicitly unregistered',()=>{
  const data={...diary([]),waterEntries:[water('2026-10-04',250),water('2026-10-05',750)]};
  const day=dailyReport(data,'2026-10-04'),month=monthlyReport(data,'2026-10');
  assert.equal(day.entryCount,0);assert.equal(day.total.kcal,0);assert.equal(day.water.totalMl,250);
  assert.equal(month.recordedDays,0);assert.equal(month.entryCount,0);assert.equal(month.average,null);
  assert.equal(month.water.totalMl,1000);assert.equal(month.water.recordedDays,2);assert.equal(month.water.averageMl,500);
  const dailyPdf=createReportPDF(day,MeasuredPDF),monthlyPdf=createReportPDF(month,MeasuredPDF);
  assert(Buffer.from(dailyPdf.output('arraybuffer')).subarray(0,5).equals(Buffer.from('%PDF-')));
  assert.equal(monthlyPdf.getNumberOfPages(),3);
  const dayTexts=dailyPdf.placements.map(item=>item.text);
  assert(dayTexts.includes('250 ml'));assert(dayTexts.includes('Alimenti non registrati.'));
  assert.equal(dayTexts.filter(text=>text==='Nessuna voce registrata').length,4);
  for(const label of ['Colazione','Spuntino','Pranzo','Cena'])assert(dayTexts.includes(label));
  for(const [page,date,amount] of [[2,'4 ottobre 2026','250 ml'],[3,'5 ottobre 2026','750 ml']]){
    const texts=monthlyPdf.placements.filter(item=>item.page===page).map(item=>item.text);
    assert(texts.includes(date));assert(texts.includes(amount));assert(texts.includes('Alimenti non registrati.'));
    assert.equal(texts.filter(text=>text==='Nessuna voce registrata').length,4);
  }
});

test('31-day water overview fits one page and keeps large quantities inside the report margins',()=>{
  const waterEntries=Array.from({length:31},(_,index)=>water(`2026-10-${String(index+1).padStart(2,'0')}`,10000));
  const report=monthlyReport({...diary([]),waterEntries},'2026-10');
  assert.equal(report.water.totalMl,310000);assert.equal(report.water.averageMl,10000);
  const pdf=createReportPDF(report,MeasuredPDF),first=pdf.placements.filter(item=>item.page===1);
  assert.equal(pdf.getNumberOfPages(),32);
  assert(first.some(item=>item.text==='31/10 - solo acqua'));
  assert(first.some(item=>item.text==='Acqua (ml)'));
  assert.equal(first.filter(item=>item.text==='10.000').length,31);
  for(const item of pdf.placements)assert(item.x>=15.9&&item.right<=194.1&&item.y>=15&&item.y<=287,JSON.stringify(item));
  const huge=createReportPDF(dailyReport({...diary([]),waterEntries:Array.from({length:100},()=>water('2026-10-14',10000))},'2026-10-14'),MeasuredPDF);
  assert(huge.placements.some(item=>item.text==='1.000.000 ml'));
  for(const item of huge.placements)assert(item.x>=15.9&&item.right<=194.1&&item.y<=287,JSON.stringify(item));
});
