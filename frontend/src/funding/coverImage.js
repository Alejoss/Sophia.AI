export function coverObjectPosition(focalX, focalY) {
  const x = focalX == null ? 0.5 : Number(focalX);
  const y = focalY == null ? 0.5 : Number(focalY);
  const safeX = Number.isFinite(x) ? x : 0.5;
  const safeY = Number.isFinite(y) ? y : 0.5;
  return `${(safeX * 100).toFixed(1)}% ${(safeY * 100).toFixed(1)}%`;
}
