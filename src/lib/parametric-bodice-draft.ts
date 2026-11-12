/**
 * Parametric half-front basic bodice draft.
 *
 * Units: inputs in centimetres; SVG geometry in millimetres (1 SVG unit = 1 mm).
 * This is an educational starter block, not a production-ready fitting system.
 */
export interface FrontBodiceMeasurements {
  bustCm: number;
  waistCm: number;
  bodiceLengthCm: number;
  shoulderCm: number;
  easeCm?: number;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

export function generateFrontBodiceSvg(m: FrontBodiceMeasurements): string {
  const bust = positive("bustCm", m.bustCm) * 10;
  const waist = positive("waistCm", m.waistCm) * 10;
  const length = positive("bodiceLengthCm", m.bodiceLengthCm) * 10;
  const shoulder = positive("shoulderCm", m.shoulderCm) * 10;
  const ease = m.easeCm === undefined ? 80 : positive("easeCm", m.easeCm) * 10;

  // Quarter body circumferences create one half-front panel folded at centre front.
  const chestWidth = bust / 4 + ease / 4;
  const waistWidth = waist / 4 + ease / 4;
  const shoulderDrop = Math.min(length * 0.12, 35);
  const neckWidth = Math.min(75, shoulder * 0.48);
  const neckDepth = Math.min(85, length * 0.2);
  const armholeDepth = Math.min(length * 0.42, Math.max(170, chestWidth * 0.72));
  const width = Math.max(chestWidth, waistWidth) + 100;
  const height = length + 120;
  const left = 50;
  const top = 45;
  const sideX = left + chestWidth;
  const waistX = left + waistWidth;
  const shoulderX = left + neckWidth + shoulder;
  const shoulderY = top + shoulderDrop;
  const chestY = top + armholeDepth;
  const hemY = top + length;

  const path = [
    `M ${left} ${top + neckDepth}`,
    `Q ${left + neckWidth * 0.08} ${top + neckDepth * 0.15} ${left + neckWidth} ${top}`,
    `L ${shoulderX} ${shoulderY}`,
    `Q ${sideX + 35} ${shoulderY + 30} ${sideX} ${chestY}`,
    `L ${waistX} ${hemY}`,
    `L ${left} ${hemY}`,
    "Z",
  ].join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}mm" height="${Math.ceil(height)}mm" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}">
  <title>Parametric half-front basic bodice draft</title>
  <desc>Educational draft generated from bust, waist, shoulder, length and ease measurements.</desc>
  <rect width="100%" height="100%" fill="#fff"/>
  <path d="${path}" fill="#dceafe" fill-opacity=".55" stroke="#173b67" stroke-width="1.5"/>
  <path d="M ${left} ${top - 12} V ${hemY + 16}" stroke="#c2410c" stroke-width="1" stroke-dasharray="5 4"/>
  <text x="${left + 5}" y="${hemY + 32}" font-size="11" fill="#9a3412">Centre front / fold</text>
  <text x="${left + 8}" y="${top + neckDepth + 24}" font-size="11" fill="#173b67">Neckline</text>
  <text x="${sideX - 8}" y="${chestY - 12}" text-anchor="end" font-size="11" fill="#173b67">Armhole guide</text>
  <text x="${waistX - 5}" y="${hemY - 12}" text-anchor="end" font-size="11" fill="#173b67">Waist shaping guide</text>
  <text x="${left}" y="18" font-size="12" fill="#111827">Bust: ${m.bustCm} cm | Waist: ${m.waistCm} cm | Ease: ${ease / 10} cm</text>
  <text x="${left}" y="${hemY + 49}" font-size="10" fill="#6b7280">Starter block only — add darts, fitting and seam allowances before production.</text>
</svg>`;
}
