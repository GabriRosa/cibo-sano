const KEYS = ['kcal', 'protein', 'carbs', 'fat'];
const labels = {
  kcal: /\b(?:energia|energi[ae]|energy|valore\s+energetico|calorie)\b/i,
  protein: /\b(?:proteine?|proteins?)\b/i,
  carbs: /\b(?:carboidrati|carbohydrates?)\b/i,
  fat: /\b(?:grassi|fats?|lipidi)\b/i,
};
const empty = () => Object.fromEntries(KEYS.map(key => [key, null]));
const unitPattern = /\b100\s*(ml|g|gr|grammi|millilitri)\b/gi;
const normalizedUnit = unit => /^(?:ml|millilitri)$/i.test(unit) ? 'ml' : 'g';

function numbers(value) {
  const withoutPercent = value.replace(/\d+(?:[.,]\d+)?\s*%/g, '');
  return [...withoutPercent.matchAll(/(?:<\s*)?\d+(?:[.,]\d+)?/g)].map(match => ({
    value: match[0].startsWith('<') ? null : Number(match[0].replace(',', '.')),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function rowValues(row, key) {
  const match = row.match(labels[key]);
  let value = match ? row.slice(match.index + match[0].length) : row;
  // Subrows must never replace total fat or carbohydrate values.
  value = value.split(/\b(?:di\s+cui|of\s+which|zuccheri|sugars?|satur[ia-z]*)\b/i)[0];
  if (key !== 'kcal') return numbers(value).map(item => item.value);
  const all = numbers(value);
  // Select explicitly marked kcal, never convert a kJ reading into kcal.
  const kcal = all.filter(item => /^\s*kcal\b/i.test(value.slice(item.end))).map(item => item.value);
  if (kcal.length) return kcal;
  if (/^\s*(?:[(:]\s*)?kcal\b/i.test(value)) return all.map(item => item.value);
  if (/^\s*(?:[(:]\s*)?k[jJ]\s*[/|]\s*kcal\b/i.test(value) && all.length && all.length % 2 === 0) {
    return all.filter((_, index) => index % 2 === 1).map(item => item.value);
  }
  return [];
}

export function parseNutritionLabel(raw) {
  const text = typeof raw === 'string' ? raw.normalize('NFKC').replace(/\r/g, '').replace(/\u00a0/g, ' ').slice(0, 100000) : '';
  const lines = text.split(/\n|;/).map(line => line.trim()).filter(Boolean);
  const nutrients = empty(), evidence = {}, warnings = [];
  const firstRow = lines.findIndex(line => Object.values(labels).some(pattern => pattern.test(line)) && /\d/.test(line));
  const header = lines.slice(0, firstRow < 0 ? lines.length : firstRow).join(' ');
  // Include a per-100 declaration on the first numeric row, when present.
  const basisText = header + ' ' + (firstRow < 0 ? '' : (lines[firstRow].match(/(?:per\s+)?100\s*(?:ml|g|gr|grammi|millilitri)\b/i)?.[0] || ''));
  const bases = [...basisText.matchAll(unitPattern)];
  const units = new Set(bases.map(match => normalizedUnit(match[1])));
  const unit = units.size === 1 ? [...units][0] : null;
  let column = null;
  if (unit) {
    const per100 = bases[0].index;
    const serving = /\b(?:per\s+)?(?:porzione|porzioni|serving)\b|\bper\s+(?!100\b)\d+(?:[.,]\d+)?\s*(?:g|ml)\b/i.exec(basisText);
    column = serving ? (serving.index < per100 ? 1 : 0) : 0;
  }
  if (!unit) warnings.push(units.size > 1 ? 'Sono presenti sia grammi sia millilitri: scegli la colonna e l’unità sulla confezione.' : 'Non è chiaro se i valori siano per 100 g o 100 ml: inseriscili dalla confezione.');
  for (const key of KEYS) {
    const candidates = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!labels[key].test(line)) continue;
      if ((key === 'fat' && /\bsatur/i.test(line.slice(0, line.search(/\d/)))) ||
          (key === 'carbs' && /\b(?:di\s+cui|zuccheri|sugars?)\b/i.test(line.slice(0, line.search(/\d/))))) continue;
      let row = line;
      const next = lines[index + 1];
      if (next && !Object.values(labels).some(pattern => pattern.test(next)) && /^(?:\d|<|kcal\b|k[jJ]\b)/.test(next)) row += ' ' + next;
      const values = rowValues(row, key);
      const hasServing = /\b(?:porzione|porzioni|serving)\b|\bper\s+(?!100\b)\d+(?:[.,]\d+)?\s*(?:g|ml)\b/i.test(basisText);
      // Multiple values without a labelled column order are deliberately ambiguous.
      if (!unit || !values.length || (values.length > 1 && (!hasServing || values.length !== 2))) continue;
      const value = values.length === 1 ? (hasServing ? null : values[0]) : values[column];
      const maximum = key !== 'kcal' && unit === 'g' ? 100 : 1000;
      if (value !== null && Number.isFinite(value) && value >= 0 && value <= maximum) candidates.push({value, row});
    }
    const distinct = new Set(candidates.map(candidate => candidate.value));
    if (distinct.size === 1) {
      nutrients[key] = candidates[0].value;
      evidence[key] = candidates[0].row;
    } else if (distinct.size > 1) warnings.push(`Più letture diverse per ${key === 'kcal' ? 'le kcal' : key === 'protein' ? 'le proteine' : key === 'carbs' ? 'i carboidrati' : 'i grassi'}: controlla la confezione.`);
  }
  const missing = KEYS.filter(key => nutrients[key] === null);
  if (missing.length) warnings.push('I campi non riconosciuti con certezza restano vuoti.');
  return {unit, nutrients, evidence, missing, warnings};
}

const asset = path => new URL(`./vendor/tesseract/${path}`, import.meta.url).href;
export const OCR_ASSETS = {
  runtime: asset('tesseract.min.js'),
  worker: asset('worker.min.js'),
  core: asset('core/'),
  language: asset(''),
};
let runtimePromise;
function loadRuntime() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  if (runtimePromise) return runtimePromise;
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OCR_ASSETS.runtime;
    script.onload = () => globalThis.Tesseract?.createWorker ? resolve(globalThis.Tesseract) : reject(new Error('Motore OCR non disponibile.'));
    script.onerror = () => {script.remove();reject(new Error('Il lettore non è ancora disponibile offline. Collegati una volta e riprova.'));};
    document.head.append(script);
  }).catch(error => {runtimePromise = null;throw error;});
  return runtimePromise;
}
const interrupted = () => new DOMException('Lettura annullata.', 'AbortError');

export function createLabelOCR({onProgress = () => {}, engineLoader = loadRuntime, timeout = 120000} = {}) {
  let current = null;
  function cancel() {
    if (!current) return;
    current.cancelled = true;
    current.reject(interrupted());
    current.worker?.terminate().catch(() => {});
  }
  async function recognize(file) {
    cancel();
    if (!file || !/^image\/(?:jpeg|png|webp|bmp)$/.test(file.type)) throw new Error('Usa una foto JPEG, PNG, WebP o BMP. Puoi esportare una foto HEIC come JPEG.');
    if (file.size > 15000000) throw new Error('La foto supera 15 MB. Ritaglia l’etichetta o scegli una foto più piccola.');
    const state = {cancelled: false, worker: null, reject: null};
    const cancellation = new Promise((_, reject) => {state.reject = reject;});
    current = state;
    const timer = setTimeout(() => {state.cancelled = true;state.reject(new Error('La lettura impiega troppo tempo. Ritaglia l’etichetta e riprova.'));state.worker?.terminate().catch(() => {});}, timeout);
    const work = (async () => {
      onProgress({status: 'loading', progress: 0});
      const engine = await engineLoader();
      if (state.cancelled) throw interrupted();
      const worker = await engine.createWorker('ita', 1, {
        workerPath: OCR_ASSETS.worker,
        corePath: OCR_ASSETS.core,
        langPath: OCR_ASSETS.language,
        workerBlobURL: false,
        gzip: false,
        cacheMethod: 'none',
        logger: message => {if (!state.cancelled) onProgress(message);},
      });
      state.worker = worker;
      // Cancellation during initialization still disposes the eventual worker.
      if (state.cancelled) {await worker.terminate();throw interrupted();}
      await worker.setParameters({preserve_interword_spaces: '1', user_defined_dpi: '300'});
      const result = await worker.recognize(file, {}, {text: true});
      if (state.cancelled) throw interrupted();
      const text = result.data?.text || '';
      return {text, confidence: result.data?.confidence ?? null, candidates: parseNutritionLabel(text)};
    })();
    try {return await Promise.race([work, cancellation]);}
    catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new Error(error?.message?.includes('foto') || error?.message?.includes('tempo') ? error.message : 'Impossibile leggere la foto. Al primo utilizzo serve una connessione per scaricare il lettore; puoi inserire i valori a mano.');
    } finally {
      clearTimeout(timer);
      if (state.worker) await state.worker.terminate().catch(() => {});
      if (current === state) current = null;
    }
  }
  return {recognize, cancel};
}
