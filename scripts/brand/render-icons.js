// Renders the app's icons from SVG with the preinstalled Chromium.
// Usage: node scripts/brand/render-icons.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const GOLD = '#D4B06A';
const INK = '#14112A';
const FACE = '#1F1B3D';

// A pocket watch at seven o'clock: the White Rabbit's watch, set to Before Breakfast.
function watch({ cx = 512, cy = 540, r = 300, colour = GOLD, face = FACE, mono = false }) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const long = i % 3 === 0;
    const r1 = r * (long ? 0.72 : 0.78), r2 = r * 0.86;
    return `<line x1="${cx + r1 * Math.sin(a)}" y1="${cy - r1 * Math.cos(a)}" x2="${cx + r2 * Math.sin(a)}" y2="${cy - r2 * Math.cos(a)}" stroke="${colour}" stroke-width="${long ? r * 0.06 : r * 0.035}" stroke-linecap="round"/>`;
  }).join('');
  const hourA = (210 * Math.PI) / 180;
  const hx = cx + r * 0.45 * Math.sin(hourA), hy = cy - r * 0.45 * Math.cos(hourA);
  return `
    <circle cx="${cx}" cy="${cy - r - r * 0.17}" r="${r * 0.15}" fill="none" stroke="${colour}" stroke-width="${r * 0.07}"/>
    <rect x="${cx - r * 0.09}" y="${cy - r - r * 0.06}" width="${r * 0.18}" height="${r * 0.12}" rx="${r * 0.03}" fill="${colour}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${mono ? 'none' : face}" stroke="${colour}" stroke-width="${r * 0.1}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="none" stroke="${colour}" stroke-width="${r * 0.015}" opacity="0.6"/>
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}" stroke="${colour}" stroke-width="${r * 0.075}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r * 0.68}" stroke="${colour}" stroke-width="${r * 0.05}" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.07}" fill="${colour}"/>`;
}

// A sitting rabbit seen side-on, drawn from simple shapes.
function rabbit(colour) {
  return `
    <g fill="${colour}" transform="translate(8,12) scale(0.88)">
      <ellipse cx="60" cy="72" rx="34" ry="24"/>
      <circle cx="88" cy="46" r="17"/>
      <ellipse cx="84" cy="18" rx="6" ry="20" transform="rotate(-12 84 18)"/>
      <ellipse cx="96" cy="20" rx="5.5" ry="19" transform="rotate(10 96 20)"/>
      <circle cx="27" cy="66" r="9"/>
      <ellipse cx="80" cy="92" rx="16" ry="5"/>
    </g>
    <circle cx="94" cy="43" r="2.6" fill="${INK}" transform="translate(8,12) scale(0.88)"/>`;
}

const svg = (w, h, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}</svg>`;

const scaleWatch = (size, frac, opts = {}) =>
  `<g transform="scale(${size / 1024})">${watch({ r: 300 * frac, cy: 512 + 300 * frac * 0.09, ...opts })}</g>`;

const jobs = [
  ['assets/icon.png', 1024, 1024, svg(1024, 1024, scaleWatch(1024, 1.0), INK)],
  ['assets/android-icon-background.png', 1024, 1024, svg(1024, 1024, '', INK)],
  ['assets/android-icon-foreground.png', 1024, 1024, svg(1024, 1024, scaleWatch(1024, 0.78))],
  ['assets/android-icon-monochrome.png', 1024, 1024, svg(1024, 1024, scaleWatch(1024, 0.78, { colour: '#FFFFFF', mono: true }))],
  ['assets/splash-icon.png', 1024, 1024, svg(1024, 1024, scaleWatch(1024, 1.0))],
  ['assets/favicon.png', 48, 48, svg(1024, 1024, scaleWatch(1024, 1.0), INK).replace('width="1024" height="1024"', 'width="48" height="48"')],
  ['assets/notification-icon.png', 96, 96, svg(96, 96, scaleWatch(96, 1.0, { colour: '#FFFFFF', mono: true }))],
  ['assets/brand/rabbit.png', 120, 120, svg(120, 120, rabbit(GOLD))],
  ['public/apple-touch-icon.png', 180, 180, svg(180, 180, scaleWatch(180, 1.0), INK)],
  ['public/icon-512.png', 512, 512, svg(512, 512, scaleWatch(512, 1.0), INK)],
  ['public/icon-192.png', 192, 192, svg(192, 192, scaleWatch(192, 1.0), INK)],
];

(async () => {
  const root = path.join(__dirname, '..', '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [out, w, h, markup] of jobs) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace(/width="1024" height="1024" viewBox/, `width="${w}" height="${h}" viewBox`)}</body></html>`);
    const file = path.join(root, out);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    console.log('wrote', out);
  }
  await browser.close();
})();
