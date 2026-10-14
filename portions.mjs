const MAX_PORTIONS = 20;
const MAX_QUANTITY = 10000;

// A portion always uses its food's unit. It cannot carry a separate g/ml unit.
export function validPortions(portions) {
  if (portions === undefined) return true;
  if (!Array.isArray(portions) || portions.length > MAX_PORTIONS) return false;
  const names = new Set();
  return portions.every(portion => {
    if (!portion || typeof portion.name !== 'string' || !portion.name.trim() || portion.name.length > 60 ||
      typeof portion.quantity !== 'number' || !Number.isFinite(portion.quantity) ||
      portion.quantity <= 0 || portion.quantity > MAX_QUANTITY || Object.hasOwn(portion, 'unit')) return false;
    const name = portion.name.trim().toLocaleLowerCase('it');
    if (names.has(name)) return false;
    names.add(name);
    return true;
  });
}

export function portionQuantity(portion, count) {
  const value = String(count).trim().replace(',', '.');
  if (!validPortions([portion]) || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const quantity = portion.quantity * Number(value);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= MAX_QUANTITY ? quantity : null;
}
