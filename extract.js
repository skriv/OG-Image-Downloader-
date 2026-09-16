(function (root) {
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

  function extractOpenGraph() {
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

    return {
      pageUrl: location.href,
      host: host,
      title: title,
      description: description,
      siteName: siteName,
      images: images
    };
  }

  function extensionFromMime(mime) {
    if (!mime) return null;
    var key = String(mime).split(";")[0].trim().toLowerCase();
    return MIME_EXT[key] || null;
  }

  function extensionFromUrl(url) {
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

  function slugify(text) {
    var value = String(text || "")
      .replace(/[\/\\:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");
    if (value.length > 80) value = value.slice(0, 80).replace(/[-.]+$/g, "");
    return value;
  }

  function buildFilename(data, image, mime) {
    var host = slugify((data && data.host) || "page") || "page";
    var title = slugify((data && data.title) || (image && image.alt) || "") || "og-image";
    var ext =
      extensionFromUrl(image && image.url) ||
      extensionFromMime(mime) ||
      extensionFromMime(image && image.type) ||
      "jpg";
    var name = host + "-" + title + "." + ext;
    if (name.length > 150) {
      title = title.slice(0, Math.max(20, 140 - host.length - ext.length - 1));
      name = host + "-" + title + "." + ext;
    }
    return name;
  }

  function isRestrictedUrl(url) {
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

  root.extractOpenGraph = extractOpenGraph;
  root.extensionFromMime = extensionFromMime;
  root.extensionFromUrl = extensionFromUrl;
  root.buildFilename = buildFilename;
  root.isRestrictedUrl = isRestrictedUrl;
})(typeof self !== "undefined" ? self : this);
