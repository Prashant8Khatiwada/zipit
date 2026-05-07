import { test, expect } from '@playwright/test';

test.describe('ZipIt E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock showSaveFilePicker
    await page.addInitScript(() => {
      (window as any).showSaveFilePicker = async () => ({
        createWritable: async () => ({
          write: async () => {},
          close: async () => {},
          writeChunk: async () => {}, // Some versions might use different methods
        }),
      });
    });

    // Mock network requests for files
    await page.route('**/test-file-1.txt', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Hello from file 1',
        headers: { 'Accept-Ranges': 'bytes' },
      });
    });

    await page.route('**/test-file-2.txt', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Hello from file 2',
        headers: { 'Accept-Ranges': 'bytes' },
      });
    });
  });

  test('Happy path: add 2 mock URLs and start ZIP download', async ({ page }) => {
    await page.goto('/app');

    const textarea = page.locator('textarea');
    await textarea.fill('https://example.com/test-file-1.txt\nhttps://example.com/test-file-2.txt');

    await page.click('text=Add to Queue');

    // Verify files are in the list (ZipItUI shows file IDs which are random in my Downloader.tsx)
    // Actually, I derive filename from URL.
    await expect(page.locator('text=test-file-1.txt')).toBeVisible();
    await expect(page.locator('text=test-file-2.txt')).toBeVisible();

    // Start download
    await page.click('text=Start ZIP Download');

    // Verify progress appears
    await expect(page.locator('text=downloading')).first().toBeVisible();

    // Eventually it should be done
    await expect(page.locator('text=done')).toHaveCount(2, { timeout: 10000 });
    await expect(page.locator('text=Completed')).toBeVisible();
  });

  test('Resume: simulate page reload mid-download', async ({ page }) => {
    await page.goto('/app');

    // Set up a slow download or just start it and reload
    await page.route('**/slow-file.txt', async (route) => {
      // Don't fulfill immediately
    });

    const textarea = page.locator('textarea');
    await textarea.fill('https://example.com/slow-file.txt');
    await page.click('text=Add to Queue');
    await page.click('text=Start ZIP Download');

    // Reload page
    await page.reload();

    // Verify recovery banner appears
    await expect(page.locator('text=Interrupted session found')).toBeVisible();
    await expect(page.locator('button:has-text("Recover")')).toBeVisible();
  });

  test('Error handling: mock a 404 response', async ({ page }) => {
    await page.goto('/app');

    await page.route('**/missing.txt', async (route) => {
      await route.fulfill({ status: 404 });
    });

    const textarea = page.locator('textarea');
    await textarea.fill('https://example.com/missing.txt');
    await page.click('text=Add to Queue');
    await page.click('text=Start ZIP Download');

    // Verify error state
    await expect(page.locator('text=error')).toBeVisible();
  });
});
