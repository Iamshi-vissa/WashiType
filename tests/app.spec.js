import { test, expect } from '@playwright/test';

// Fail any test that throws in the page.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => {
    throw error;
  });
});

test('home lays out font sheets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sheet').first()).toBeVisible();
  await expect(page.locator('.count')).toContainText(/\d[\d,]* fonts/);
});

test('a garbled link shows the not-found TV and keeps the page working', async ({ page }) => {
  // A garbled old-style link; /fonts/%E0%A4 itself is answered by the server (404 page on Vercel).
  await page.goto('/#%E0%A4');
  await expect(page.locator('.tv404')).toBeVisible();
  await expect(page.locator('.err-title')).toHaveText('No font by that name');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tv404')).toHaveCount(0);
  await expect(page.locator('.sheet').first()).toBeVisible();
});

test('a link to an unknown font offers to search for it', async ({ page }) => {
  await page.goto('/fonts/comic-sans-pro');
  await expect(page.locator('.err-title')).toHaveText('No font called “comic sans pro”');
  await page.locator('.err-actions .btn').click();
  await expect(page.locator('input[type=search]')).toHaveValue('comic sans pro');
});

test('an unreachable catalog shows the no-signal TV, and Try again recovers', async ({ page }) => {
  await page.route('**/fonts.json', route => route.fulfill({ status: 503, body: 'down' }));
  await page.goto('/');
  await expect(page.locator('.err-title')).toHaveText('The font list didn’t arrive', { timeout: 10000 });
  await page.unroute('**/fonts.json');
  await page.locator('.err-actions .btn').click();
  await expect(page.locator('.sheet').first()).toBeVisible();
});

test('a missing code file shows the crash TV instead of a blank page, and is reported', async ({ page }) => {
  const reports = [];
  await page.route('**/api/report', async route => {
    reports.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 204 });
  });
  await page.route('**/assets/SpecimenSheet-*.js', route => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/');
  await expect(page.locator('.sheet').first()).toBeVisible();
  await page.goto('/fonts/inter');
  await expect(page.locator('.err-title')).toHaveText('Inter couldn’t open', { timeout: 15000 });
  await expect.poll(() => reports.some(r => r.kind === 'chunk-load' && r.page === '/fonts/inter')).toBe(true);
});

test('stamps for fonts that left the catalog are forgotten', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('washitype:saved', JSON.stringify(['inter', 'gone-font'])));
  await page.reload();
  await expect(page.locator('.top .ghost')).toContainText('Stamped · 1');
});

test('fonts without Latin letters preview in their own script', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=search]').fill('Chenla');
  await expect(page.locator('.sheet-text').first()).toHaveText('សួស្តីមិត្តភក្តិ');
});

test('the 404 page shows the TV', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('h1')).toHaveText('This page isn’t on the desk');
  await expect(page.locator('.tv404')).toBeVisible();
});

test('a font sheet opens, crumples and closes', async ({ page }) => {
  await page.goto('/fonts/inter');
  const paper = page.locator('.paper-crumple');
  await expect(paper).toHaveAttribute('data-status', /ready|error/, { timeout: 20000 });
  if ((await paper.getAttribute('data-status')) === 'ready') {
    const box = await page.locator('.paper-crumple-hit').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(page.locator('.paper-crumple-hit[data-held=true]')).toHaveCount(1);
    await page.mouse.up();
  } else {
    // No WebGL in this browser: the specimen still shows as a flat picture.
    await expect(page.locator('.paper-crumple-fallback')).toBeVisible();
  }
  await page.locator('.close').click();
  await expect(page.locator('.spec')).toHaveCount(0);
});

test('every font has a real page with its own title and canonical link', async ({ request }) => {
  // Vercel serves this file at /fonts/inter; the local preview server needs the full name.
  const res = await request.get('/fonts/inter/index.html');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('<title>Inter: free sans serif font · Washi Type</title>');
  expect(html).toContain('<link rel="canonical" href="https://washi-type.vercel.app/fonts/inter" />');
  expect(html).toContain('<h1>Inter</h1>');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/fonts/inter</loc>');
});

test('cards are links; clicking one opens the sheet at its address, closing goes back', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.sheet-open').first();
  const href = await card.getAttribute('href');
  expect(href).toMatch(/^\/fonts\//);
  await card.click();
  await expect(page).toHaveURL(new RegExp(href + '$'));
  await expect(page.locator('.spec')).toBeVisible();
  await page.locator('.close').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.spec')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.spec')).toHaveCount(0);
});

test('old #links move to the new address', async ({ page }) => {
  await page.goto('/#inter');
  await expect(page).toHaveURL(/\/fonts\/inter$/);
  await expect(page.locator('.spec')).toBeVisible();
});

