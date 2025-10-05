const toNumber = (value) => {
  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return NaN;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return round(value, digits).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const safeDivide = (numerator, denominator) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
};

export { formatNumber, round, safeDivide, toNumber };
