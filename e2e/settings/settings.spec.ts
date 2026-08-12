import { test, expect, Page } from "@playwright/test";
const BASE_URL = "http://127.0.0.1:3003";

async function login(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`);
  if (!page.url().includes("/login")) return;
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", "admin@clinicademo.com");
  await page.fill("#password", "demo123");
  await Promise.all([
    page.waitForURL("**/dashboard**"),
    page.click('button[type="submit"]'),
  ]);
}

const t = test.extend({});
t.describe("Settings Page", () => {
  t.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/configuracoes`);
    await page.waitForLoadState("networkidle");
  });
  t("renders page header", async ({ page }) => {
    await expect(page.locator('h1:has-text("Configurações")')).toBeVisible();
  });
  t("renders clinic form fields", async ({ page }) => {
    await expect(page.locator("text=Nome")).toBeVisible();
    await expect(page.locator("text=Telefone")).toBeVisible();
  });
  t("renders save button", async ({ page }) => {
    await expect(page.locator('button:has-text("Salvar")')).toBeVisible();
  });
});
