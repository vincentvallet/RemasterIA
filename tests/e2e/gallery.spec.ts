import { expect, test } from "@playwright/test";

test("viewer, mystère, recherche et navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-webkit", "Le clavier physique est testé sur ordinateur.");
  await page.goto("/");
  const viewer = page.getByRole("slider");
  await expect(viewer).toBeVisible();
  await viewer.focus();
  const initialPosition = await page.locator(".counter").getAttribute("aria-label");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".counter")).not.toHaveAttribute("aria-label", initialPosition ?? "");

  await page.getByRole("slider").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "60");

  await page.getByRole("button", { name: /Révéler le titre/ }).click();
  await expect(page.getByRole("button", { name: "Masquer le titre" })).toBeVisible();

  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Rechercher une création" })).toBeVisible();
  await page.getByRole("textbox", { name: "Recherche" }).fill("Toki");
  await page.getByRole("button", { name: /Toki/ }).click();
  await expect(page.locator(".counter")).toHaveAttribute("aria-label", /Création \d+ sur \d+/);

  const before = await page.locator(".counter").getAttribute("aria-label");
  await page.keyboard.press("j");
  await expect(page.locator(".counter")).not.toHaveAttribute("aria-label", before ?? "");
});

test("les commandes tactiles répondent sur iPhone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "Scénario réservé à WebKit mobile");
  await page.goto("/");

  const counter = page.locator(".counter");
  const initialPosition = await counter.getAttribute("aria-label");
  await page.getByRole("button", { name: /Création suivante/ }).tap();
  await expect(counter).not.toHaveAttribute("aria-label", initialPosition ?? "");

  await page.getByRole("button", { name: /Révéler le titre/ }).tap();
  await expect(page.getByRole("button", { name: "Masquer le titre" })).toBeVisible();

  const viewer = page.getByRole("slider");
  const box = await viewer.boundingBox();
  if (!box) throw new Error("Le comparateur n’a pas de dimensions.");
  await page.touchscreen.tap(box.x + box.width * .75, box.y + box.height * .5);
  await expect(viewer).toHaveAttribute("aria-valuenow", /7[4-6]/);
});
