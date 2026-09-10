export const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

export const purchaseStatusLabel = (status) => {
  if (status === 'PAID') return 'Pagado';
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'REFUNDED') return 'Reembolsado';
  return status;
};

export const packageTotalTokens = (pkg) => {
  if (!pkg) return 0;
  if (pkg.total_tokens != null) return Number(pkg.total_tokens);
  return Number(pkg.token_amount || 0) + Number(pkg.bonus_tokens || 0);
};

export const bestValuePackageId = (packages) => {
  if (!packages?.length || packages.length < 2) return null;
  const unitPrice = (pkg) => {
    const total = packageTotalTokens(pkg);
    const price = Number(pkg.usd_price || 0);
    if (total <= 0 || price <= 0) return Number.POSITIVE_INFINITY;
    return price / total;
  };
  const best = packages.reduce((a, b) => (unitPrice(b) < unitPrice(a) ? b : a));
  const worst = packages.reduce((a, b) => (unitPrice(b) > unitPrice(a) ? b : a));
  if (unitPrice(best) >= unitPrice(worst) - 1e-9) return null;
  return best.id;
};

export const packageTitle = (pkg) => {
  const amount = Number(pkg?.token_amount || 0);
  const fallback = `${amount} ${amount === 1 ? 'token' : 'tokens'}`;
  const name = (pkg?.name || '').trim();
  if (!name || name.toLowerCase() === fallback.toLowerCase()) return fallback;
  return name;
};

export const usdPerToken = (pkg) => {
  const amount = packageTotalTokens(pkg) || Number(pkg?.token_amount || 0);
  const price = Number(pkg?.usd_price || 0);
  if (amount <= 0 || price <= 0) return null;
  return price / amount;
};

export const checkoutFromPurchase = (purchase, pkg) => ({
  purchaseId: purchase.id,
  title: purchase.package_name || packageTitle(pkg || purchase),
  priceUsd: Number(purchase.usd_price || pkg?.usd_price || 0),
  tokenAmount: packageTotalTokens(purchase) || purchase.token_amount,
});
