"use strict";

var state = {
  tab: null,
  data: null,
  index: 0,
  probe: null,
  natural: null,
  statusKey: null,
  statusError: false,
  statusVars: null,
  errorKey: null,
  errorMessage: null
};

var els = {
  host: document.getElementById("host"),
  locale: document.getElementById("locale"),
  refresh: document.getElementById("refresh"),
  loading: document.getElementById("state-loading"),
  restricted: document.getElementById("state-restricted"),
  error: document.getElementById("state-error"),
  errorTitle: document.getElementById("error-title"),
  errorText: document.getElementById("error-text"),
  errorRetry: document.getElementById("error-retry"),
  empty: document.getElementById("state-empty"),
  content: document.getElementById("state-content"),
  preview: document.getElementById("preview"),
  previewImg: document.getElementById("preview-img"),
  previewError: document.getElementById("preview-error"),
  previewRetry: document.getElementById("preview-retry"),
  previewUrl: document.getElementById("preview-url"),
  badge: document.getElementById("badge"),
  title: document.getElementById("title"),
  description: document.getElementById("description"),
  download: document.getElementById("download"),
  copy: document.getElementById("copy"),
  open: document.getElementById("open"),
  thumbsWrap: document.getElementById("thumbs-wrap"),
  thumbs: document.getElementById("thumbs"),
  status: document.getElementById("status")
};

function showOnly(id) {
  els.loading.hidden = id !== "loading";
  els.restricted.hidden = id !== "restricted";
  els.error.hidden = id !== "error";
  els.empty.hidden = id !== "empty";
  els.content.hidden = id !== "content";
}

function setStatus(key, isError, vars) {
  state.statusKey = key || null;
  state.statusError = Boolean(isError);
  state.statusVars = vars || null;
  if (!key) {
    els.status.hidden = true;
    els.status.textContent = "";
    els.status.classList.remove("is-error");
    return;
  }
  els.status.hidden = false;
  els.status.textContent = t(key, vars);
  els.status.classList.toggle("is-error", Boolean(isError));
}

function fillLocaleSelect() {
  els.locale.innerHTML = "";
  getLocales().forEach(function (locale) {
    var option = document.createElement("option");
    option.value = locale.code;
    option.textContent = locale.name;
    if (locale.code === currentLocale) option.selected = true;
    els.locale.appendChild(option);
  });
}

function applyLanguage() {
  applyDomTranslations();
  fillLocaleSelect();
  if (state.statusKey) setStatus(state.statusKey, state.statusError, state.statusVars);
  if (!els.error.hidden) {
    els.errorText.textContent = state.errorKey
      ? t(state.errorKey)
      : state.errorMessage || t("errorFallback");
  }
  var image = currentImage();
  if (image) {
    els.previewImg.alt = image.alt || (state.data && state.data.title) || t("previewAlt");
  }
}

function currentImage() {
  if (!state.data || !state.data.images || !state.data.images.length) return null;
  return state.data.images[state.index] || state.data.images[0];
}

function sourceLabel(source) {
  if (!source) return "OG";
  if (source.indexOf("og:") === 0) return "OG";
  if (source.indexOf("twitter:") === 0) return "Twitter";
  if (source === "json-ld") return "JSON-LD";
  if (source === "vk:image") return "VK";
  if (source === "link:image_src") return "image_src";
  if (source === "itemprop:image") return "itemprop";
  return source;
}

function typeLabel(image, probe) {
  var mime = (probe && probe.type) || (image && image.type) || "";
  var ext = extensionFromMime(mime) || extensionFromUrl(image && image.url);
  return ext ? ext.toUpperCase() : "";
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderBadge() {
  var image = currentImage();
  if (!image) {
    els.badge.textContent = "";
    return;
  }
  var width = (state.natural && state.natural.width) || image.width;
  var height = (state.natural && state.natural.height) || image.height;
  var parts = [];
  if (width && height) parts.push(width + "×" + height);
  var type = typeLabel(image, state.probe);
  if (type) parts.push(type);
  var size = formatSize(state.probe && state.probe.size);
  if (size) parts.push(size);
  var src = sourceLabel(image.source);
  if (src && parts.length === 0) parts.push(src);
  else if (src && src !== "OG") parts.push(src);
  els.badge.textContent = parts.join(" · ");
}

function selectImage(index) {
  if (!state.data || !state.data.images[index]) return;
  state.index = index;
  state.probe = null;
  state.natural = null;
  var image = state.data.images[index];
  els.preview.classList.remove("is-broken");
  els.previewError.hidden = true;
  els.previewUrl.textContent = image.url;
  els.previewImg.alt = image.alt || state.data.title || t("previewAlt");
  els.previewImg.src = image.url;
  renderBadge();
  renderThumbs();
  probeSelected();
}

function renderThumbs() {
  var images = (state.data && state.data.images) || [];
  els.thumbs.innerHTML = "";
  if (images.length < 2) {
    els.thumbsWrap.hidden = true;
    return;
  }
  els.thumbsWrap.hidden = false;
  images.forEach(function (image, index) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "thumb" + (index === state.index ? " is-active" : "");
    button.title = sourceLabel(image.source);
    var img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = image.url;
    button.appendChild(img);
    button.addEventListener("click", function () {
      selectImage(index);
    });
    els.thumbs.appendChild(button);
  });
}

