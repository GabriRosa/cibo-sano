import {escapeHTML} from './lib.mjs';

const DAY_MS = 86400000;
const numberFormat = new Intl.NumberFormat('it-IT', {maximumFractionDigits:2});
const shortDateFormat = new Intl.DateTimeFormat('it-IT', {day:'numeric',month:'short',timeZone:'UTC'});
const dateFormat = new Intl.DateTimeFormat('it-IT', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

export function calendarDay(value) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Data non valida.');
  const stamp=Date.parse(`${value}T00:00:00.000Z`);
  if(!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,10)!==value)throw new Error('Data non valida.');
  return stamp/DAY_MS;
}

function dateFromDay(value) {return new Date(value*DAY_MS).toISOString().slice(0,10);}
function daysInMonth(year,month) {
  return [31,year%4===0 && (year%100!==0 || year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}

export function subtractCalendarMonths(date,months) {
  calendarDay(date);
  if(!Number.isInteger(months) || months<0 || months>1200)throw new Error('Intervallo non valido.');
  const [year,month,day]=date.split('-').map(Number),offset=year*12+month-1-months;
  const nextYear=Math.floor(offset/12),nextMonth=(offset%12+12)%12+1;
  if(nextYear<0 || nextYear>9999)throw new Error('Intervallo non valido.');
  return `${String(nextYear).padStart(4,'0')}-${String(nextMonth).padStart(2,'0')}-${String(Math.min(day,daysInMonth(nextYear,nextMonth))).padStart(2,'0')}`;
}

export function calendarWindow(today,months) {
  if(![1,3,6,12].includes(months))throw new Error('Scegli un intervallo di 1, 3, 6 o 12 mesi.');
  const endDay=calendarDay(today),start=subtractCalendarMonths(today,months),startDay=calendarDay(start);
  return {start,end:today,startDay,endDay,days:endDay-startDay,months};
}

function sortedWeights(weights) {
  if(!Array.isArray(weights))throw new Error('Misurazioni non valide.');
  return weights.map(record=>{
    calendarDay(record?.date);
    if(typeof record.kg!=='number' || !Number.isFinite(record.kg) || record.kg<1 || record.kg>500)throw new Error('Misurazione non valida.');
    return {...record};
  }).sort((a,b)=>a.date.localeCompare(b.date));
}

export function summarizeWeights(weights) {
  const records=sortedWeights(weights),first=records[0]??null,last=records.at(-1)??null;
  return {count:records.length,first,last,change:records.length>1?Math.round((last.kg-first.kg)*100)/100:null};
}

export function formatWeight(kg) {return numberFormat.format(kg);}
export function formatWeightChange(kg) {
  return kg===null?'—':`${kg>0?'+':kg<0?'−':''}${formatWeight(Math.abs(kg))} kg`;
}
export function formatWeightDate(date,{short=false}={}) {
  return (short?shortDateFormat:dateFormat).format(new Date(calendarDay(date)*DAY_MS));
}

function niceStep(value) {
  const magnitude=10**Math.floor(Math.log10(value)),fraction=value/magnitude;
  return [1,2,2.5,5,10].find(step=>step>=fraction)*magnitude;
}
const precise=value=>Math.round(value*1000000)/1000000;

export function buildWeightChart(weights,{today,months=3,width=720,height=290}={}) {
  const window=calendarWindow(today,months),all=sortedWeights(weights);
  const records=all.filter(record=>record.date>=window.start && record.date<=window.end);
  const chartWidth=Math.max(240,Number.isFinite(width)?width:720),chartHeight=Math.max(220,Number.isFinite(height)?height:290);
  const plot={left:49,right:chartWidth-17,top:25,bottom:chartHeight-47};
  const x=day=>plot.left+(day-window.startDay)/window.days*(plot.right-plot.left);
  const tickCount=chartWidth<500?3:5;
  const xTicks=Array.from({length:tickCount},(_,index)=>{
    const day=Math.round(window.startDay+window.days*index/(tickCount-1));
    return {date:dateFromDay(day),x:x(day)};
  });
  const base={window,width:chartWidth,height:chartHeight,plot,xTicks,summary:summarizeWeights(records),points:[],yTicks:[],yMin:null,yMax:null};
  if(!records.length)return base;
  const values=records.map(record=>record.kg),min=Math.min(...values),max=Math.max(...values);
  const padding=Math.max(.5,(max-min)*.12),step=niceStep((max-min+padding*2)/4);
  const yMin=precise(Math.max(0,Math.floor((min-padding)/step)*step));
  const yMax=precise(Math.ceil((max+padding)/step)*step);
  const y=value=>plot.bottom-(value-yMin)/(yMax-yMin)*(plot.bottom-plot.top);
  const yTicks=[];
  for(let value=yMin;value<=yMax+step/2;value=precise(value+step))yTicks.push({value,y:y(value)});
  return {...base,yMin,yMax,yTicks,points:records.map(record=>({...record,x:x(calendarDay(record.date)),y:y(record.kg)}))};
}

export function weightChartSVG(chart,{id='weight-chart',title='Andamento del peso'}={}) {
  if(!chart.points.length)return '';
  const e=escapeHTML,coordinate=value=>Number(value.toFixed(2));
  const description=`Dal ${formatWeightDate(chart.window.start)} al ${formatWeightDate(chart.window.end)}. ${chart.points.length} ${chart.points.length===1?'misurazione':'misurazioni'}. Asse verticale da ${formatWeight(chart.yMin)} a ${formatWeight(chart.yMax)} kg. I punti sono collocati nelle date registrate.`;
  const path=chart.points.map((point,index)=>`${index?'L':'M'} ${coordinate(point.x)} ${coordinate(point.y)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="weight-chart" viewBox="0 0 ${chart.width} ${chart.height}" width="${chart.width}" height="${chart.height}" role="img" aria-labelledby="${e(id)}-title ${e(id)}-description">
    <title id="${e(id)}-title">${e(title)}</title><desc id="${e(id)}-description">${e(description)}</desc>
    ${chart.yTicks.map(tick=>`<line class="weight-grid-line" x1="${chart.plot.left}" y1="${coordinate(tick.y)}" x2="${chart.plot.right}" y2="${coordinate(tick.y)}"/><text class="weight-axis-label" x="${chart.plot.left-10}" y="${coordinate(tick.y+4)}" text-anchor="end">${e(formatWeight(tick.value))}</text>`).join('')}
    <text class="weight-axis-title" x="${chart.plot.left-10}" y="13" text-anchor="end">kg</text>
    ${chart.xTicks.map((tick,index)=>`<line class="weight-axis-tick" x1="${coordinate(tick.x)}" y1="${chart.plot.bottom}" x2="${coordinate(tick.x)}" y2="${chart.plot.bottom+5}"/><text class="weight-axis-label" x="${coordinate(tick.x)}" y="${chart.plot.bottom+22}" text-anchor="${index===0?'start':index===chart.xTicks.length-1?'end':'middle'}">${e(formatWeightDate(tick.date,{short:true}))}</text>`).join('')}
    <text class="weight-axis-title" x="${chart.plot.right}" y="${chart.height-3}" text-anchor="end">Data</text>
    ${chart.points.length>1?`<path class="weight-chart-line" d="${path}"/>`:''}
    ${chart.points.map(point=>`<circle class="weight-chart-point" cx="${coordinate(point.x)}" cy="${coordinate(point.y)}" r="${chart.points.length>100?2.7:4.5}"><title>${e(formatWeightDate(point.date))}: ${e(formatWeight(point.kg))} kg</title></circle>`).join('')}
  </svg>`;
}
