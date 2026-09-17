import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFilename,
  extensionFromMime,
  extensionFromUrl,
  isRestrictedUrl,
  slugify
} from "../src/shared/extract.js";

test("slugify keeps letters/numbers and collapses separators", () => {
  assert.equal(slugify("Hello, World!"), "Hello-World");
  assert.equal(slugify("  AI / EOB  "), "AI-EOB");
  assert.equal(slugify(""), "");
});

test("extensionFromMime and extensionFromUrl detect common formats", () => {
  assert.equal(extensionFromMime("image/jpeg; charset=binary"), "jpg");
  assert.equal(extensionFromMime("image/svg+xml"), "svg");
  assert.equal(extensionFromMime("text/html"), null);
  assert.equal(extensionFromUrl("https://cdn.test/a/b/photo.JPEG"), "jpg");
  assert.equal(extensionFromUrl("https://cdn.test/Featured-Image-H.B.T.jpg"), "jpg");
  assert.equal(extensionFromUrl("https://cdn.test/path/"), null);
  assert.equal(extensionFromUrl("data:image/png;base64,aaa"), "png");
});

test("buildFilename uses host + title and image extension", () => {
  var name = buildFilename(
    { host: "healthcarebusinesstoday.com", title: "What Peer Reviewed Evidence Reveals" },
    {
      url: "https://e8h575bq8ni.exactdn.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg",
      source: "og:image"
    }
  );
  assert.equal(
    name,
    "healthcarebusinesstoday-com-What-Peer-Reviewed-Evidence-Reveals.jpg"
  );
});

test("buildFilename never emits non-image extensions like html", () => {
  var name = buildFilename(
    { host: "example.com", title: "Article" },
    { url: "https://example.com/post/", source: "og:image", type: "html" }
  );
  assert.match(name, /\.jpg$/);
  assert.doesNotMatch(name, /\.html$/);
});

test("buildFilename prefers URL basename for non-OG gallery images", () => {
  var name = buildFilename(
    { host: "example.com", title: "Ignored Title" },
    { url: "https://cdn.example.com/gallery/shot.webp", kind: "img" }
  );
  assert.equal(name, "example-com-shot.webp");
});

test("isRestrictedUrl blocks browser internals and allows http(s)", () => {
  assert.equal(isRestrictedUrl("chrome://extensions"), true);
  assert.equal(isRestrictedUrl("chrome-extension://abc/popup.html"), true);
  assert.equal(isRestrictedUrl("https://chromewebstore.google.com/detail/x"), true);
  assert.equal(isRestrictedUrl("https://example.com/post"), false);
  assert.equal(isRestrictedUrl("http://localhost:3000"), false);
  assert.equal(isRestrictedUrl(""), true);
});
