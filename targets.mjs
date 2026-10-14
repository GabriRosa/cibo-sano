export const TARGET_KEYS = ['kcal', 'protein', 'carbs', 'fat'];
const MEAL_KEYS = ['breakfast', 'snack', 'lunch', 'dinner'];
const MAX_RECORDS = 30000;
const DAY_MS = 86400000;
const zeroNutrients = () => Object.fromEntries(TARGET_KEYS.map(key => [key, 0]));
const dayString = date => date.toISOString().slice(0, 10);

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && dayString(date) === value;
}

export function validInsightDate(value) {
  return calendarDate(value) && value >= '1900-01-01' && value <= '2200-12-31';
}

export function validTarget(target) {
  return !!target && !Array.isArray(target) && validInsightDate(target.date) && TARGET_KEYS.every(key => {
    const value = target[key];
    return value === null || (typeof value === 'number' && Number.isFinite(value) &&
      (key === 'kcal' ? value > 0 && value <= 10000 : value >= 0 && value <= 1000));
  });
}

export function validInsightFields(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (Object.hasOwn(data, 'targets') && (!Array.isArray(data.targets) || data.targets.length > MAX_RECORDS ||
    !data.targets.every(validTarget) || new Set(data.targets.map(target => target.date)).size !== data.targets.length)) return false;
  if (Object.hasOwn(data, 'completeDays') && (!Array.isArray(data.completeDays) || data.completeDays.length > MAX_RECORDS ||
    !data.completeDays.every(validInsightDate) || new Set(data.completeDays).size !== data.completeDays.length)) return false;
  return true;
}

const copyTarget = target => ({date: target.date, ...Object.fromEntries(TARGET_KEYS.map(key => [key, target[key]]))});

export function mergeInsightFields(current, incoming) {
  if (!validInsightFields(current) || !validInsightFields(incoming)) throw new Error('Obiettivi o giornate complete non validi.');
  const result = {};
  if (Object.hasOwn(current, 'targets') || Object.hasOwn(incoming, 'targets')) {
    const dates = new Set((current.targets || []).map(target => target.date));
    result.targets = [...(current.targets || []), ...(incoming.targets || []).filter(target => !dates.has(target.date))]
      .map(copyTarget).sort((a, b) => a.date.localeCompare(b.date));
  }
  if (Object.hasOwn(current, 'completeDays') || Object.hasOwn(incoming, 'completeDays')) {
    result.completeDays = [...new Set([...(current.completeDays || []), ...(incoming.completeDays || [])])].sort();
  }
  if (!validInsightFields(result)) throw new Error('Il diario risultante supera il limite di obiettivi o giornate complete.');
  return result;
}

export function targetsForDay(data, date) {
  if (!calendarDate(date)) throw new Error('Data non valida.');
  let applicable = null;
  for (const target of data.targets || []) {
    if (target.date <= date && (!applicable || target.date > applicable.date)) applicable = target;
  }
  if (applicable) return copyTarget(applicable);
  return {date: null, kcal: data.goal ?? null, protein: null, carbs: null, fat: null};
}

export function setTargets(data, target, options = {}) {
  if (!validInsightFields(data) || !validTarget(target)) throw new Error('Controlla la data e gli obiettivi: kcal da 0 escluso a 10.000, macro da 0 a 1.000 g.');
  const current = targetsForDay(data, target.date);
  if (Object.hasOwn(options, 'expectedTargets') &&
    (!options.expectedTargets || ['date', ...TARGET_KEYS].some(key => current[key] !== options.expectedTargets[key]))) {
    throw new Error('Gli obiettivi per questa data sono cambiati in un’altra finestra. Ricarica i valori prima di salvarli.');
  }
  const targets = [...(data.targets || []).filter(item => item.date !== target.date), copyTarget(target)]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (targets.length > MAX_RECORDS) throw new Error('Hai raggiunto il limite di cambi di obiettivo.');
  return {...data, targets};
}

export function setDayComplete(data, date, complete) {
  if (!validInsightFields(data) || !validInsightDate(date) || typeof complete !== 'boolean') throw new Error('Giornata non valida.');
  const dates = new Set(data.completeDays || []);
  if (complete) dates.add(date);
  else dates.delete(date);
  if (dates.size > MAX_RECORDS) throw new Error('Hai raggiunto il limite di giornate complete.');
  return {...data, completeDays: [...dates].sort()};
}

export function weekRange(date) {
  if (!validInsightDate(date)) throw new Error('Data non valida.');
  const selected = new Date(`${date}T12:00:00Z`);
  const startTime = selected.valueOf() - ((selected.getUTCDay() + 6) % 7) * DAY_MS;
  const dates = Array.from({length: 7}, (_, index) => dayString(new Date(startTime + index * DAY_MS)));
  return {start: dates[0], end: dates[6], dates};
}

function addEntry(total, entry) {
  for (const key of TARGET_KEYS) total[key] += entry.nutrients[key] * entry.quantity / entry.basis;
}

function addTotals(total, nutrients) {
  for (const key of TARGET_KEYS) total[key] += nutrients[key];
}

export function weeklySummary(data, date) {
  const range = weekRange(date), completed = new Set(data.completeDays || []);
  const days = range.dates.map(day => ({date: day, status: completed.has(day) ? 'complete' : 'unregistered',
    entryCount: 0, totals: zeroNutrients(), targets: targetsForDay(data, day)}));
  const byDate = new Map(days.map(day => [day.date, day]));
  const mealDistribution = Object.fromEntries(MEAL_KEYS.map(meal => [meal, {entryCount: 0, totals: zeroNutrients(), share: null}]));
  for (const entry of data.entries || []) {
    const day = byDate.get(entry.date);
    if (!day) continue;
    day.entryCount++;
    if (day.status !== 'complete') day.status = 'partial';
    addEntry(day.totals, entry);
    if (mealDistribution[entry.meal]) {
      mealDistribution[entry.meal].entryCount++;
      addEntry(mealDistribution[entry.meal].totals, entry);
    }
  }
  const totals = zeroNutrients(), completedTotals = zeroNutrients();
  let completeCount = 0, partialCount = 0;
  for (const day of days) {
    addTotals(totals, day.totals);
    if (day.status === 'complete') { completeCount++; addTotals(completedTotals, day.totals); }
    else if (day.status === 'partial') partialCount++;
  }
  for (const meal of Object.values(mealDistribution)) meal.share = totals.kcal > 0 ? meal.totals.kcal / totals.kcal : null;
  const averages = completeCount ? Object.fromEntries(TARGET_KEYS.map(key => [key, completedTotals[key] / completeCount])) : null;
  return {...range, days, totals, completedTotals, averages, completeCount, partialCount,
    unregisteredCount: 7 - completeCount - partialCount, mealDistribution};
}
