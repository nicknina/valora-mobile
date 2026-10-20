const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const amount = Number(value);
  return `R$ ${formatadorMoeda.format(Number.isFinite(amount) ? amount : 0)}`;
}

export function formatCurrencyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const amount = Number(digits) / 100;
  return formatadorMoeda.format(amount);
}

export function formatCurrencyInputFromAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? formatadorMoeda.format(amount) : "";
}

export function parseCurrencyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}
