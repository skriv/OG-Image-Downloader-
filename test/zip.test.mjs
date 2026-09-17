import assert from "node:assert/strict";
import test from "node:test";
import { buildZip } from "../src/shared/zip.js";

test("buildZip creates a readable archive with unique names", () => {
  var bytes = buildZip([
    { name: "a.jpg", bytes: new Uint8Array([1, 2, 3]) },
    { name: "a.jpg", bytes: new Uint8Array([4, 5]) },
    { name: "folder/b.png", bytes: new Uint8Array([9]) }
  ]);

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 50);

  // Local file signatures
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  var asText = Buffer.from(bytes).toString("binary");
  assert.ok(asText.includes("a.jpg"));
  assert.ok(asText.includes("a-2.jpg"));
  assert.ok(asText.includes("folder/b.png"));
});

test("buildZip handles empty file list", () => {
  var bytes = buildZip([]);
  assert.ok(bytes instanceof Uint8Array);
  // End of central directory signature still present
  var view = Buffer.from(bytes);
  assert.ok(view.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])));
});