test('Escape smooths a crumpled sheet first, then closes it', async ({ page }) => {
  await page.goto('/fonts/inter');
  const paper = page.locator('.paper-crumple');
  await expect(paper).toHaveAttribute('data-status', /ready|error/, { timeout: 20000 });
  if ((await paper.getAttribute('data-status')) === 'ready') {
    const box = await page.locator('.paper-crumple-hit').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.keyboard.press('Escape'); // smooths the creases
    await expect(page.locator('.spec')).toBeVisible();
  }
  await page.keyboard.press('Escape'); // nothing left to smooth: closes
  await expect(page.locator('.spec')).toHaveCount(0);
});

test('a ?q= link fills the search and leaves a clean address', async ({ page }) => {
  await page.goto('/?q=noto%20sans');
  await expect(page.locator('input[type=search]')).toHaveValue('noto sans');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.count')).toContainText(/\d[\d,]* fonts?/);
});

test('one bad family in a Google Fonts batch does not blank the rest', async ({ page }) => {
  const singles = new Set();
  await page.route('https://fonts.googleapis.com/css2?**', route => {
    const families = new URL(route.request().url()).searchParams.getAll('family');
    if (families.length > 1) return route.fulfill({ status: 400, body: 'bad request' });
    singles.add(families[0]);
    return route.fulfill({ status: 200, contentType: 'text/css', body: '/* ok */' });
  });
  await page.goto('/');
  await expect(page.locator('.sheet').first()).toBeVisible();
  await expect.poll(() => singles.size, { timeout: 10000 }).toBeGreaterThan(1);
});

test('the 404 page for an unknown font offers to search for it', async ({ page, request }) => {
  // On Vercel, /fonts/<unknown> gets 404.html with a 404 status; the local preview server
  // would answer with the app instead, so serve 404.html at that address the same way.
  const notFound = await (await request.get('/404.html')).text();
  await page.route('**/fonts/comic-sans-pro', route => route.fulfill({ status: 404, contentType: 'text/html', body: notFound }));
  await page.goto('/fonts/comic-sans-pro');
  await expect(page.locator('.err-title')).toHaveText('No font called “comic sans pro”');
  await page.getByRole('link', { name: 'Search for “comic sans pro”' }).click();
  await expect(page.locator('input[type=search]')).toHaveValue('comic sans pro');
  await expect(page).toHaveURL(/\/$/);
});

test('the On/Off switch changes the theme, and the choice survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  await expect(toggle).not.toBeChecked();
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await background();
  // Click the visible switch, as a visitor would (the checkbox inside is visually hidden).
  await page.locator('.theme-switch').click();
  await expect(toggle).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await background()).not.toBe(light);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  // Keyboard: Space flips it back.
  await page.getByRole('switch', { name: 'Dark mode' }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await background()).toBe(light);
});

test('with no choice saved, the switch follows the device', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});

test('Download font saves a zip of the desktop files with the licence', async ({ page }) => {
  // Stand-in font files, so the test doesn't depend on GitHub or jsDelivr.
  await page.route('https://raw.githubusercontent.com/google/fonts/**', route =>
    route.fulfill({ status: 200, contentType: 'font/ttf', body: `file:${new URL(route.request().url()).pathname}` })
  );
  await page.goto('/fonts/inter');
  const button = page.locator('.spec .actions .btn').first();
  await expect(button).toHaveText('Download font');
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(download.suggestedFilename()).toBe('Inter.zip');
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(await (await import('node:fs/promises')).readFile(await download.path())));
  expect(Object.keys(files).sort()).toEqual(
    ['Inter/Inter-Italic[opsz,wght].ttf', 'Inter/Inter[opsz,wght].ttf', 'Inter/OFL.txt', 'READ ME.txt'].sort()
  );
  expect(strFromU8(files['READ ME.txt'])).toContain('SIL Open Font License');
  await expect(button).toHaveText('Downloaded · get it again');
});

