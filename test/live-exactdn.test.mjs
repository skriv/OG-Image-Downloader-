import assert from "node:assert/strict";
import test from "node:test";
import { resolveImageDownload, buildDownloadCandidates } from "../src/shared/download.js";

var IMAGE_URL =
  "https://e8h575bq8ni.exactdn.com/wp-content/uploads/2026/08/Featured-Image-H.B.T.jpg";
var PAGE_URL =
  "https://www.healthcarebusinesstoday.com/what-peer-reviewed-evidence-reveals-about-the-future-of-ai-assisted-eob-posting/";

test("live: ExactDN OG image resolves to real jpeg bytes", async (t) => {
  var result;
  try {
    result = await resolveImageDownload(IMAGE_URL, PAGE_URL, { timeoutMs: 15000 });
  } catch (err) {
    t.skip("network unavailable: " + (err && err.message));
    return;
  }

  if (!result.ok) {
    t.skip("could not reach ExactDN/origin: " + result.error);
    return;
  }

  assert.equal(result.ext, "jpg");
  assert.ok(result.bytes.length > 1000);
  assert.equal(result.bytes[0], 0xff);
  assert.equal(result.bytes[1], 0xd8);
  assert.ok(
    result.url === IMAGE_URL ||
      buildDownloadCandidates(IMAGE_URL, PAGE_URL).includes(result.url)
  );
});
