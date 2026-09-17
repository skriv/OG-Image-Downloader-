"use strict";

var MIME_EXT = {
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

var IMAGE_TYPES = {
  avif: true,
  bmp: true,
  gif: true,
  ico: true,
  jpg: true,
  png: true,
  svg: true,
  webp: true
};

export function extractOpenGraph() {
  var JSON_LD_TYPES = {
    article: true,
    blogposting: true,
    newsarticle: true,
    socialmediaposting: true,
    webpage: true
  };
  var base = document.baseURI || location.href;

  function abs(url) {
    if (url == null) return null;
    var value = String(url).trim();
    if (!value) return null;
    try {
      return new URL(value, base).href;
    } catch (err) {
      return null;
    }
  }

  function metaKey(el) {
    return String(el.getAttribute("property") || el.getAttribute("name") || "")
      .trim()
      .toLowerCase();
  }

  function pushUnique(list, seenMap, image) {
    var url = abs(image && image.url);
    if (!url || seenMap[url]) return;
    seenMap[url] = true;
    list.push({
      url: url,
      source: image.source || "og:image",
      width: image.width || null,
      height: image.height || null,
      type: image.type || null,
      alt: image.alt || null
    });
  }

  function parseDim(value) {
    var n = parseInt(value, 10);
    return n > 0 ? n : null;
  }

  var images = [];
  var seen = Object.create(null);
  var title = "";
  var description = "";
  var siteName = "";
  var current = null;

  function startOgImage(url, source) {
    var resolved = abs(url);
    if (!resolved) return;

    if (source !== "og:image" && current) {
      if (resolved.indexOf("https:") === 0 || current.url.indexOf("https:") !== 0) {
        if (current.url !== resolved) {
          delete seen[current.url];
          current.url = resolved;
          seen[resolved] = true;
        }
      }
      return;
    }

    if (seen[resolved]) {
      current = null;
      for (var i = 0; i < images.length; i++) {
        if (images[i].url === resolved) current = images[i];
      }
      if (current && source.indexOf("og:image") === 0) {
        current.source = source;
      }
      return;
    }

    current = {
      url: resolved,
      source: source,
      width: null,
      height: null,
      type: null,
      alt: null
    };
    seen[resolved] = true;
    images.push(current);
  }

  var vkUrls = [];
  var metas = document.querySelectorAll("meta");
  for (var m = 0; m < metas.length; m++) {
    var el = metas[m];
    var key = metaKey(el);
    var content = el.getAttribute("content");
    if (!key || content == null) continue;
    content = String(content).trim();
    if (!content) continue;

    if (key === "og:image" || key === "og:image:url" || key === "og:image:secure_url") {
      startOgImage(content, key);
    } else if (key === "og:image:width" && current) {
      current.width = parseDim(content);
    } else if (key === "og:image:height" && current) {
      current.height = parseDim(content);
    } else if (key === "og:image:type" && current) {
      current.type = content;
    } else if (key === "og:image:alt" && current) {
      current.alt = content;
    } else if (key === "og:title" && !title) {
      title = content;
    } else if (key === "og:description" && !description) {
      description = content;
    } else if (key === "og:site_name" && !siteName) {
      siteName = content;
    } else if (key === "twitter:image" || key === "twitter:image:src") {
      pushUnique(images, seen, { url: content, source: key });
    } else if (key === "twitter:title" && !title) {
      title = content;
    } else if (key === "twitter:description" && !description) {
      description = content;
    } else if (key === "vk:image") {
      vkUrls.push(content);
    }
  }

  var links = document.getElementsByTagName("link");
  for (var l = 0; l < links.length; l++) {
    var rel = String(links[l].rel || "").toLowerCase().split(/\s+/);
    if (rel.indexOf("image_src") !== -1) {
      pushUnique(images, seen, {
        url: links[l].getAttribute("href"),
        source: "link:image_src"
      });
    }
  }

  for (var v = 0; v < vkUrls.length; v++) {
    pushUnique(images, seen, { url: vkUrls[v], source: "vk:image" });
  }

  var itemprops = document.querySelectorAll('[itemprop="image"]');
  for (var p = 0; p < itemprops.length; p++) {
    var node = itemprops[p];
    pushUnique(images, seen, {
      url:
        node.getAttribute("content") ||
        node.getAttribute("src") ||
        node.getAttribute("href"),
      source: "itemprop:image"
    });
  }

  function collectJsonLdImage(value, acc) {
    if (!value) return;
    if (typeof value === "string") {
      acc.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) collectJsonLdImage(value[i], acc);
      return;
    }
    if (typeof value === "object") {
      collectJsonLdImage(value.url || value.contentUrl || value["@id"], acc);
    }
  }

  function typeList(value) {
    var raw = Array.isArray(value) ? value : value ? [value] : [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = String(raw[i]).split("/").pop().toLowerCase();
      if (t) out.push(t);
    }
    return out;
  }

  function walkJsonLd(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walkJsonLd(node[i]);
      return;
    }
    if (typeof node !== "object") return;
    if (node["@graph"]) walkJsonLd(node["@graph"]);

    var types = typeList(node["@type"]);
    var allowed = false;
    for (var t = 0; t < types.length; t++) {
      if (JSON_LD_TYPES[types[t]]) allowed = true;
    }
    if (allowed && node.image) {
      var found = [];
      collectJsonLdImage(node.image, found);
      for (var f = 0; f < found.length; f++) {
        pushUnique(images, seen, { url: found[f], source: "json-ld" });
      }
    }
  }

  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (var s = 0; s < scripts.length; s++) {
    var text = scripts[s].textContent;
    if (!text) continue;
    try {
      walkJsonLd(JSON.parse(text));
    } catch (err) {
      /* ignore broken JSON-LD */
    }
  }

  if (!title) {
    var heading = document.querySelector("title");
    title = heading ? String(heading.textContent || "").trim() : "";
  }

  var host = "";
  try {
    host = new URL(location.href).hostname.replace(/^www\./, "");
  } catch (err) {
    host = location.hostname || "";
  }

  var PAGE_LIMIT = 250;
  var CSS_LIMIT = 1200;
  var pageImages = [];
  var pageSeen = Object.create(null);
  var ogUrls = Object.create(null);
  for (var oi = 0; oi < images.length; oi++) ogUrls[images[oi].url] = true;

  function normalizeExt(value) {
    var ext = String(value || "")
      .toLowerCase()
      .replace(/^image\//, "")
      .split(";")[0]
      .trim();
    if (ext === "jpeg" || ext === "jpg" || ext === "pjpeg") return "jpg";
    if (ext === "svg+xml") return "svg";
    if (ext === "jpg" || ext === "png" || ext === "webp" || ext === "gif" || ext === "svg" || ext === "avif") {
      return ext;
    }
    if (ext === "bmp" || ext === "ico" || ext === "x-icon" || ext === "vnd.microsoft.icon") return ext === "bmp" ? "bmp" : "ico";
    return null;
  }

  function guessType(url, mime) {
    var fromMime = normalizeExt(mime);
    if (
      fromMime === "jpg" ||
      fromMime === "png" ||
      fromMime === "webp" ||
      fromMime === "gif" ||
      fromMime === "svg" ||
      fromMime === "avif"
    ) {
      return fromMime;
    }

    if (!url) return fromMime || "unknown";
    if (url.indexOf("data:") === 0) {
      var dataMatch = /^data:([^;,]+)/i.exec(url);
      return (dataMatch && normalizeExt(dataMatch[1])) || "unknown";
    }

    var lower = String(url).toLowerCase();
    var fromQuery = lower.match(/[?&](?:format|fm|ext|type)=([a-z0-9.+-]+)/i);
    if (fromQuery) {
      var q = normalizeExt(fromQuery[1]);
      if (q) return q;
    }
    if (/\bf_avif\b|\.avif\b|image\/avif/.test(lower)) return "avif";
    if (/\bf_webp\b|\.webp\b|image\/webp/.test(lower)) return "webp";
    if (/\bf_png\b|\.png\b|image\/png/.test(lower)) return "png";
    if (/\bf_gif\b|\.gif\b|image\/gif/.test(lower)) return "gif";
    if (/\.svg\b|image\/svg/.test(lower)) return "svg";
    if (/\.(jpe?g)\b|image\/jpeg/.test(lower)) return "jpg";

    try {
      var path = new URL(url, base).pathname;
      var found = /\.(avif|gif|jpe?g|png|svg|webp)$/i.exec(path);
      if (found) return normalizeExt(found[1]);
    } catch (err) {
      /* ignore */
    }
    return fromMime || "unknown";
  }

  function addPage(url, extra) {
    extra = extra || {};
    if (pageImages.length >= PAGE_LIMIT) return;
    var resolved = extra.absolute ? url : abs(url);
    if (!resolved || pageSeen[resolved]) return;
    if (resolved.indexOf("javascript:") === 0 || resolved.indexOf("blob:") === 0) return;
    var w = extra.width || null;
    var h = extra.height || null;
    if (w === 1 && h === 1) return;
    pageSeen[resolved] = true;
    pageImages.push({
      url: resolved,
      kind: extra.kind || "img",
      type: guessType(resolved, extra.mime),
      width: w,
      height: h,
      isOg: Boolean(ogUrls[resolved] || extra.isOg)
    });
  }

  function bestSrcset(value) {
    if (!value) return null;
    var parts = String(value).split(",");
    var best = null;
    var bestScore = -1;
    for (var s = 0; s < parts.length; s++) {
      var bits = parts[s].trim().split(/\s+/);
      if (!bits[0]) continue;
      var score = 1;
      var desc = bits[1] || "";
      if (/^\d+w$/i.test(desc)) score = parseInt(desc, 10);
      else if (/^\d+(\.\d+)?x$/i.test(desc)) score = parseFloat(desc) * 10000;
      if (score > bestScore) {
        bestScore = score;
        best = bits[0];
      }
    }
    return best;
  }

  function cssImageUrls(value) {
    var out = [];
    if (!value || value === "none") return out;
    var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    var match;
    while ((match = re.exec(value))) {
      var u = match[2];
      if (!u || u.indexOf("gradient") !== -1) continue;
      if (u.indexOf("data:") === 0 && u.indexOf("data:image") !== 0) continue;
      out.push(u);
    }
    return out;
  }

  for (var ogi = 0; ogi < images.length; ogi++) {
    addPage(images[ogi].url, {
      absolute: true,
      kind: "og",
      width: images[ogi].width,
      height: images[ogi].height,
      mime: images[ogi].type,
      isOg: true
    });
  }

  var imgNodes = document.getElementsByTagName("img");
  for (var im = 0; im < imgNodes.length; im++) {
    var img = imgNodes[im];
    var iw = parseDim(img.getAttribute("width")) || img.naturalWidth || null;
    var ih = parseDim(img.getAttribute("height")) || img.naturalHeight || null;
    var srcsetBest = bestSrcset(img.getAttribute("srcset") || img.getAttribute("data-srcset"));
    if (srcsetBest) addPage(srcsetBest, { kind: "srcset", width: iw, height: ih });
    addPage(img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src"), {
      kind: "img",
      width: iw,
      height: ih
    });
  }

  var sources = document.querySelectorAll("picture source, source[srcset]");
  for (var so = 0; so < sources.length; so++) {
    var srcBest = bestSrcset(sources[so].getAttribute("srcset"));
    addPage(srcBest || sources[so].getAttribute("src"), {
      kind: "srcset",
      mime: sources[so].getAttribute("type")
    });
  }

  var root = document.body || document.documentElement;
  if (root) {
    var nodes = root.getElementsByTagName("*");
    var max = Math.min(nodes.length, CSS_LIMIT);
    for (var n = 0; n < max; n++) {
      var el = nodes[n];
      var tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "LINK") continue;
      var urls = cssImageUrls(el.style && el.style.backgroundImage);
      try {
        var computed = getComputedStyle(el).backgroundImage;
        var more = cssImageUrls(computed);
        for (var mu = 0; mu < more.length; mu++) urls.push(more[mu]);
      } catch (err) {
        /* ignore */
      }
      for (var cu = 0; cu < urls.length; cu++) addPage(urls[cu], { kind: "background" });
    }
  }

  var svgs = document.querySelectorAll("svg");
  for (var sv = 0; sv < svgs.length; sv++) {
    var svg = svgs[sv];
    if (svg.parentElement && svg.parentElement.closest && svg.parentElement.closest("svg")) continue;
    var sw = parseDim(svg.getAttribute("width"));
    var sh = parseDim(svg.getAttribute("height"));
    if (sw === 1 && sh === 1) continue;
    try {
      var markup = new XMLSerializer().serializeToString(svg);
      if (!markup || markup.length > 500000) continue;
      var dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
      addPage(dataUrl, { absolute: true, kind: "svg", width: sw, height: sh, mime: "image/svg+xml" });
    } catch (err) {
      /* ignore */
    }
  }

  return {
    pageUrl: location.href,
    host: host,
    title: title,
    description: description,
    siteName: siteName,
    images: images,
    pageImages: pageImages
  };
}

