"use strict";

var CRC_TABLE = (function () {
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ]);
}

function concatBytes(parts) {
  var total = 0;
  for (var i = 0; i < parts.length; i++) total += parts[i].length;
  var out = new Uint8Array(total);
  var offset = 0;
  for (var j = 0; j < parts.length; j++) {
    out.set(parts[j], offset);
    offset += parts[j].length;
  }
  return out;
}

function encodeName(name) {
  return new TextEncoder().encode(String(name || "file").replace(/\\/g, "/"));
}

function uniqueZipName(used, name) {
  var safe = String(name || "image.jpg").replace(/^\/+/, "");
  if (!used[safe]) {
    used[safe] = true;
    return safe;
  }
  var dot = safe.lastIndexOf(".");
  var base = dot > 0 ? safe.slice(0, dot) : safe;
  var ext = dot > 0 ? safe.slice(dot) : "";
  var n = 2;
  var next = base + "-" + n + ext;
  while (used[next]) {
    n += 1;
    next = base + "-" + n + ext;
  }
  used[next] = true;
  return next;
}

export function buildZip(files) {
  var localParts = [];
  var centralParts = [];
  var offset = 0;
  var used = Object.create(null);

  for (var i = 0; i < files.length; i++) {
    var nameBytes = encodeName(uniqueZipName(used, files[i].name));
    var data = files[i].bytes;
    if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
    var crc = crc32(data);
    var size = data.length;
    var local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    ]);
    localParts.push(local);
    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(size),
        u32(size),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes
      ])
    );
    offset += local.length;
  }

  var central = concatBytes(centralParts);
  var eocd = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);
  return concatBytes(localParts.concat([central, eocd]));
}
