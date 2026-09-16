"use strict";

import { t, loadLocale, resolveLocale, setCurrentLocale } from "./shared/i18n.js";
import { extractOpenGraph, buildFilename, isRestrictedUrl } from "./shared/extract.js";
import { buildZip } from "./shared/zip.js";

var MENU_ID = "download-og-image";

function createMenu() {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: t("contextMenuDownload"),
      contexts: ["page", "action"]
    });
  });
}

function loadLocaleAndMenu() {
  loadLocale().then(createMenu);
}

chrome.runtime.onInstalled.addListener(loadLocaleAndMenu);
chrome.runtime.onStartup.addListener(loadLocaleAndMenu);
loadLocaleAndMenu();

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== "local" || !changes.locale) return;
  setCurrentLocale(changes.locale.newValue);
  createMenu();
});

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      reject(reader.error || new Error(t("readFileFailed")));
    };
    reader.readAsDataURL(blob);
  });
}

function timeoutSignal(ms) {
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, ms);
  return { signal: controller.signal, cancel: function () { clearTimeout(timer); } };
}

async function probeImage(url) {
  if (!url || url.indexOf("data:") === 0) return null;
  var head = timeoutSignal(4000);
  try {
    var response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: head.signal
    });
    if (response.ok) {
      var type = response.headers.get("content-type");
      var length = response.headers.get("content-length");
      if (type || length) {
        return {
          type: type,
          size: length ? Number(length) : null
        };
      }
    }
  } catch (err) {
    /* HEAD is often blocked; GET fallback is too heavy for a probe */
  } finally {
    head.cancel();
  }
  return null;
}

async function downloadWithFallback(url, filename) {
  try {
    var id = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    return { ok: true, id: id };
  } catch (err) {
    if (url.indexOf("data:") === 0) {
      return { ok: false, errorKey: "downloadFailed", error: err.message || t("downloadFailed") };
    }
  }

  var get = timeoutSignal(20000);
  try {
    var response = await fetch(url, {
      redirect: "follow",
      signal: get.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        errorKey: "serverStatus",
        errorVars: { status: response.status },
        error: t("serverStatus", { status: response.status })
      };
    }
    var blob = await response.blob();
    var dataUrl = await blobToDataUrl(blob);
    var id = await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    return { ok: true, id: id };
  } catch (err) {
    return { ok: false, errorKey: "downloadFailed", error: err.message || t("downloadFailed") };
  } finally {
    get.cancel();
  }
}

async function extractFromTab(tabId) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: extractOpenGraph
  });
  return results && results[0] && results[0].result;
}

function flashBadge(text) {
  chrome.action.setBadgeBackgroundColor({ color: "#e8a317" });
  chrome.action.setBadgeText({ text: text });
  setTimeout(function () {
    chrome.action.setBadgeText({ text: "" });
  }, 2500);
}

async function downloadFromTab(tab) {
  if (!tab || !tab.id || !tab.url || isRestrictedUrl(tab.url)) {
    flashBadge("!");
    return { ok: false, errorKey: "pageRestricted", error: t("pageRestricted") };
  }
  try {
    var data = await extractFromTab(tab.id);
    var image = data && data.images && data.images[0];
    if (!image) {
      flashBadge("!");
      return { ok: false, errorKey: "noOgImage", error: t("noOgImage") };
    }
    var result = await downloadWithFallback(image.url, buildFilename(data, image));
    flashBadge(result.ok ? "OK" : "!");
    return result;
  } catch (err) {
    flashBadge("!");
    return { ok: false, errorKey: "downloadFailed", error: err.message || t("downloadFailed") };
  }
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== MENU_ID) return;
  downloadFromTab(tab);
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;

  if (message.type === "probe") {
    probeImage(message.url).then(sendResponse);
    return true;
  }

  if (message.type === "download") {
    downloadWithFallback(message.url, message.filename).then(sendResponse);
    return true;
  }

  if (message.type === "downloadMany") {
    downloadMany(message.items || [], Boolean(message.zip), message.zipName || "images.zip").then(sendResponse);
    return true;
  }
});

function notifyPopup(payload) {
  chrome.runtime.sendMessage(payload, function () {
    void chrome.runtime.lastError;
  });
}

async function fetchBytes(url) {
  if (url.indexOf("data:") === 0) {
    var res = await fetch(url);
    var buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
  var get = timeoutSignal(20000);
  try {
    var response = await fetch(url, { redirect: "follow", signal: get.signal });
    if (!response.ok) throw new Error(String(response.status));
    var buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } finally {
    get.cancel();
  }
}

async function downloadMany(items, zip, zipName) {
  if (!items.length) {
    return { ok: false, errorKey: "noneSelected" };
  }

  if (zip) {
    var files = [];
    for (var i = 0; i < items.length; i++) {
      notifyPopup({
        type: "downloadProgress",
        current: i + 1,
        total: items.length
      });
      try {
        files.push({
          name: items[i].filename || "image-" + (i + 1) + ".jpg",
          bytes: await fetchBytes(items[i].url)
        });
      } catch (err) {
        /* skip failed fetches */
      }
    }
    if (!files.length) return { ok: false, errorKey: "downloadFailed" };
    var zipBytes = buildZip(files);
    var blob = new Blob([zipBytes], { type: "application/zip" });
    var objectUrl = URL.createObjectURL(blob);
    try {
      var id = await chrome.downloads.download({
        url: objectUrl,
        filename: zipName,
        saveAs: false,
        conflictAction: "uniquify"
      });
      return { ok: true, zip: true, id: id, count: files.length, total: items.length };
    } catch (err) {
      var dataUrl = await blobToDataUrl(blob);
      var zipId = await chrome.downloads.download({
        url: dataUrl,
        filename: zipName,
        saveAs: false,
        conflictAction: "uniquify"
      });
      return { ok: true, zip: true, id: zipId, count: files.length, total: items.length };
    } finally {
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    }
  }

  var ok = 0;
  for (var d = 0; d < items.length; d++) {
    notifyPopup({
      type: "downloadProgress",
      current: d + 1,
      total: items.length
    });
    var result = await downloadWithFallback(items[d].url, items[d].filename);
    if (result && result.ok) ok += 1;
    await new Promise(function (resolve) {
      setTimeout(resolve, 120);
    });
  }
  return { ok: ok > 0, count: ok, total: items.length };
}
