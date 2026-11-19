const VISIBLE_FLOOR = 0.8;

function portion(amount, goal) {
  if (amount <= 0 || goal <= 0) return 0;
  const pct = (amount / goal) * 100;
  if (pct >= 100) return 100;
  return pct < VISIBLE_FLOOR ? VISIBLE_FLOOR : pct;
}

export function fundingFill(raised, pending, goal) {
  const goalN = Number(goal);
  const raisedN = Math.max(0, Number(raised) || 0);
  const pendingN = Math.max(0, Number(pending) || 0);
  if (!Number.isFinite(goalN) || goalN <= 0) {
    return { confirmed: 0, waiting: 0, percent: 0 };
  }
  const trueConfirmed = Math.min(100, (raisedN / goalN) * 100);
  let confirmed = portion(raisedN, goalN);
  let waiting = portion(pendingN, goalN);
  if (confirmed >= 100) {
    confirmed = 100;
    waiting = 0;
  } else if (confirmed + waiting > 100) {
    waiting = 100 - confirmed;
  }
  const percent = trueConfirmed > 0 && trueConfirmed < 1
    ? Math.round(trueConfirmed * 10) / 10
    : Math.round(trueConfirmed);
  return { confirmed, waiting, percent };
}
