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
  await page.goto('/#%E0%A4');
  await expect(page.locator('.tv404')).toBeVisible();
  await expect(page.locator('.err-title')).toHaveText('No font by that name');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tv404')).toHaveCount(0);
  await expect(page.locator('.sheet').first()).toBeVisible();
});

test('a link to an unknown font offers to search for it', async ({ page }) => {
  await page.goto('/#comic-sans-pro');
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

test('a missing code file shows the crash TV instead of a blank page', async ({ page }) => {
  await page.route('**/assets/SpecimenSheet-*.js', route => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/');
  await expect(page.locator('.sheet').first()).toBeVisible();
  await page.goto('/#inter');
  await expect(page.locator('.err-title')).toHaveText('Inter couldn’t open', { timeout: 15000 });
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
  await page.goto('/#inter');
  await expect(page.locator('.paper-crumple[data-status=ready]')).toBeVisible({ timeout: 20000 });
  const box = await page.locator('.paper-crumple-hit').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('.paper-crumple-hit[data-held=true]')).toHaveCount(1);
  await page.mouse.up();
  await page.locator('.close').click();
  await expect(page.locator('.spec')).toHaveCount(0);
});