export function extensionFromMime(mime) {
  if (!mime) return null;
  var key = String(mime).split(";")[0].trim().toLowerCase();
  return MIME_EXT[key] || null;
}

export function extensionFromUrl(url) {
  if (!url) return null;
  if (url.indexOf("data:") === 0) {
    var match = /^data:([^;,]+)/i.exec(url);
    return match ? extensionFromMime(match[1]) : null;
  }
  try {
    var path = new URL(url, "https://example.com").pathname;
    var ext = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.exec(path);
    if (!ext) return null;
    var value = ext[1].toLowerCase();
    return value === "jpeg" ? "jpg" : value;
  } catch (err) {
    return null;
  }
}

export function slugify(text) {
  var value = String(text || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (value.length > 80) value = value.slice(0, 80).replace(/-+$/g, "");
  return value;
}

function slugFromUrl(url) {
  if (!url || url.indexOf("data:") === 0) return "";
  try {
    var path = new URL(url, "https://example.com").pathname;
    var base = path.split("/").pop() || "";
    base = base.replace(/\.[^.]+$/, "");
    try {
      base = decodeURIComponent(base);
    } catch (err) {
      /* keep raw */
    }
    return slugify(base);
  } catch (err) {
    return "";
  }
}

export function buildFilename(data, image, mime) {
  var host = slugify((data && data.host) || "page") || "page";
  var rawExt =
    extensionFromUrl(image && image.url) ||
    extensionFromMime(mime) ||
    extensionFromMime(image && image.type) ||
    (image && image.type && IMAGE_TYPES[image.type] ? image.type : null) ||
    "jpg";
  var ext = IMAGE_TYPES[rawExt] ? rawExt : "jpg";
  var fromUrl = slugFromUrl(image && image.url);
  var title;
  if (image && (image.isOg || (image.source && String(image.source).indexOf("og:") === 0))) {
    title = slugify((data && data.title) || (image && image.alt) || "") || fromUrl || "og-image";
  } else {
    title = fromUrl || slugify((image && image.alt) || "") || "image";
  }
  var name = host + "-" + title + "." + ext;
  if (name.length > 150) {
    title = title.slice(0, Math.max(20, 140 - host.length - ext.length - 1));
    name = host + "-" + title + "." + ext;
  }
  return name;
}

export function isRestrictedUrl(url) {
  if (!url) return true;
  try {
    var parsed = new URL(url);
    var protocol = parsed.protocol.toLowerCase();
    if (
      protocol === "chrome:" ||
      protocol === "chrome-extension:" ||
      protocol === "chrome-search:" ||
      protocol === "chrome-devtools:" ||
      protocol === "edge:" ||
      protocol === "about:" ||
      protocol === "devtools:" ||
      protocol === "view-source:" ||
      protocol === "file:" ||
      protocol === "data:" ||
      protocol === "blob:"
    ) {
      return true;
    }
    var host = parsed.hostname;
    if (host === "chrome.google.com" && parsed.pathname.indexOf("/webstore") === 0) {
      return true;
    }
    if (host === "chromewebstore.google.com") return true;
    return false;
  } catch (err) {
    return true;
  }
}
