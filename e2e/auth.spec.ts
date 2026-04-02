import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('Test 1: should login successfully and see the cases list', async ({ page }) => {
    // Navigate to local app
    await page.goto('/');
    
    await expect(page).toHaveTitle(/ORIS/);

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('admin@oris.local'); // Default dev credentials
    
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('admin123');

    const loginBtn = page.getByRole('button', { name: /Se connecter|Login/i });
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();

    // After login, we should be redirected to the cases page
    await expect(page.getByRole('heading', { name: /Dossiers/i })).toBeVisible({ timeout: 10000 });
  });
});
