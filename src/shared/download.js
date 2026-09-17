"use strict";

import { extensionFromMime, extensionFromUrl } from "./extract.js";

var IMAGE_MIME = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/vnd.microsoft.icon": "ico",
  "image/webp": "webp",
  "image/x-icon": "ico"
};

var CDN_HOST_RE =
  /(^|\.)exactdn\.com$|(^|\.)wp\.com$|(^|\.)cloudinary\.com$|(^|\.)imgix\.net$|(^|\.)cloudfront\.net$|(^|\.)akamaihd\.net$|(^|\.)b-cdn\.net$/i;

export function isImageMime(mime) {
  if (!mime) return false;
  var key = String(mime).split(";")[0].trim().toLowerCase();
  if (IMAGE_MIME[key]) return true;
  return key.indexOf("image/") === 0;
}

export function sniffImageExtension(bytes) {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return "ico";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";

  if (bytes.length >= 12) {
    var brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (brand === "ftyp") {
      var major = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
      if (major.indexOf("avif") === 0 || major === "avis" || major === "mif1") return "avif";
    }
  }

  var head = "";
  var limit = Math.min(bytes.length, 256);
  for (var i = 0; i < limit; i++) {
    var code = bytes[i];
    if (code === 0) break;
    head += String.fromCharCode(code);
  }
  var trimmed = head.replace(/^\uFEFF/, "").trimStart();
  if (/^(<\?xml|<!doctype\s+svg|<svg\b)/i.test(trimmed)) return "svg";
  return null;
}

export function mimeFromExtension(ext) {
  var value = String(ext || "").toLowerCase();
  if (value === "jpg" || value === "jpeg") return "image/jpeg";
  if (value === "png") return "image/png";
  if (value === "gif") return "image/gif";
  if (value === "webp") return "image/webp";
  if (value === "svg") return "image/svg+xml";
  if (value === "avif") return "image/avif";
  if (value === "bmp") return "image/bmp";
  if (value === "ico") return "image/x-icon";
  return "application/octet-stream";
}

/**
 * Build a data: URL without DOM APIs. MV3 service workers do not have
 * URL.createObjectURL; FileReader is also unreliable there.
 */
export function bytesToDataUrl(bytes, mime) {
  var input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  var binary = "";
  var chunk = 0x8000;
  for (var i = 0; i < input.length; i += chunk) {
    binary += String.fromCharCode.apply(null, input.subarray(i, i + chunk));
  }
  return "data:" + (mime || "application/octet-stream") + ";base64," + btoa(binary);
}

export function canCreateObjectUrl() {
  return typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
}

