// Opt-in browser audit of the deployed app. No route mocking and no fixture server.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const run = process.argv[2] || "first-live";
const root = path.resolve("../artifacts/live");
const state = JSON.parse(
  fs.readFileSync(path.join(root, `${run}-state.json`), "utf8"),
);
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: "http://localhost:8080",
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [],
  calls = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    r.method() === "POST" &&
    /\/(analyze|process|check|comparisons)$/.test(r.url())
  )
    calls.push(r.url());
});
try {
  await page.goto("/");
  await page.getByLabel("Email address").fill(state.email);
  await page.getByLabel("Password", { exact: true }).fill(state.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little clarity.", exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(root, `${run}-dashboard.png`),
    fullPage: true,
  });
  const base = "/projects/" + state.project_id;
  for (const tab of ["overview", "topic", "sources", "evidence", "essay"]) {
    await page.goto(base + "/" + tab);
    await expect(
      page.getByRole("heading", {
        name: `Live verification ${run} - AI coding education`,
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(root, `${run}-${tab}.png`),
      fullPage: true,
    });
  }
  await page.goto(base + "/sources");
  await page
    .getByRole("button", { name: "A-guided-feedback.pdf", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Source-derived information" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI evaluation", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(root, `${run}-source-detail.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto(base + "/evidence");
  await page
    .getByRole("button", { name: /^Page \d+$/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Follow the evidence" }),
  ).toBeVisible();
  await expect(page.getByRole("blockquote")).toBeVisible();
  await page.getByText("Read extracted page context", { exact: true }).click();
  await expect(page.locator(".page-context p")).not.toContainText("Loading");
  await page.screenshot({
    path: path.join(root, `${run}-provenance.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(path.join(root, `${run}-evidence.csv`));
  await page.goto(base + "/essay");
  const claims = page.locator(".claim-card");
  await expect(claims).toHaveCount(5);
  for (let i = 0; i < (await claims.count()); i++) {
    await claims.nth(i).click();
    await expect(
      page.getByRole("heading", { name: "Claim evidence review" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recommended action" }),
    ).toBeVisible();
    if (i === 0)
      await page.screenshot({
        path: path.join(root, `${run}-claim-detail.png`),
        fullPage: true,
      });
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  await page.reload();
  await expect(claims.first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(root, `${run}-mobile.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Topic experience hub" }).click();
  await expect(
    page.getByRole("heading", { name: "Topic experience hub", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Finding topic notes…")).not.toBeVisible();
  await page.screenshot({
    path: path.join(root, `${run}-hub.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(calls).toEqual([]);
  const secondPath = path.join(root, `${run}-second-user.json`);
  if (fs.existsSync(secondPath)) {
    const second = await browser.newContext({
      baseURL: "http://localhost:8080",
    });
    const credentials = JSON.parse(fs.readFileSync(secondPath, "utf8"));
    expect(
      (
        await second.request.post("/api/auth/login", { data: credentials })
      ).status(),
    ).toBe(200);
    const otherPage = await second.newPage();
    await otherPage.goto(base + "/essay");
    await expect(otherPage.getByRole("alert")).toContainText(
      "Project not found",
    );
    await second.close();
  }
  fs.writeFileSync(
    path.join(root, `${run}-browser.json`),
    JSON.stringify(
      {
        passed: true,
        consoleErrors: errors,
        unpromptedAiPosts: calls,
        screens: [
          "dashboard",
          "overview",
          "topic",
          "sources",
          "source-detail",
          "evidence",
          "provenance",
          "essay",
          "claim-detail",
          "mobile",
          "hub",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Live desktop/mobile audit, source/claim dialogs, CSV download, reload, and no unsolicited AI calls: passed.",
  );
} finally {
  await browser.close();
}
