import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3003";

async function login(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`);
  if (!page.url().includes("/login")) return;
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", "admin@clinicademo.com");
  await page.fill("#password", "demo123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
}

test.describe("Campaigns", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/campanhas`);
    await page.waitForLoadState("networkidle");
  });

  test("shows factual page state and create action", async ({ page }) => {
    await expect(page.locator("h1, h2")).toContainText(/campanhas/i);
    await expect(
      page.getByRole("button", { name: "Criar Campanha", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("opens campaign wizard", async ({ page }) => {
    await page
      .getByRole("button", { name: "Criar Campanha", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Campaign wizard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/campanhas`);
    await page
      .getByRole("button", { name: "Criar Campanha", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("exposes campaign type and progression controls", async ({ page }) => {
    await expect(
      page.getByRole("heading", {
        name: "Selecione o tipo de campanha",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Proximo", exact: true }),
    ).toBeEnabled();
  });
});