export function ensureImageFilename(filename, mime, url, bytes) {
  var base = String(filename || "image").replace(/[\\/:*?"<>|]+/g, "-");
  var ext =
    sniffImageExtension(bytes) ||
    extensionFromMime(mime) ||
    extensionFromUrl(url) ||
    "jpg";
  var replaced = base.replace(/\.[^.]+$/, "." + ext);
  if (replaced === base && !/\.[^.]+$/.test(base)) {
    return base + "." + ext;
  }
  if (replaced === base) {
    return base.replace(/\.[^.]+$/, "") + "." + ext;
  }
  return replaced;
}

export function buildDownloadCandidates(imageUrl, pageUrl) {
  var urls = [];
  function push(value) {
    if (!value) return;
    var href = String(value).trim();
    if (!href || urls.indexOf(href) !== -1) return;
    if (href.indexOf("data:") === 0 || href.indexOf("blob:") === 0 || href.indexOf("http") === 0) {
      urls.push(href);
    }
  }

  push(imageUrl);

  try {
    var img = new URL(imageUrl);
    var page = pageUrl ? new URL(pageUrl) : null;

    if (page && img.protocol.indexOf("http") === 0) {
      var sameUploadPath =
        img.hostname !== page.hostname && /\/wp-content\/uploads\//i.test(img.pathname);
      var knownCdn = CDN_HOST_RE.test(img.hostname);
      if ((knownCdn || sameUploadPath) && img.pathname.indexOf("/") === 0) {
        push(page.origin + img.pathname + img.search);
      }
    }

    if (/\.exactdn\.com$/i.test(img.hostname) && /\/wp-content\//i.test(img.pathname)) {
      // ExactDN often publishes a canonical origin via Link; keep a www-stripped twin too.
      if (page) {
        var host = page.hostname.replace(/^www\./, "");
        push(page.protocol + "//" + host + img.pathname + img.search);
        push(page.protocol + "//www." + host.replace(/^www\./, "") + img.pathname + img.search);
      }
    }
  } catch (err) {
    /* keep original only */
  }

  return urls;
}

export function pickImagePayload(response, bytes) {
  var headerMime = response && response.headers && response.headers.get
    ? response.headers.get("content-type")
    : null;
  var sniffed = sniffImageExtension(bytes);
  var headerExt = extensionFromMime(headerMime);

  if (sniffed) {
    return {
      bytes: bytes,
      mime: headerExt ? String(headerMime).split(";")[0].trim() : mimeFromExtension(sniffed),
      ext: sniffed
    };
  }

  if (isImageMime(headerMime) && headerExt) {
    return {
      bytes: bytes,
      mime: String(headerMime).split(";")[0].trim(),
      ext: headerExt
    };
  }

  return null;
}

/**
 * Fetch image bytes from candidate URLs. Inject `fetchImpl` in tests.
 */
export async function fetchImageBytes(url, options) {
  options = options || {};
  var fetchImpl = options.fetchImpl || fetch;
  var timeoutMs = options.timeoutMs == null ? 20000 : options.timeoutMs;
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = null;
  if (controller && timeoutMs > 0) {
    timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs);
  }

  try {
    if (String(url).indexOf("data:") === 0) {
      var dataRes = await fetchImpl(url);
      var dataBuf = await dataRes.arrayBuffer();
      var dataBytes = new Uint8Array(dataBuf);
      var dataPayload = pickImagePayload(dataRes, dataBytes);
      if (!dataPayload) throw new Error("not-image");
      return dataPayload;
    }

    var response = await fetchImpl(url, {
      redirect: "follow",
      signal: controller ? controller.signal : undefined,
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) throw new Error("status-" + response.status);
    var buffer = await response.arrayBuffer();
    var bytes = new Uint8Array(buffer);
    var payload = pickImagePayload(response, bytes);
    if (!payload) throw new Error("not-image");

    var link = response.headers && response.headers.get ? response.headers.get("link") : null;
    if (link) payload.canonicalUrl = canonicalFromLink(link);
    return payload;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function canonicalFromLink(linkHeader) {
  if (!linkHeader) return null;
  var parts = String(linkHeader).split(",");
  for (var i = 0; i < parts.length; i++) {
    var bit = parts[i];
    if (!/rel=["']?canonical["']?/i.test(bit)) continue;
    var match = /<\s*([^>\s]+)\s*>/.exec(bit);
    if (match) return match[1].trim();
  }
  return null;
}

export async function resolveImageDownload(url, pageUrl, options) {
  options = options || {};
  var candidates = buildDownloadCandidates(url, pageUrl);
  var lastError = null;
  var seen = Object.create(null);

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (seen[candidate]) continue;
    seen[candidate] = true;
    try {
      var payload = await fetchImageBytes(candidate, options);
      if (payload.canonicalUrl && !seen[payload.canonicalUrl]) {
        candidates.push(payload.canonicalUrl);
      }
      return {
        ok: true,
        url: candidate,
        bytes: payload.bytes,
        mime: payload.mime,
        ext: payload.ext
      };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    ok: false,
    error: lastError && lastError.message ? lastError.message : "downloadFailed"
  };
}
