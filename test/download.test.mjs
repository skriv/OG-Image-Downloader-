import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDownloadCandidates,
  bytesToDataUrl,
  canCreateObjectUrl,
  canonicalFromLink,
  ensureImageFilename,
  isImageMime,
  pickImagePayload,
  resolveImageDownload,
  sniffImageExtension
} from "../src/shared/download.js";
import { buildFilename } from "../src/shared/extract.js";

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function htmlBytes() {
  return new TextEncoder().encode("<!doctype html><html><body>nope</body></html>");
}

test("sniffImageExtension detects jpeg/png and rejects html", () => {
  assert.equal(sniffImageExtension(jpegBytes()), "jpg");
  assert.equal(sniffImageExtension(pngBytes()), "png");
  assert.equal(sniffImageExtension(htmlBytes()), null);
});

test("isImageMime accepts image types only", () => {
  assert.equal(isImageMime("image/jpeg"), true);
  assert.equal(isImageMime("image/svg+xml; charset=utf-8"), true);
  assert.equal(isImageMime("text/html"), false);
  assert.equal(isImageMime(null), false);
});

test("ensureImageFilename rewrites html extension to sniffed image type", () => {
  var name = ensureImageFilename(
    "healthcarebusinesstoday-com-Article.html",
    "text/html",
    "https://cdn.example/a.jpg",
    jpegBytes()
  );
  assert.equal(name, "healthcarebusinesstoday-com-Article.jpg");
});

test("buildDownloadCandidates adds origin upload mirror for ExactDN", () => {
  var imageUrl =
    "https://e8h575bq8ni.exactdn.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg";
  var pageUrl =
    "https://www.healthcarebusinesstoday.com/what-peer-reviewed-evidence-reveals-about-the-future-of-ai-assisted-eob-posting/";
  var candidates = buildDownloadCandidates(imageUrl, pageUrl);

  assert.equal(candidates[0], imageUrl);
  assert.ok(
    candidates.includes(
      "https://www.healthcarebusinesstoday.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg"
    )
  );
  assert.ok(
    candidates.includes(
      "https://healthcarebusinesstoday.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg"
    )
  );
});

test("canonicalFromLink parses ExactDN Link header", () => {
  var link =
    '<https://www.healthcarebusinesstoday.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg>; rel="canonical"';
  assert.equal(
    canonicalFromLink(link),
    "https://www.healthcarebusinesstoday.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg"
  );
});

test("pickImagePayload rejects HTML bodies even with confusing headers", () => {
  var response = {
    headers: {
      get: function () {
        return "text/html";
      }
    }
  };
  assert.equal(pickImagePayload(response, htmlBytes()), null);
  assert.deepEqual(pickImagePayload(response, jpegBytes()).ext, "jpg");
});

test("bytesToDataUrl encodes jpeg without DOM APIs (MV3 SW safe)", () => {
  var url = bytesToDataUrl(jpegBytes(), "image/jpeg");
  assert.match(url, /^data:image\/jpeg;base64,/);
  assert.ok(url.length > 30);
  assert.equal(
    canCreateObjectUrl(),
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
  );
});

test("HBT ExactDN flow: resolve + filename stays .jpg even if createObjectURL missing", async () => {
  var imageUrl =
    "https://e8h575bq8ni.exactdn.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg";
  var pageUrl =
    "https://www.healthcarebusinesstoday.com/what-peer-reviewed-evidence-reveals-about-the-future-of-ai-assisted-eob-posting/";

  var resolved = await resolveImageDownload(imageUrl, pageUrl, { timeoutMs: 15000 });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.ext, "jpg");
  assert.ok(resolved.bytes.length > 1000);

  var suggested = buildFilename(
    {
      host: "healthcarebusinesstoday.com",
      title: "What Peer-Reviewed Evidence Reveals About The Future Of AI-Assisted EOB Posting"
    },
    { url: imageUrl, source: "og:image" }
  );
  var finalName = ensureImageFilename(suggested, resolved.mime, resolved.url, resolved.bytes);
  assert.match(finalName, /\.jpg$/);
  assert.doesNotMatch(finalName, /\.html$/);

  // Saving must not depend on createObjectURL (unavailable in MV3 SW).
  var dataUrl = bytesToDataUrl(resolved.bytes, resolved.mime);
  assert.match(dataUrl, /^data:image\/jpeg;base64,\/9j\//);
});

test("resolveImageDownload tries candidates and skips non-image responses", async () => {
  var calls = [];
  var fetchImpl = async (url) => {
    calls.push(url);
    if (String(url).includes("exactdn.com")) {
      return {
        ok: true,
        headers: {
          get: function (name) {
            if (name === "content-type") return "text/html";
            if (name === "link") {
              return '<https://origin.example/wp-content/uploads/photo.jpg>; rel="canonical"';
            }
            return null;
          }
        },
        arrayBuffer: async () => htmlBytes().buffer
      };
    }
    return {
      ok: true,
      headers: {
        get: function (name) {
          return name === "content-type" ? "image/jpeg" : null;
        }
      },
      arrayBuffer: async () => jpegBytes().buffer
    };
  };

  var result = await resolveImageDownload(
    "https://cdn.exactdn.com/wp-content/uploads/photo.jpg",
    "https://www.origin.example/article/",
    { fetchImpl: fetchImpl, timeoutMs: 1000 }
  );

  assert.equal(result.ok, true);
  assert.match(result.url, /origin\.example/);
  assert.equal(result.ext, "jpg");
  assert.ok(calls.length >= 2);
});

test("resolveImageDownload fails when every candidate is unavailable", async () => {
  var fetchImpl = async () => {
    throw new Error("network");
  };
  var result = await resolveImageDownload(
    "https://cdn.exactdn.com/wp-content/uploads/photo.jpg",
    "https://www.origin.example/article/",
    { fetchImpl: fetchImpl, timeoutMs: 1000 }
  );
  assert.equal(result.ok, false);
});
