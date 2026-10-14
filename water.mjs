export const MAX_WATER_ML = 10000;
export const MAX_WATER_ENTRIES = 30000;
const DAY_MS = 86400000;
const dayString = date => date.toISOString().slice(0, 10);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validMl = value => Number.isInteger(value) && value > 0 && value <= MAX_WATER_ML;

export function validWaterDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && dayString(date) === value;
}

export function parseWaterAmount(value, unit = 'ml') {
  if (!['ml', 'L'].includes(unit) || !['string', 'number'].includes(typeof value)) return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const scaled = Number(text) * (unit === 'L' ? 1000 : 1), ml = Math.round(scaled);
  return Math.abs(scaled - ml) < 1e-8 && validMl(ml) ? ml : null;
}

export function validWaterEntry(entry) {
  return !!entry && typeof entry === 'object' && !Array.isArray(entry) &&
    typeof entry.id === 'string' && entry.id.trim().length > 0 && entry.id.length <= 200 &&
    validWaterDate(entry.date) && validMl(entry.ml) && timestamp(entry.createdAt) && timestamp(entry.updatedAt);
}

export function validWaterFields(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Object.hasOwn(data, 'waterEntries')) return true;
  const entries = data.waterEntries;
  return Array.isArray(entries) && entries.length <= MAX_WATER_ENTRIES && Array.from(entries).every(validWaterEntry) &&
    new Set(entries.map(entry => entry.id)).size === entries.length;
}

export function createWaterEntry({date, ml}, now = new Date()) {
  const stamp = now.toISOString();
  const entry = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    date, ml, createdAt: stamp, updatedAt: stamp,
  };
  if (!validWaterEntry(entry)) throw new Error('Inserisci una data valida e una quantità d’acqua da 1 a 10.000 ml.');
  return entry;
}

export function mergeWaterFields(current, incoming) {
  if (!validWaterFields(current) || !validWaterFields(incoming)) throw new Error('Registrazioni dell’acqua non valide.');
  if (!Object.hasOwn(current, 'waterEntries') && !Object.hasOwn(incoming, 'waterEntries')) return {};
  const existing = new Set((current.waterEntries || []).map(entry => entry.id));
  const waterEntries = [...(current.waterEntries || []), ...(incoming.waterEntries || []).filter(entry => !existing.has(entry.id))]
    .map(entry => ({...entry}));
  if (waterEntries.length > MAX_WATER_ENTRIES) throw new Error('Le registrazioni dell’acqua superano il limite previsto.');
  return {waterEntries};
}

export function waterRangeSummary(data, start, end) {
  if (!validWaterFields(data)) throw new Error('Registrazioni dell’acqua non valide.');
  if (!validWaterDate(start) || !validWaterDate(end) || start > end) throw new Error('Intervallo dell’acqua non valido.');
  const days = [];
  for (let value = Date.parse(`${start}T12:00:00Z`), last = Date.parse(`${end}T12:00:00Z`); value <= last; value += DAY_MS) {
    days.push({date: dayString(new Date(value)), recorded: false, entryCount: 0, totalMl: 0});
  }
  const byDate = new Map(days.map(day => [day.date, day]));
  let totalMl = 0, entryCount = 0;
  for (const entry of data.waterEntries || []) {
    const day = byDate.get(entry.date);
    if (!day) continue;
    day.recorded = true; day.entryCount++; day.totalMl += entry.ml;
    entryCount++; totalMl += entry.ml;
  }
  const recordedDays = days.filter(day => day.recorded).length;
  return {start, end, days, totalMl, entryCount, recordedDays, missingDays: days.length - recordedDays,
    averageMl: recordedDays ? totalMl / recordedDays : null};
}

export function waterDaySummary(data, date) {
  return waterRangeSummary(data, date, date).days[0];
}
