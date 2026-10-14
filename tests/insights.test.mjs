import test from 'node:test';
import assert from 'node:assert/strict';
import {validInsightFields, validInsightDate, validTarget, mergeInsightFields, targetsForDay, setTargets, setDayComplete, weekRange, weeklySummary} from '../targets.mjs';

const target = (date, kcal = 2000, protein = 100, carbs = 250, fat = 65) => ({date, kcal, protein, carbs, fat});
const diary = () => ({schemaVersion: 1, entries: [], foods: [], goal: 1800, weights: []});
const entry = (date, meal, kcal = 100, quantity = 100) => ({date, meal, quantity, basis: 100, nutrients: {kcal, protein: 10, carbs: 15, fat: 4}});

test('optional insight fields keep legacy diaries valid and enforce unique dates and numeric bounds', () => {
  assert.equal(validInsightFields(diary()), true);
  assert.equal(validInsightFields({...diary(), targets: [target('2026-10-14', 0.5, 0, 0, 1000)], completeDays: ['2024-02-29']}), true);
  for (const date of ['2026-02-29', '2026-04-31', '1899-12-31', '2201-01-01']) assert.equal(validInsightDate(date), false);
  for (const invalid of [target('2026-10-14', 0), target('2026-10-14', 10001), target('2026-10-14', 2000, -1), target('2026-10-14', 2000, NaN), target('2026-10-14', 2000, 1001), {date: '2026-10-14', kcal: 2000}]) assert.equal(validTarget(invalid), false);
  for (const invalid of [{targets: null}, {completeDays: undefined}, {targets: [target('2026-10-14'), target('2026-10-14')]}, {completeDays: ['2026-10-14', '2026-10-14']}, {completeDays: ['2026-02-30']}]) assert.equal(validInsightFields(invalid), false);
});

test('dated targets apply from their effective date and preserve older targets and legacy goal', () => {
  const original = diary();
  const first = setTargets(original, target('2026-10-14'));
  const second = setTargets(first, target('2026-10-20', 2200, 120, 270, 70));
  assert.deepEqual(original, diary());
  assert.deepEqual(targetsForDay(second, '2026-10-13'), {date: null, kcal: 1800, protein: null, carbs: null, fat: null});
  assert.deepEqual(targetsForDay(second, '2026-10-14'), target('2026-10-14'));
  assert.deepEqual(targetsForDay(second, '2026-10-19'), target('2026-10-14'));
  assert.deepEqual(targetsForDay(second, '2026-10-20'), target('2026-10-20', 2200, 120, 270, 70));
  const cancelled = setTargets(second, target('2026-10-25', null, null, null, null));
  assert.deepEqual(targetsForDay(cancelled, '2026-10-25'), target('2026-10-25', null, null, null, null));
  const corrected = setTargets(cancelled, target('2026-10-14', 1900));
  assert.equal(corrected.targets.length, 3);
  assert.equal(targetsForDay(corrected, '2026-10-17').kcal, 1900);
  assert.equal(targetsForDay(corrected, '2026-10-22').kcal, 2200);
});

test('target changes reject stale effective values while unrelated dates stay editable', () => {
  const original = setTargets(diary(), target('2026-10-14'));
  const baseline = targetsForDay(original, '2026-10-16');
  const changed = setTargets(original, target('2026-10-15', 1900));
  assert.throws(() => setTargets(changed, target('2026-10-16', 1800), {expectedTargets: baseline}), /altra finestra/);
  const futureChanged = setTargets(original, target('2026-11-01', 2300));
  assert.doesNotThrow(() => setTargets(futureChanged, target('2026-10-16', 1800), {expectedTargets: baseline}));
});

test('insight merge adds unseen dates, keeps local target conflicts and preserves absence in legacy backups', () => {
  const local = {...diary(), targets: [target('2026-10-14')], completeDays: ['2026-10-14']};
  const incoming = {...diary(), targets: [target('2026-10-14', 999), target('2026-10-20', 2200)], completeDays: ['2026-10-14', '2026-10-15']};
  const result = mergeInsightFields(local, incoming);
  assert.deepEqual(result.targets, [target('2026-10-14'), target('2026-10-20', 2200)]);
  assert.deepEqual(result.completeDays, ['2026-10-14', '2026-10-15']);
  assert.deepEqual(mergeInsightFields(diary(), diary()), {});
  result.targets[0].kcal = 1;
  assert.equal(local.targets[0].kcal, 2000);
});

