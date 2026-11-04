import { test, expect } from "@playwright/test";
import type { BrowserContextOptions, Page } from "@playwright/test";
import {
  assertLocalDatabaseUrl,
  clearRateLimits,
} from "./helpers/reset-rate-limits.js";

function getWalletCardItem(page: Page, cardName: string, isMobile: boolean) {
  return isMobile
    ? page.getByRole("button", { name: new RegExp(cardName) })
    : page.getByRole("row", { name: new RegExp(cardName) });
}

test.describe("Sprint 1 E2E flow (Issue #14)", () => {
  test.describe.configure({ mode: "serial" });

  let userEmail = "";
  const userPassword = "Password123";
  let savedStorageState: BrowserContextOptions["storageState"];

  test.beforeEach(async () => {
    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://postgres:secret@db.abc.supabase.co:6543/postgres",
      ),
    ).toThrow(/not localhost or 127\.0\.0\.1/);
    await clearRateLimits();
  });

  test("AC1: sign up at /signup lands on Wallet with empty state", async ({
    page,
  }, testInfo) => {
    userEmail = `e2e+${testInfo.project.name}-${Date.now()}@test.dev`;

    await page.goto("/signup");

    await page.getByLabel("Name").fill("Priya Patel");
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password", { exact: true }).fill(userPassword);
    await page.getByLabel("Confirm password").fill(userPassword);

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/wallet$/);
    await expect(
      page.getByText("Add your first card to get started."),
    ).toBeVisible();

    savedStorageState = await page.context().storageState();
  });

  test("AC2: add Mint Everyday, Basic Flat, and Harbor Travel Plus to wallet and see all 3", async ({
    browser,
  }, testInfo) => {
    expect(savedStorageState).toBeDefined();
    const isMobile = testInfo.project.name === "mobile";
    const context = await browser.newContext({
      storageState: savedStorageState,
    });
    const page = await context.newPage();

    try {
      await page.goto("/wallet");
      await expect(
        page.getByText("Add your first card to get started."),
      ).toBeVisible();

      // Add Mint Everyday via empty-state "Add a card" button
      await page.getByRole("button", { name: "Add a card" }).click();
      const addDialog = page.getByRole("dialog", { name: "Add a card" });
      await expect(addDialog).toBeVisible();
      await addDialog.getByRole("button", { name: /Mint Everyday/ }).click();
      await addDialog.getByRole("button", { name: "Add to wallet" }).click();
      await expect(addDialog).toBeHidden();
      await expect(
        getWalletCardItem(page, "Mint Everyday", isMobile),
      ).toBeVisible();

      // Add Basic Flat via header "Add card" button
      await page.getByRole("button", { name: "Add card" }).click();
      await expect(addDialog).toBeVisible();
      await addDialog.getByRole("button", { name: /Basic Flat/ }).click();
      await addDialog.getByRole("button", { name: "Add to wallet" }).click();
      await expect(addDialog).toBeHidden();
      await expect(
        getWalletCardItem(page, "Basic Flat", isMobile),
      ).toBeVisible();

      // Add Harbor Travel Plus via header "Add card" button
      await page.getByRole("button", { name: "Add card" }).click();
      await expect(addDialog).toBeVisible();
      await addDialog
        .getByRole("button", { name: /Harbor Travel Plus/ })
        .click();
      await addDialog.getByRole("button", { name: "Add to wallet" }).click();
      await expect(addDialog).toBeHidden();

      // Verify all 3 show in the wallet
      await expect(
        getWalletCardItem(page, "Mint Everyday", isMobile),
      ).toBeVisible();
      await expect(
        getWalletCardItem(page, "Basic Flat", isMobile),
      ).toBeVisible();
      await expect(
        getWalletCardItem(page, "Harbor Travel Plus", isMobile),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("AC3: card number as a nickname shows error message and nothing is saved", async ({
    browser,
  }) => {
    expect(savedStorageState).toBeDefined();
    const context = await browser.newContext({
      storageState: savedStorageState,
    });
    const page = await context.newPage();

    try {
      await page.goto("/wallet");
      await page.getByRole("button", { name: "Add card" }).click();

      const addDialog = page.getByRole("dialog", { name: "Add a card" });
      await expect(addDialog).toBeVisible();
      await addDialog.getByRole("button", { name: /Mint Everyday/ }).click();

      const validLuhnCardNumber = "4532015112830366";
      await addDialog.getByLabel(/Nickname/).fill(validLuhnCardNumber);

      await expect(
        addDialog.getByText(
          "Don't enter card numbers. SwipeWise only needs the card name.",
        ),
      ).toBeVisible();

      await addDialog.getByRole("button", { name: "Add to wallet" }).click();

      // Dialog stays open with error and card number is not saved
      await expect(addDialog).toBeVisible();
      await addDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(addDialog).toBeHidden();
      await expect(page.getByText(validLuhnCardNumber)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("AC4: search 'Saf' on Home, pick Safeway, and see ranked cards ($4.00, $1.50, $1.25 on $100) with layout-specific navigation", async ({
    browser,
  }, testInfo) => {
    expect(savedStorageState).toBeDefined();
    const context = await browser.newContext({
      storageState: savedStorageState,
    });
    const page = await context.newPage();

    try {
      await page.goto("/");

      const isMobile = testInfo.project.name === "mobile";
      if (isMobile) {
        await expect(
          page.getByRole("navigation", { name: "Mobile navigation" }),
        ).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Main navigation" }),
        ).toBeHidden();
      } else {
        await expect(
          page.getByRole("navigation", { name: "Main navigation" }),
        ).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Mobile navigation" }),
        ).toBeHidden();
      }

      const searchInput = page.getByLabel("Search a store");
      await searchInput.fill("Saf");

      const suggestions = page.getByRole("listbox", {
        name: "Store suggestions",
      });
      await expect(suggestions).toBeVisible();
      await suggestions.getByRole("button", { name: /Safeway/ }).click();

      if (isMobile) {
        // Mobile: results shown in bottom sheet ("Your cards at Safeway", "on $100.00")
        await expect(
          page.getByRole("heading", { name: "Your cards at Safeway" }),
        ).toBeVisible();
        await expect(
          page.getByText("on $100.00").filter({ visible: true }),
        ).toBeVisible();
      } else {
        // Desktop: results shown on the page ("All your cards at Safeway", "Based on a $100.00 purchase")
        await expect(
          page.getByRole("heading", { name: "All your cards at Safeway" }),
        ).toBeVisible();
        await expect(
          page
            .getByText("Based on a $100.00 purchase")
            .filter({ visible: true }),
        ).toBeVisible();
      }

      await expect(
        page.getByText("Best pick, 4% groceries").filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText("Mint Everyday", { exact: true })
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByText("$4.00", { exact: true })
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByText("Basic Flat", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.getByText("$1.50", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText("Harbor Travel Plus", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.getByText("$1.25", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("AC5: unknown store ('Walmart') shows fallback message and picking Groceries still ranks the cards", async ({
    browser,
  }) => {
    expect(savedStorageState).toBeDefined();
    const context = await browser.newContext({
      storageState: savedStorageState,
    });
    const page = await context.newPage();

    try {
      await page.goto("/");

      const searchInput = page.getByLabel("Search a store");
      await searchInput.fill("Walmart");

      await expect(
        page.getByText("We don't know this store yet. Pick a category."),
      ).toBeVisible();

      const categoriesGroup = page.getByRole("group", { name: "Categories" });
      await categoriesGroup.getByRole("button", { name: "Groceries" }).click();

      await expect(
        page.getByText("Best pick, 4% groceries").filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText("Mint Everyday", { exact: true })
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByText("$4.00", { exact: true })
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByText("Basic Flat", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.getByText("$1.50", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText("Harbor Travel Plus", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.getByText("$1.25", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("AC6: log out goes to /login and opening /wallet redirects to /login", async ({
    browser,
  }, testInfo) => {
    expect(savedStorageState).toBeDefined();
    const isMobile = testInfo.project.name === "mobile";
    const context = await browser.newContext({
      storageState: savedStorageState,
    });
    const page = await context.newPage();

    try {
      await page.goto("/wallet");
      await expect(
        getWalletCardItem(page, "Mint Everyday", isMobile),
      ).toBeVisible();

      await page.getByRole("button", { name: "Log out" }).click();
      await expect(page).toHaveURL(/\/login$/);

      await page.goto("/wallet");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await context.close();
    }
  });

  test("AC7: wrong password shows 'Email or password is incorrect.'", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill("WrongPassword999");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(
      page.getByRole("alert").getByText("Email or password is incorrect."),
    ).toBeVisible();
  });

  test("AC8: log back in and verify the 3 cards are still saved in the wallet", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile";
    await page.goto("/login");

    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(userPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/wallet$/);
    await expect(
      getWalletCardItem(page, "Mint Everyday", isMobile),
    ).toBeVisible();
    await expect(getWalletCardItem(page, "Basic Flat", isMobile)).toBeVisible();
    await expect(
      getWalletCardItem(page, "Harbor Travel Plus", isMobile),
    ).toBeVisible();
  });
});
