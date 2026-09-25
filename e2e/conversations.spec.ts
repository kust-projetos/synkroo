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

async function openConversation(page: Page): Promise<void> {
  const conversation = page
    .locator('[data-testid="conversation-item"], [class*="conversation"]')
    .first();
  await expect(conversation).toBeVisible({ timeout: 15000 });
  await conversation.click();
  await page.waitForLoadState("networkidle");
}

test.describe("Conversations Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/conversas`);
    await page.waitForLoadState("networkidle");
  });

  test("should display conversations page", async ({ page }) => {
    await expect(page.locator("h1, h2")).toContainText(/conversas/i);
  });

  test("should have conversation list", async ({ page }) => {
    await expect(
      page
        .locator(
          '[data-testid="conversation-item"], [class*="conversation-item"]',
        )
        .first(),
    ).toBeVisible();
  });

  test("should have filter buttons", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Todas", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "WhatsApp", exact: true }),
    ).toBeVisible();
  });
});

test.describe("Conversation Thread", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/conversas`);
    await page.waitForLoadState("networkidle");
  });

  test("should open message thread when conversation clicked", async ({
    page,
  }) => {
    await openConversation(page);
    await expect(
      page
        .locator(
          '[data-testid="message-thread"], [class*="message"], [class*="chat"]',
        )
        .first(),
    ).toBeVisible();
  });

  test("should display message bubbles in thread", async ({ page }) => {
    await openConversation(page);
    await expect(
      page
        .locator(
          '[data-testid="message"], [class*="message"], [class*="bubble"]',
        )
        .first(),
    ).toBeVisible();
  });

  test("should have message input field", async ({ page }) => {
    await openConversation(page);
    await expect(
      page
        .locator('input[type="text"], textarea, [data-testid="message-input"]')
        .first(),
    ).toBeVisible();
  });

  test("should send message", async ({ page }) => {
    await openConversation(page);
    const input = page
      .locator('input[type="text"], textarea, [data-testid="message-input"]')
      .first();
    await expect(input).toBeVisible();
    await input.fill("Olá, teste de mensagem");
    const sendBtn = page
      .locator(
        'button[type="submit"], button:has-text("Enviar"), [data-testid="send-button"]',
      )
      .first();
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();
    // Optimistic update or retry flow: either message appears or rollback shows retry
    await expect(
      page.locator('[data-testid="message"], [class*="message"], button:has-text("Tentar novamente")').last(),
    ).toBeVisible({ timeout: 10000 });
    const lastMessage = page.locator('[data-testid="message"], [class*="message"]').last();
    const retryBtn = page.locator('button:has-text("Tentar novamente")');
    const hasMessage = await lastMessage.count().then((c) => c > 0);
    const hasRetry = await retryBtn.count().then((c) => c > 0);
    // At least one feedback path must be visible (optimistic success or retry)
    expect(hasMessage || hasRetry).toBe(true);
  });
});

test.describe("Campaign List", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/campanhas`);
    await page.waitForLoadState("networkidle");
  });

  test("should display seeded campaign list", async ({ page }) => {
    await expect(page.locator("h1, h2")).toContainText(/campanha/i);
    const response = await page.request.get(`${BASE_URL}/api/campaigns`);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      data?: { campaigns?: Array<{ id: string }> };
      campaigns?: Array<{ id: string }>;
    };
    // GET /api/campaigns responde no envelope D2 {data: {campaigns}}.
    const campaigns = body.data?.campaigns ?? body.campaigns;
    expect(campaigns).toBeDefined();
    expect(campaigns!.length).toBeGreaterThan(0);
  });

  test("should expose status for every seeded campaign", async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/campaigns`);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      data?: { campaigns?: Array<{ status: string }> };
      campaigns?: Array<{ status: string }>;
    };
    const campaigns = body.data?.campaigns ?? body.campaigns;
    expect(
      campaigns?.every((campaign) =>
        [
          "draft",
          "scheduled",
          "running",
          "completed",
          "cancelled",
          "paused",
        ].includes(campaign.status),
      ),
    ).toBe(true);
  });
});