test('dated targets and completion markers survive diary backup and invalid imports keep saved data intact', async () => {
  const {DiaryStore, DIARY_KEY, BACKUP_FORMAT} = await import('../diary.mjs');
  const memory = () => { const values = new Map(); return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}; };
  const source = new DiaryStore(memory());
  source.import(JSON.stringify({format: BACKUP_FORMAT, data: diary()}));
  source.update(data => setDayComplete(setTargets(data, target('2026-10-14')), '2026-10-14', true));
  const backing = memory(), restored = new DiaryStore(backing);
  restored.import(source.export());
  assert.deepEqual(restored.read().targets, [target('2026-10-14')]);
  assert.deepEqual(restored.read().completeDays, ['2026-10-14']);
  assert.equal(targetsForDay(restored.read(), '2026-10-13').kcal, 1800);
  const before = backing.getItem(DIARY_KEY), broken = JSON.parse(source.export());
  broken.data.targets[0].kcal = 0;
  assert.throws(() => restored.import(JSON.stringify(broken)), /non valido/);
  assert.equal(backing.getItem(DIARY_KEY), before);
});

test('complete-day changes are idempotent, reversible and do not alter entries', () => {
  const original = {...diary(), entries: [entry('2026-10-14', 'lunch')]};
  const completed = setDayComplete(original, '2026-10-14', true);
  assert.deepEqual(setDayComplete(completed, '2026-10-14', true).completeDays, ['2026-10-14']);
  assert.deepEqual(setDayComplete(completed, '2026-10-14', false).completeDays, []);
  assert.equal(original.completeDays, undefined);
  assert.strictEqual(completed.entries, original.entries);
  assert.throws(() => setDayComplete(original, '2026-02-30', true));
});

test('weeks run Monday to Sunday across calendar, leap-day and daylight-saving boundaries', () => {
  assert.deepEqual(weekRange('2026-10-25'), {start: '2026-10-19', end: '2026-10-25', dates: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']});
  assert.equal(weekRange('2024-02-29').start, '2024-02-26');
  assert.equal(weekRange('2026-03-29').end, '2026-03-29');
  assert.equal(weekRange('2026-01-01').start, '2025-12-29');
  assert.equal(weeklySummary(diary(), '2200-12-31').days.length, 7);
});

test('weekly averages include completed days only; partial and missing days remain distinct', () => {
  const data = {...diary(), completeDays: ['2026-10-12', '2026-10-14'], entries: [entry('2026-10-12', 'breakfast', 200), entry('2026-10-12', 'lunch', 400, 150), entry('2026-10-13', 'dinner', 900), entry('2026-10-11', 'snack', 9999)]};
  const summary = weeklySummary(data, '2026-10-14');
  assert.equal(summary.start, '2026-10-12');
  assert.deepEqual(summary.days.map(day => day.status), ['complete', 'partial', 'complete', 'unregistered', 'unregistered', 'unregistered', 'unregistered']);
  assert.equal(summary.completeCount, 2);
  assert.equal(summary.partialCount, 1);
  assert.equal(summary.unregisteredCount, 4);
  assert.deepEqual(summary.completedTotals, {kcal: 800, protein: 25, carbs: 37.5, fat: 10});
  assert.deepEqual(summary.averages, {kcal: 400, protein: 12.5, carbs: 18.75, fat: 5});
  assert.deepEqual(summary.totals, {kcal: 1700, protein: 35, carbs: 52.5, fat: 14});
  assert.equal(summary.mealDistribution.lunch.totals.kcal, 600);
  assert.equal(summary.mealDistribution.lunch.share, 600 / 1700);
  assert.equal(summary.mealDistribution.snack.entryCount, 0);
});

test('unmarked weeks have no average, and explicit empty complete days have a zero average', () => {
  assert.equal(weeklySummary(diary(), '2026-10-14').averages, null);
  const partial = weeklySummary({...diary(), entries: [entry('2026-10-14', 'lunch')]}, '2026-10-14');
  assert.equal(partial.averages, null);
  assert.equal(partial.totals.kcal, 100);
  const complete = weeklySummary({...diary(), completeDays: ['2026-10-14']}, '2026-10-14');
  assert.deepEqual(complete.averages, {kcal: 0, protein: 0, carbs: 0, fat: 0});
  assert.equal(complete.mealDistribution.breakfast.share, null);
});

test('daily totals show dated calorie and macro remainders, including a zero macro target', async () => {
  const {dailyNutritionHTML} = await import('../insights-ui.js');
  const data = {...diary(), entries: [entry('2026-10-14', 'lunch', 300)], targets: [target('2026-10-14', 2000, 100, null, 0)]};
  const html = dailyNutritionHTML(data, '2026-10-14');
  assert.match(html, /1\.?700 kcal rimanenti su 2\.?000 kcal/);
  assert.match(html, /90 g rimanenti su 100 g/);
  assert.match(html, /4 g oltre 0 g/);
  assert.match(html, /Obiettivi validi dal 14 ottobre 2026/);
  assert.match(html, /value="300" max="2000"/);
  const disabled = dailyNutritionHTML({...data, targets: [target('2026-10-14', null, null, null, null)]}, '2026-10-14');
  assert.doesNotMatch(disabled, /<progress/);
});