function renderContent() {
  showOnly("content");
  els.host.textContent = state.data.host || "—";
  els.title.textContent = state.data.title || "";
  els.description.textContent = state.data.description || "";
  selectImage(0);
}

function probeSelected() {
  var image = currentImage();
  if (!image) return;
  chrome.runtime.sendMessage({ type: "probe", url: image.url }, function (info) {
    if (chrome.runtime.lastError) return;
    var selected = currentImage();
    if (!selected || selected.url !== image.url) return;
    state.probe = info || null;
    renderBadge();
  });
}

function showError(message, key) {
  showOnly("error");
  state.errorKey = key || null;
  state.errorMessage = message || null;
  els.errorText.textContent = key ? t(key) : message || t("errorFallback");
}

async function loadPage() {
  setStatus("");
  showOnly("loading");
  state.data = null;
  state.index = 0;
  state.probe = null;
  state.natural = null;

  var tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    showError(err.message);
    return;
  }

  var tab = tabs && tabs[0];
  state.tab = tab;
  if (!tab || !tab.id || !tab.url) {
    showOnly("restricted");
    els.host.textContent = "—";
    return;
  }

  els.host.textContent = "";
  try {
    els.host.textContent = new URL(tab.url).hostname.replace(/^www\./, "") || tab.url;
  } catch (err) {
    els.host.textContent = tab.url;
  }

  if (isRestrictedUrl(tab.url)) {
    showOnly("restricted");
    return;
  }

  var results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractOpenGraph
    });
  } catch (err) {
    showError(err.message);
    return;
  }

  var data = results && results[0] && results[0].result;
  if (!data) {
    showError(null, "errorNoMeta");
    return;
  }

  state.data = data;
  if (!data.images || !data.images.length) {
    showOnly("empty");
    return;
  }

  renderContent();
}

function setBusy(busy) {
  els.download.disabled = busy;
  els.copy.disabled = busy;
  els.open.disabled = busy;
}

async function downloadSelected() {
  var image = currentImage();
  if (!image || !state.data) return;
  setBusy(true);
  setStatus("downloading");
  chrome.runtime.sendMessage(
    {
      type: "download",
      url: image.url,
      filename: buildFilename(state.data, image, state.probe && state.probe.type),
      mime: (state.probe && state.probe.type) || image.type || ""
    },
    function (result) {
      setBusy(false);
      if (chrome.runtime.lastError) {
        els.status.hidden = false;
        els.status.textContent = chrome.runtime.lastError.message;
        els.status.classList.add("is-error");
        state.statusKey = null;
        return;
      }
      if (!result || !result.ok) {
        if (result && result.errorKey) {
          setStatus(result.errorKey, true, result.errorVars);
        } else {
          setStatus("downloadFailed", true);
          if (result && result.error) {
            els.status.textContent = result.error;
          }
        }
        return;
      }
      setStatus("savedToDownloads");
    }
  );
}

async function copySelected() {
  var image = currentImage();
  if (!image) return;
  try {
    await navigator.clipboard.writeText(image.url);
    setStatus("urlCopied");
  } catch (err) {
    setStatus("copyFailed", true);
  }
}

function openSelected() {
  var image = currentImage();
  if (!image) return;
  chrome.tabs.create({ url: image.url });
}

els.previewImg.addEventListener("load", function () {
  els.preview.classList.remove("is-broken");
  els.previewError.hidden = true;
  if (els.previewImg.naturalWidth) {
    state.natural = {
      width: els.previewImg.naturalWidth,
      height: els.previewImg.naturalHeight
    };
  }
  renderBadge();
});

els.previewImg.addEventListener("error", function () {
  els.preview.classList.add("is-broken");
  els.previewError.hidden = false;
  var image = currentImage();
  els.previewUrl.textContent = image ? image.url : "";
});

els.previewRetry.addEventListener("click", function () {
  var image = currentImage();
  if (!image) return;
  els.preview.classList.remove("is-broken");
  els.previewError.hidden = true;
  els.previewImg.removeAttribute("src");
  els.previewImg.src = image.url;
});

els.download.addEventListener("click", downloadSelected);
els.copy.addEventListener("click", copySelected);
els.open.addEventListener("click", openSelected);
els.refresh.addEventListener("click", loadPage);
els.errorRetry.addEventListener("click", loadPage);

els.locale.addEventListener("change", function () {
  setLocale(els.locale.value).then(applyLanguage);
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !els.content.hidden) {
    event.preventDefault();
    downloadSelected();
  }
});

loadLocale().then(function () {
  applyLanguage();
  loadPage();
});
