import assert from "node:assert/strict";
import test from "node:test";
import { buildBadgeText, sourceLabel } from "../src/popup/preview.js";
import { extensionFromMime, extensionFromUrl } from "../src/shared/extract.js";
import { t, setCurrentLocale, resolveLocale } from "../src/shared/i18n.js";

test("sourceLabel maps known sources", () => {
  assert.equal(sourceLabel("og:image"), "OG");
  assert.equal(sourceLabel("twitter:image"), "Twitter");
  assert.equal(sourceLabel("json-ld"), "JSON-LD");
  assert.equal(sourceLabel("custom"), "custom");
});

test("buildBadgeText prefers probe mime then natural size", () => {
  var image = { url: "https://cdn.example/x.webp", width: 10, height: 10, source: "og:image" };
  assert.match(
    buildBadgeText(image, { type: "image/png", size: 2048 }, null, extensionFromMime, extensionFromUrl),
    /png/i
  );
  assert.match(
    buildBadgeText(image, null, { width: 1200, height: 630 }, extensionFromMime, extensionFromUrl),
    /1200/
  );
});

test("i18n resolveLocale and t() fall back to English", () => {
  assert.equal(resolveLocale("ru"), "ru");
  assert.equal(resolveLocale("nope"), "en");
  setCurrentLocale("en");
  assert.equal(t("download"), "Download");
  setCurrentLocale("ru");
  assert.equal(t("download"), "Скачать");
  assert.equal(t("missingKeyThatDoesNotExist"), "missingKeyThatDoesNotExist");
});
