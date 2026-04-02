import { test, expect } from '@playwright/test';

// Use a shared state to pass the created case name
let uniqueCaseTitle = `E2E Test Dossier ${Date.now()}`;

test.describe('CRUD Flow for Cases', () => {

  test.beforeEach(async ({ page }) => {
    // Login before each test in this describe block
    await page.goto('/');
    await page.locator('input[type="email"]').fill('admin@oris.local');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /Se connecter|Login/i }).click();
    await expect(page.getByRole('heading', { name: /Dossiers/i })).toBeVisible({ timeout: 10000 });
  });

  test('Test 2: should create a new case', async ({ page }) => {
    // Click on "Nouveau dossier"
    const newBtn = page.getByRole('button', { name: /Nouveau dossier/i }).first();
    await newBtn.click();

    // Fill the form
    await expect(page.getByRole('heading', { name: /Créer un nouveau dossier/i })).toBeVisible();
    await page.getByLabel(/Titre du dossier/i).fill(uniqueCaseTitle);
    
    // Choose Severity
    await page.getByLabel(/Niveau de sévérité/i).selectOption('high');
    
    // Fill description
    await page.getByLabel(/Description/i).first().fill('Test description from Playwright');
    
    // Click Create
    await page.getByRole('button', { name: /Créer le dossier/i }).click();

    // Check we get redirected back to cases list (or to the specific case)
    // Assuming redirection to the new case detail or back to the list where it appears
    await expect(page.getByText(uniqueCaseTitle)).toBeVisible({ timeout: 15000 });
  });

  test('Test 3: should edit the newly created case', async ({ page }) => {
    // Find the case and open it
    await page.getByText(uniqueCaseTitle).first().click();
    
    // Should be in Case detail, wait for title
    await expect(page.getByRole('heading', { name: uniqueCaseTitle })).toBeVisible({ timeout: 10000 });
    
    // Click on edit (usually an icon or "Modifier")
    // Use generic accessible approach to find the edit button in header
    const editBtn = page.getByRole('button', { name: /Modifier/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    } else {
      // Fallback if it's an icon without text but has an aria-label
      await page.locator('button[aria-label="Modifier"], button[title="Modifier"]').first().click();
    }

    const modifiedTitle = `${uniqueCaseTitle} - Edited`;
    await page.getByLabel(/Titre du dossier/i).fill(modifiedTitle);
    await page.getByRole('button', { name: /Mettre à jour/i }).click();

    uniqueCaseTitle = modifiedTitle;
    await expect(page.getByRole('heading', { name: uniqueCaseTitle })).toBeVisible({ timeout: 10000 });
  });

  test('Test 4: should close the edited case', async ({ page }) => {
    // Same approach, open the case
    await page.getByText(uniqueCaseTitle).first().click();
    await expect(page.getByRole('heading', { name: uniqueCaseTitle })).toBeVisible({ timeout: 10000 });

    // Open closure modal
    const closeBtn = page.getByRole('button', { name: /Clôturer/i });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.locator('button[aria-label*="Clôturer"], button[title*="Clôturer"]').first().click();
    }
    
    await expect(page.getByRole('heading', { name: /Clôturer le dossier/i })).toBeVisible();
    
    const summaryInput = page.getByLabel(/Synthèse de clôture \*/i);
    await summaryInput.fill('This case was successfully resolved in E2E tests.');
    
    const confirmBtn = page.getByRole('button', { name: /Clôturer définitivement/i });
    await confirmBtn.click();

    // Verify it is closed (e.g. status badge changes to "Clôturé" or it redirects to list)
    await expect(page.getByText(/Clôturé/i).first()).toBeVisible({ timeout: 10000 });
  });
});
