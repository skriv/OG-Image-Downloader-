import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { extractOpenGraph } from "../src/shared/extract.js";

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var fixturePath = path.join(__dirname, "fixture.html");
var shared;

async function getBrowser() {
  if (shared) return shared;
  try {
    shared = await chromium.launch({ channel: "chrome", headless: true });
  } catch (err) {
    shared = await chromium.launch({ headless: true });
  }
  return shared;
}

async function extractFromFixture() {
  var browser = await getBrowser();
  var context = await browser.newContext();
  var page = await context.newPage();
  await page.route("**/*", async (route) => {
    var type = route.request().resourceType();
    if (type === "document" || type === "script") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: readFileSync(fixturePath, "utf8")
      });
      return;
    }
    await route.abort();
  });
  try {
    await page.goto("https://example.test/articles/demo/", { waitUntil: "domcontentloaded" });
    return await page.evaluate(extractOpenGraph);
  } finally {
    await context.close();
  }
}

test.after(async () => {
  if (shared) {
    await shared.close();
    shared = null;
  }
});

test("extractOpenGraph reads OG, twitter, link, itemprop, vk, and JSON-LD images", async () => {
  var data = await extractFromFixture();

  assert.equal(data.title, "OG Title / Test");
  assert.equal(data.description, "A sample Open Graph page");
  assert.equal(data.siteName, "OG Lab");
  assert.equal(data.host, "example.test");

  var sources = data.images.map((img) => img.source);
  assert.ok(sources.includes("og:image") || sources.includes("og:image:secure_url"));
  assert.ok(sources.includes("twitter:image:src") || sources.includes("twitter:image"));
  assert.ok(sources.includes("link:image_src"));
  assert.ok(sources.includes("itemprop:image"));
  assert.ok(sources.includes("vk:image"));
  assert.ok(sources.includes("json-ld"));

  var urls = data.images.map((img) => img.url);
  assert.ok(urls.includes("https://cdn.example.com/first.png"));
  assert.ok(urls.includes("https://cdn.example.com/second.jpg"));
  assert.ok(urls.includes("https://cdn.example.com/twitter.webp"));
  assert.ok(urls.includes("https://cdn.example.com/link.gif"));
  assert.ok(urls.includes("https://cdn.example.com/item.jpg"));
  assert.ok(urls.includes("https://cdn.example.com/vk.jpg"));
  assert.ok(urls.includes("https://cdn.example.com/ld-1.jpg"));
  assert.ok(urls.includes("https://cdn.example.com/ld-2.jpg"));
});

test("extractOpenGraph upgrades relative og:image to secure_url when present", async () => {
  var data = await extractFromFixture();
  var first = data.images[0];
  assert.equal(first.url, "https://cdn.example.com/first.png");
  assert.equal(first.width, 1200);
  assert.equal(first.height, 630);
  assert.equal(first.type, "image/png");
  assert.equal(first.alt, "First card");
});

test("extractOpenGraph collects page images from img, srcset, CSS, and SVG", async () => {
  var data = await extractFromFixture();
  var pageUrls = data.pageImages.map((img) => img.url);

  assert.ok(pageUrls.some((url) => url.includes("body.png")));
  assert.ok(pageUrls.some((url) => url.includes("large.jpg")));
  assert.ok(pageUrls.some((url) => url.includes("bg.webp")));
  assert.ok(pageUrls.some((url) => url.indexOf("data:image/svg+xml") === 0));
  assert.ok(data.pageImages.some((img) => img.isOg));
});
