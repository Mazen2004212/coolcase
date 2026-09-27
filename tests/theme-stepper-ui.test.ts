import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baseURL = process.env.COOLCASE_TEST_BASE_URL ?? "http://127.0.0.1:3001";

test("canonical theme and cart progress render from live CSS", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseURL, { waitUntil: "networkidle" });

  const theme = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const header = document.querySelector<HTMLElement>(".site-header");
    const footer = document.querySelector<HTMLElement>(".site-footer");
    const hero = document.querySelector<HTMLElement>(".hero-carousel");
    return {
      mainDark: root.getPropertyValue("--cc-brown-deep").trim(),
      white: getComputedStyle(document.body).backgroundColor,
      headerBackground: header ? getComputedStyle(header).backgroundColor : "",
      footerBackground: footer ? getComputedStyle(footer).backgroundColor : "",
      heroOverlay: hero ? getComputedStyle(hero, "::before").backgroundImage : "",
    };
  });

  expect(["#111", "#111111"]).toContain(theme.mainDark);
  expect(theme.white).toBe("rgb(255, 255, 255)");
  expect(theme.headerBackground).toBe("rgb(17, 17, 17)");
  expect(theme.footerBackground).toBe("rgb(17, 17, 17)");
  expect(theme.heroOverlay).toContain("linear-gradient");

  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle" });
  await expect(page.getByRole("navigation", { name: "Checkout progress" })).toBeVisible();
  await expect(page.locator('.checkout-progress [aria-current="step"]')).toContainText("Cart");
  await page.screenshot({ path: join(tmpdir(), "coolcase-cart-stepper-desktop.png"), fullPage: false });

  expect(consoleErrors).toEqual([]);
});

test("storefront routes and progress remain overflow-free", async ({ page }) => {
  const routes = ["/", "/shop", "/collections", "/products/black-lily", "/cart", "/login", "/signup"];
  await page.goto(`${baseURL}/collections`, { waitUntil: "networkidle" });
  const collectionLinks = page.locator('.collection-card a[href^="/collections/"]');
  if (await collectionLinks.count()) {
    const collectionHref = await collectionLinks.first().getAttribute("href");
    if (collectionHref) routes.push(collectionHref);
  } else {
    await expect(page.getByRole("heading", { name: "CURATED DROPS ARE ON THE WAY" })).toBeVisible();
    console.log("No active collection available: verified the real collections empty state.");
  }
  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route).toBe(200);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle" });
  await expect(page.locator('.checkout-progress [aria-current="step"]')).toContainText("Cart");
  await page.screenshot({ path: join(tmpdir(), "coolcase-cart-stepper-mobile.png"), fullPage: false });
});

test("product-card bag action uses the monochrome treatment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
  const firstCard = page.locator(".product-card").first();
  const bag = firstCard.locator(".product-link-icon");
  await expect(firstCard).toBeVisible();
  await expect(bag).toBeVisible();

  const initial = await bag.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color };
  });
  expect(initial.background).toBe("rgb(255, 255, 255)");
  expect(initial.border).toBe("rgb(228, 228, 228)");
  expect(initial.color).toBe("rgb(17, 17, 17)");

  await firstCard.locator("a").hover();
  await expect(bag).toHaveCSS("background-color", "rgb(247, 247, 247)");
});

test("progress renders actual linked order/payment states without database writes", async ({ page }) => {
  // Credentials stay in Node; the browser receives only status strings and markup.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile(".env.local");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.from("orders").select("status,payments(status)").limit(100);
  expect(error).toBeNull();
  expect(data?.length).toBeGreaterThan(0);
  const pairs = new Map<string, { orderStatus: string; paymentStatus: string | null }>();
  for (const row of data ?? []) {
    const relation = row.payments as unknown as { status: string } | { status: string }[] | null;
    const payment = Array.isArray(relation) ? relation[0] : relation;
    pairs.set(`${row.status}/${payment?.status}`, { orderStatus: row.status, paymentStatus: payment?.status ?? null });
  }
  // Playwright transforms JSX for its own component protocol. Render through tsx
  // so this check executes the production React component with React's renderer.
  const markupByState: string[] = JSON.parse(execFileSync(process.execPath, [
    "--import", "tsx", "-e",
    'const React = require("react"); globalThis.React = React; const { renderToStaticMarkup } = require("react-dom/server"); const { CheckoutProgress } = require("./components/checkout/checkout-progress.tsx"); console.log(JSON.stringify(JSON.parse(process.argv[1]).map(pair => renderToStaticMarkup(React.createElement(CheckoutProgress, { phase: "ORDER", ...pair })))));',
    JSON.stringify([...pairs.values()]),
  ], { encoding: "utf8" }));

  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle" });
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const [index, pair] of [...pairs.values()].entries()) {
      const markup = markupByState[index];
      // Render the production component with live read-only state and the app's CSS.
      await page.locator(".checkout-progress").evaluate((element, html) => { element.outerHTML = html; }, markup);
      const steps = page.locator(".checkout-progress li");
      const paymentDone = ["VERIFIED", "NOT_REQUIRED"].includes(pair.paymentStatus ?? "");
      const accepted = ["CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(pair.orderStatus);
      const stopped = ["CANCELLED", "REJECTED"].includes(pair.orderStatus);
      await expect(steps.nth(2)).toHaveAttribute("data-state", paymentDone ? "complete" : stopped ? "terminated" : "active");
      await expect(steps.nth(3)).toHaveAttribute("data-state", accepted && paymentDone ? "complete" : stopped ? "terminated" : "waiting");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      if (viewport.width === 1440 && pair.orderStatus === "CONFIRMED" && pair.paymentStatus === "VERIFIED") {
        await page.locator(".checkout-progress").screenshot({ path: join(tmpdir(), "coolcase-progress-real-confirmed.png") });
      }
    }
  }
  console.log(`Verified component rendering for ${data?.length} real orders / ${pairs.size} distinct status combinations (read-only).`);
});

test("auth remains connected and motion preferences keep buttons stable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  const form = await page.locator(".auth-split-form-panel").boundingBox();
  const image = await page.locator(".auth-visual").boundingBox();
  expect(form).not.toBeNull();
  expect(image).not.toBeNull();
  expect(Math.abs(form!.x + form!.width - image!.x)).toBeLessThanOrEqual(1);
  await expect(page.locator(".auth-submit")).toHaveCSS("background-image", /linear-gradient/);
  await page.screenshot({ path: join(tmpdir(), "coolcase-premium-login.png"), fullPage: false });
  await page.getByRole("link", { name: "Sign Up", exact: true }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(page.locator('.auth-tabs [aria-current="page"]')).toHaveText("Sign Up");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".auth-submit").hover();
  await expect(page.locator(".auth-submit")).toHaveCSS("transform", "none");
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const heroButton = page.locator('[data-active="true"] .hero-shop-link');
  const before = await heroButton.boundingBox();
  await heroButton.hover();
  expect(await heroButton.boundingBox()).toEqual(before);
});
