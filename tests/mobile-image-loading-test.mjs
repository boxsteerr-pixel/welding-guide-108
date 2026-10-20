import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_BASE || 'http://127.0.0.1:4195/welding-guide-108/';
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().endsWith('.webp')) requests.push(request.url()); });
  await page.goto(base + '#section=faults');
  await page.waitForSelector('#fault-list details');
  assert.equal(requests.length, 0, 'collapsed entries must not request all images');
  const entry = page.locator('#fault-list details').first();
  await entry.locator('summary').click();
  const image = entry.locator('img').first();
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(img => img.decode());
  assert.ok((await image.getAttribute('src')).endsWith('.webp'));
  assert.ok(requests.length < 23, 'viewing one entry must not eagerly download all images');
  await image.click();
  await page.waitForFunction(() => !document.querySelector('#image-modal').hidden && document.querySelector('#modal-image').naturalWidth > 0);
  await page.locator('.image-modal__close').click();
  await page.screenshot({path: fileURLToPath(new URL('./mobile-image-loading.png', import.meta.url))});
  for (const viewport of [{width: 390, height: 844}, {width: 768, height: 1024}, {width: 1280, height: 900}]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at ' + viewport.width);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once: true}));
    navigator.serviceWorker.controller.postMessage({type: 'CACHE_MEDIA'});
  });
  await page.waitForFunction(() => document.querySelector('#offline-progress').textContent === '离线图片已就绪', {timeout: 45000});
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#fault-list details');
  const offlineCount = await page.evaluate(async () => {
    const m = await (await fetch('./data/manual.json')).json();
    const files = [...new Set([...m.faults, ...m.maintenance].flatMap(x => x.procedure || []).map(x => x.image && x.image.replace(/\.png$/, '.webp')).filter(Boolean))];
    for (const file of files) { const response = await fetch(file); if (!response.ok || (await response.arrayBuffer()).byteLength === 0) throw Error(file); }
    return files.length;
  });
  assert.equal(offlineCount, 23);
  await context.close();
  const retryContext = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
  const retryPage = await retryContext.newPage();
  let fail = true;
  await retryPage.route('**/chiller-overview.webp', route => fail ? route.abort() : route.continue());
  await retryPage.goto(base + '#section=faults');
  await retryPage.locator('#fault-list details').first().locator('summary').click();
  const retryImage = retryPage.locator('#fault-list details').first().locator('img').first();
  await retryImage.scrollIntoViewIfNeeded();
  const retryButton = retryPage.locator('#fault-list details').first().locator('.image-retry').first();
  await retryButton.waitFor({state: 'visible'});
  fail = false; await retryButton.click();
  await retryPage.waitForFunction(() => document.querySelector('#fault-list img').naturalWidth > 0);
  assert.ok(await retryButton.isHidden());
  assert.deepEqual(errors, []);
  await retryContext.close();
  console.log('PASS: Chrome mobile 390px/tablet 768px/desktop 1280px; visible-image loading, modal, retry after failure, all 23 images available after real browser offline reload.');
} finally { await browser.close(); }