test('fonts from other foundries download one TTF per weight and style', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/fontsource/fonts/**', route =>
    route.fulfill({ status: 200, contentType: 'font/ttf', body: 'ttf' })
  );
  await page.goto('/fonts/adwaita-mono');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.spec .actions .btn').first().click()]);
  const { unzipSync } = await import('fflate');
  const files = unzipSync(new Uint8Array(await (await import('node:fs/promises')).readFile(await download.path())));
  expect(Object.keys(files).filter(name => name.endsWith('.ttf')).sort()).toEqual([
    'Adwaita Mono/AdwaitaMono-400.ttf',
    'Adwaita Mono/AdwaitaMono-400Italic.ttf',
    'Adwaita Mono/AdwaitaMono-700.ttf',
    'Adwaita Mono/AdwaitaMono-700Italic.ttf'
  ]);
});

test('a failed download says so and offers the source instead', async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/google/fonts/**', route => route.fulfill({ status: 503, body: '' }));
  await page.goto('/fonts/inter');
  await page.locator('.spec .actions .btn').first().click();
  await expect(page.locator('.download-note .err')).toContainText('didn’t finish');
  await expect(page.locator('.download-note .err a')).toHaveAttribute('href', /fonts\.google\.com\/specimen\/Inter/);
});

test('Fontshare fonts link to Fontshare for the download', async ({ page }) => {
  await page.goto('/fonts/satoshi');
  await expect(page.locator('.spec .actions a.btn')).toHaveText('Download from Fontshare');
  await expect(page.locator('.spec .actions a.btn')).toHaveAttribute('href', /fontshare\.com\/fonts\/satoshi/);
});

// "What font is this?" runs on the device and fetches the closest fonts to draw them. The
// test serves one real font (Arvo, OFL, tests/fixtures) and refuses every other font
// stylesheet, so it doesn't depend on Google Fonts and finishes quickly.
async function serveOnlyArvo(page) {
  const { readFile } = await import('node:fs/promises');
  const arvo = await readFile(new URL('./fixtures/arvo-latin-400-normal.woff2', import.meta.url));
  await page.route('https://fixtures.test/arvo.woff2', route =>
    route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: arvo })
  );
  await page.route('https://fonts.googleapis.com/css2?**', route => {
    const families = new URL(route.request().url()).searchParams.getAll('family');
    if (families.length === 1 && families[0].startsWith('Arvo')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: "@font-face{font-family:'Arvo';font-weight:400;src:url(https://fixtures.test/arvo.woff2) format('woff2')}"
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  for (const host of ['https://cdn.jsdelivr.net/npm/@fontsource/**', 'https://api.fontshare.com/**']) {
    await page.route(host, route => route.fulfill({ status: 404, body: '' }));
  }
}

/** A picture of some lettering in Arvo, as PNG bytes. */
async function arvoPicture(page, text) {
  const url = await page.evaluate(async text => {
    const face = new FontFace('Arvo picture', 'url(https://fixtures.test/arvo.woff2)');
    document.fonts.add(await face.load());
    const canvas = Object.assign(document.createElement('canvas'), { width: 900, height: 260 });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2a211a';
    ctx.font = '64px "Arvo picture"';
    ctx.fillText(text, 60, 150);
    return canvas.toDataURL('image/png');
  }, text);
  return Buffer.from(url.split(',')[1], 'base64');
}

test('What font is this? finds the font in a picture, on the device', async ({ page }) => {
  test.setTimeout(90000);
  await serveOnlyArvo(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'What font is this?' }).click();
  const dialog = page.getByRole('dialog', { name: 'What font is this?' });
  await expect(dialog).toBeVisible();
  // Nothing is uploaded: count requests carrying the picture.
  const uploads = [];
  page.on('request', req => req.method() !== 'GET' && !req.url().includes('/api/report') && uploads.push(req.url()));
  await dialog.locator('input[type=file]').setInputFiles({ name: 'sign.png', mimeType: 'image/png', buffer: await arvoPicture(page, 'Handgloves') });
  await expect(dialog.locator('.detect-view canvas')).toBeVisible();
  await dialog.getByLabel('What does it say?').fill('Handgloves');
  await dialog.getByRole('button', { name: 'Find the font' }).click();
  await expect(dialog.locator('.detect-results li').first().locator('.detect-name')).toHaveText(/^Arvo\b/, { timeout: 60000 });
  expect(uploads).toEqual([]);
  // Open goes to the font's sheet.
  await dialog.locator('.detect-results li').first().getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('.spec h2')).toHaveText('Arvo');
});

test('What font is this? explains what it needs', async ({ page }) => {
  await serveOnlyArvo(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'What font is this?' }).click();
  const dialog = page.getByRole('dialog', { name: 'What font is this?' });
  await dialog.getByRole('button', { name: 'Find the font' }).click();
  await expect(dialog.locator('.detect-status .err')).toHaveText('Add a picture first.');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(dialog.locator('.detect-status .err')).toContainText('isn’t a picture');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'sign.png', mimeType: 'image/png', buffer: await arvoPicture(page, 'Handgloves') });
  await dialog.getByRole('button', { name: 'Find the font' }).click();
  await expect(dialog.locator('.detect-status .err')).toContainText('Type what the lettering says');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
