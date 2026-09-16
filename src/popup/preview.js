const SVG_CONTRAST_DARK = "#f2f2f2";
const SVG_CONTRAST_LIGHT = "#1a1a1a";

export function isSvgImage(image) {
  if (!image) return false;
  if (image.type === "svg" || image.kind === "svg") return true;
  var url = image.url || "";
  return url.indexOf("data:image/svg+xml") === 0 || /\.svg(?:$|[?#])/i.test(url);
}

function decodeSvgMarkup(url) {
  if (!url || url.indexOf("data:image/svg+xml") !== 0) return null;
  var comma = url.indexOf(",");
  if (comma < 0) return null;
  var payload = url.slice(comma + 1);
  try {
    if (/;base64/i.test(url.slice(0, comma))) {
      return decodeURIComponent(escape(atob(payload)));
    }
    return decodeURIComponent(payload);
  } catch (err) {
    return null;
  }
}

function svgHasCurrentColor(markup) {
  return /currentColor/i.test(markup || "");
}

function injectSvgContrast(markup, contrast) {
  if (!svgHasCurrentColor(markup)) return markup;
  return markup.replace(/<svg\b([^>]*)>/i, function (match, attrs) {
    if (/\scolor\s*=/i.test(attrs)) {
      attrs = attrs.replace(/\scolor\s*=\s*(['"]).*?\1/i, ' color="' + contrast + '"');
    } else {
      attrs = ' color="' + contrast + '"' + attrs;
    }
    if (/\sstyle\s*=/i.test(attrs)) {
      attrs = attrs.replace(/\sstyle\s*=\s*(['"])([\s\S]*?)\1/i, function (_, q, style) {
        var next = /color\s*:/i.test(style)
          ? style.replace(/color\s*:\s*[^;]+/i, "color:" + contrast)
          : style.replace(/;?\s*$/, ";color:" + contrast);
        return " style=" + q + next + q;
      });
    } else {
      attrs += ' style="color:' + contrast + '"';
    }
    return "<svg" + attrs + ">";
  });
}

function svgDataUrl(markup) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
}

function contrastForTheme(resolvedTheme) {
  return resolvedTheme === "light" ? SVG_CONTRAST_LIGHT : SVG_CONTRAST_DARK;
}

/** Resolve a display URL for an image (handles SVG currentColor). Mutates image._previewSrc cache keyed by theme. */
export function resolvePreviewSrc(image, resolvedTheme) {
  if (!image || !image.url) return "";
  var themeKey = resolvedTheme === "light" ? "light" : "dark";
  if (image._previewByTheme && image._previewByTheme[themeKey]) {
    return image._previewByTheme[themeKey];
  }
  if (!image._previewByTheme) image._previewByTheme = Object.create(null);

  if (!isSvgImage(image)) {
    image._previewByTheme[themeKey] = image.url;
    return image.url;
  }

  var contrast = contrastForTheme(resolvedTheme);
  var local = decodeSvgMarkup(image.url);
  if (local) {
    var src = svgHasCurrentColor(local) ? svgDataUrl(injectSvgContrast(local, contrast)) : image.url;
    image._previewByTheme[themeKey] = src;
    return src;
  }

  return image.url;
}

export function fetchSvgPreview(image, resolvedTheme) {
  if (!image || !isSvgImage(image) || decodeSvgMarkup(image.url)) {
    return Promise.resolve(resolvePreviewSrc(image, resolvedTheme));
  }
  var themeKey = resolvedTheme === "light" ? "light" : "dark";
  if (image._previewByTheme && image._previewByTheme[themeKey]) {
    return Promise.resolve(image._previewByTheme[themeKey]);
  }
  return fetch(image.url)
    .then(function (res) {
      return res.ok ? res.text() : Promise.reject();
    })
    .then(function (markup) {
      if (!image._previewByTheme) image._previewByTheme = Object.create(null);
      if (!svgHasCurrentColor(markup)) {
        image._previewByTheme[themeKey] = image.url;
        return image.url;
      }
      var src = svgDataUrl(injectSvgContrast(markup, contrastForTheme(resolvedTheme)));
      image._previewByTheme[themeKey] = src;
      return src;
    })
    .catch(function () {
      if (!image._previewByTheme) image._previewByTheme = Object.create(null);
      image._previewByTheme[themeKey] = image.url;
      return image.url;
    });
}

export function sourceLabel(source) {
  if (!source) return "OG";
  if (source.indexOf("og:") === 0) return "OG";
  if (source.indexOf("twitter:") === 0) return "Twitter";
  if (source === "json-ld") return "JSON-LD";
  if (source === "vk:image") return "VK";
  if (source === "link:image_src") return "image_src";
  if (source === "itemprop:image") return "itemprop";
  return source;
}

export function typeLabel(image, probe, extensionFromMime, extensionFromUrl) {
  var mime = (probe && probe.type) || (image && image.type) || "";
  var ext = extensionFromMime(mime) || extensionFromUrl(image && image.url);
  return ext ? ext.toUpperCase() : "";
}

export function formatSize(bytes) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function buildBadgeText(image, probe, natural, extensionFromMime, extensionFromUrl) {
  if (!image) return "";
  var width = (natural && natural.width) || image.width;
  var height = (natural && natural.height) || image.height;
  var parts = [];
  if (width && height) parts.push(width + "×" + height);
  var type = typeLabel(image, probe, extensionFromMime, extensionFromUrl);
  if (type) parts.push(type);
  var size = formatSize(probe && probe.size);
  if (size) parts.push(size);
  var src = sourceLabel(image.source);
  if (src && parts.length === 0) parts.push(src);
  else if (src && src !== "OG") parts.push(src);
  return parts.join(" · ");
}

export const FILTER_ORDER = ["jpg", "png", "webp", "avif", "gif", "svg"];
export const FILTER_I18N = {
  jpg: "filterJpeg",
  png: "filterPng",
  webp: "filterWebp",
  avif: "filterAvif",
  gif: "filterGif",
  svg: "filterSvg"
};
