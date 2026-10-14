import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay,subtractCalendarMonths,calendarWindow,buildWeightChart,summarizeWeights,formatWeight,formatWeightChange,formatWeightDate,weightChartSVG} from '../weight.mjs';

const weight=(date,kg)=>({date,kg,updatedAt:`${date}T12:00:00.000Z`});

test('calendar month subtraction clamps month ends and leap days',()=>{
  assert.equal(subtractCalendarMonths('2026-03-31',1),'2026-02-28');
  assert.equal(subtractCalendarMonths('2024-03-31',1),'2024-02-29');
  assert.equal(subtractCalendarMonths('2024-02-29',12),'2023-02-28');
  assert.equal(subtractCalendarMonths('2026-01-31',3),'2025-10-31');
  assert.equal(subtractCalendarMonths('2000-03-31',1),'2000-02-29');
  assert.equal(subtractCalendarMonths('1900-03-31',1),'1900-02-28');
});

test('calendar windows end today, cross years, and count DST days evenly',()=>{
  for(const months of [1,3,6,12]) {
    const window=calendarWindow('2026-01-14',months);
    assert.equal(window.end,'2026-01-14');
    assert.equal(window.days,calendarDay(window.end)-calendarDay(window.start));
  }
  assert.equal(calendarWindow('2026-01-14',3).start,'2025-10-14');
  assert.equal(calendarWindow('2026-10-14',12).start,'2025-10-14');
  assert.equal(calendarDay('2026-03-30')-calendarDay('2026-03-29'),1);
  assert.equal(calendarDay('2026-10-26')-calendarDay('2026-10-25'),1);
  for(const date of ['2026-02-29','2026-04-31','2026-2-01','not-a-date',null])assert.throws(()=>calendarDay(date),/Data/);
  assert.throws(()=>calendarWindow('2026-10-14',2),/intervallo/);
});

test('filter bounds are inclusive and empty periods do not invent measurements',()=>{
  const chart=buildWeightChart([
    weight('2026-09-13',76),weight('2026-09-14',75),weight('2026-10-14',74),weight('2026-10-15',73)
  ],{today:'2026-10-14',months:1});
  assert.deepEqual(chart.points.map(point=>point.date),['2026-09-14','2026-10-14']);
  assert.equal(chart.summary.change,-1);
  const empty=buildWeightChart([weight('2025-01-01',70)],{today:'2026-10-14',months:3});
  assert.equal(empty.window.end,'2026-10-14');
  assert.deepEqual(empty.points,[]);
  assert.equal(empty.summary.count,0);
  assert.equal(empty.summary.change,null);
  assert.equal(empty.yMin,null);
  assert.equal(weightChartSVG(empty),'');
});

test('x positions use the actual date interval, including gaps without inserted values',()=>{
  const chart=buildWeightChart([
    weight('2026-09-14',74),weight('2026-09-15',73.5),weight('2026-09-24',73),weight('2026-10-14',72)
  ],{today:'2026-10-14',months:1,width:660});
  const [first,second,third,last]=chart.points;
  assert.equal(chart.points.length,4);
  assert.equal(first.x,chart.plot.left);
  assert.equal(last.x,chart.plot.right);
  assert(Math.abs((third.x-first.x)/(second.x-first.x)-10)<1e-9);
  const beforeEnd=buildWeightChart([weight('2026-09-14',74),weight('2026-09-24',73)],{today:'2026-10-14',months:1,width:660});
  assert(beforeEnd.points.at(-1).x<beforeEnd.plot.right);
});

test('summary uses first and last recorded dates, rounds the change, and leaves input unchanged',()=>{
  const records=[weight('2026-10-14',70.1),weight('2026-09-30',72.2),weight('2026-10-02',80)];
  const original=structuredClone(records),summary=summarizeWeights(records);
  assert.equal(summary.first.date,'2026-09-30');
  assert.equal(summary.last.date,'2026-10-14');
  assert.equal(summary.change,-2.1);
  assert.equal(formatWeightChange(summary.change),'−2,1 kg');
  assert.equal(formatWeightChange(.2),'+0,2 kg');
  assert.equal(formatWeightChange(0),'0 kg');
  assert.equal(formatWeightChange(null),'—');
  assert.equal(formatWeight(72.55),'72,55');
  assert.deepEqual(records,original);
  summary.first.kg=99;
  assert.deepEqual(records,original);
});

test('one point and flat series have finite positions and a labelled nonzero y range',()=>{
  const single=buildWeightChart([weight('2026-10-10',75)],{today:'2026-10-14',months:1,width:320});
  assert.equal(single.summary.change,null);
  assert.equal(single.points.length,1);
  assert(single.yMin>0 && single.yMin<75 && single.yMax>75);
  assert(Number.isFinite(single.points[0].x) && Number.isFinite(single.points[0].y));
  assert.equal(single.xTicks.length,3);
  const singleSVG=weightChartSVG(single);
  assert(!singleSVG.includes('<path'));
  assert(singleSVG.includes('<circle'));
  assert(singleSVG.includes('75 kg'));
  assert(singleSVG.includes('Asse verticale da'));
  const flat=buildWeightChart([weight('2026-10-01',75),weight('2026-10-10',75)],{today:'2026-10-14',months:1});
  assert.equal(flat.summary.change,0);
  assert.equal(flat.points[0].y,flat.points[1].y);
  assert(flat.yTicks.length>=3);
  assert(flat.yTicks.every(tick=>Number.isFinite(tick.y)));
});

test('SVG has accessible title, units, dates, and escaped custom strings',()=>{
  const chart=buildWeightChart([weight('2026-10-01',73.25),weight('2026-10-14',72.5)],{today:'2026-10-14',months:1});
  const svg=weightChartSVG(chart,{id:'test" id',title:'Peso <img src=x> & "altro"'});
  assert(svg.includes('role="img"'));
  assert(svg.includes('aria-labelledby="test&quot; id-title test&quot; id-description"'));
  assert(svg.includes('Peso &lt;img src=x&gt; &amp; &quot;altro&quot;'));
  assert(!svg.includes('<img'));
  assert(svg.includes('73,25 kg'));
  assert(svg.includes('14 ottobre 2026'));
  assert(!svg.includes('NaN'));
  assert.equal(formatWeightDate('2026-10-14'),'14 ottobre 2026');
});

test('chart input rejects invalid weights instead of plotting false zero values',()=>{
  for(const record of [weight('2026-10-14',0),weight('2026-10-14',501),weight('2026-10-14',null),weight('2026-10-14',NaN),weight('2026-02-29',70)]) {
    assert.throws(()=>buildWeightChart([record],{today:'2026-10-14',months:1}));
  }
});
