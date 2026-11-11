#!/usr/bin/env node
// Takes phone-sized screenshots of the app's web build, in light and dark mode,
// so a pull request can show what a change looks like.
//
// First:  npx expo export --platform web      (writes dist/)
// Then:   node scripts/screenshots.mjs --out shots --routes /,/archive,/race
//
// Options:
//   --out <folder>        where the PNGs go (default: shots)
//   --routes <a,b,c>      app routes to capture (default: /)
//   --storage '<json>'    values to put in the app's storage first, e.g. '{"reminder-enabled":"off"}'
//   --fresh               don't mark "Start here" as seen (shows the first-launch screen)
//   --wait <ms>           extra time to let each screen settle (default: 1500)
//   --full                capture the whole scrolling page, not just the first screen
//
// It uses Chrome if the machine has it, and otherwise downloads Chromium. Its one
// tool (playwright-core) is installed into node_modules/.cache, never into
// package.json, because changing package.json would force every reader to reinstall.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const out = resolve(opt('--out', 'shots'));
const routes = opt('--routes', '/').split(',').map((r) => r.trim()).filter(Boolean);
const settle = Number(opt('--wait', '1500'));
const storage = { ...(args.includes('--fresh') ? {} : { 'seen-start-v1': 'yes' }), ...JSON.parse(opt('--storage', '{}')) };
const dist = join(repo, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No web build found. Run: npx expo export --platform web');
  process.exit(1);
}
const base = (JSON.parse(readFileSync(join(repo, 'app.json'), 'utf8')).expo.experiments?.baseUrl ?? '').replace(/\/$/, '');

// playwright-core, kept out of package.json.
const tools = join(repo, 'node_modules', '.cache', 'curiouser-tools');
if (!existsSync(join(tools, 'node_modules', 'playwright-core'))) {
  mkdirSync(tools, { recursive: true });
  execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', tools, 'playwright-core@1'], { stdio: 'inherit' });
}
const { chromium } = createRequire(pathToFileURL(join(tools, 'package.json')))('playwright-core');

const chrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
if (!chrome) execFileSync('npx', ['--yes', 'playwright-core@1', 'install', 'chromium'], { cwd: tools, stdio: 'inherit' });

// A tiny server for dist/, at the same address the app expects when published.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base && path.startsWith(base)) path = path.slice(base.length);
  let file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html'); // single-page app
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(chrome ? { executablePath: chrome } : {}), args: ['--no-sandbox'] });
const made = [];
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });
  await context.addInitScript((values) => {
    for (const [k, v] of Object.entries(values)) window.localStorage.setItem(k, v);
  }, storage);
  for (const route of routes) {
    const page = await context.newPage();
    await page.goto(`${origin}${base}${route === '/' ? '/' : route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(settle);
    const name = `${route === '/' ? 'today' : route.replace(/^\//, '').replace(/[^\w-]+/g, '-')}-${scheme}.png`;
    await page.screenshot({ path: join(out, name), fullPage: args.includes('--full') });
    made.push(name);
    await page.close();
  }
  await context.close();
}
await browser.close();
server.close();
console.log(`✓ ${made.length} screenshot(s) in ${out}:\n  ${made.join('\n  ')}`);
