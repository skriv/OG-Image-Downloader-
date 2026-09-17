"use strict";

import { t, loadLocale, setCurrentLocale } from "./shared/i18n.js";
import { extractOpenGraph, buildFilename, isRestrictedUrl } from "./shared/extract.js";
import { buildZip } from "./shared/zip.js";
import {
  ensureImageFilename,
  resolveImageDownload,
  fetchImageBytes,
  buildDownloadCandidates,
  bytesToDataUrl,
  canCreateObjectUrl
} from "./shared/download.js";

var MENU_ID = "download-og-image";
var menuQueue = Promise.resolve();

function createMenu() {
  menuQueue = menuQueue.then(function () {
    return new Promise(function (resolve) {
      chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create(
          {
            id: MENU_ID,
            title: t("contextMenuDownload"),
            contexts: ["page", "action"]
          },
          function () {
            void chrome.runtime.lastError;
            resolve();
          }
        );
      });
    });
  });
  return menuQueue;
}

function updateMenuTitle() {
  menuQueue = menuQueue.then(function () {
    return new Promise(function (resolve) {
      chrome.contextMenus.update(
        MENU_ID,
        { title: t("contextMenuDownload") },
        function () {
          if (chrome.runtime.lastError) {
            chrome.contextMenus.create(
              {
                id: MENU_ID,
                title: t("contextMenuDownload"),
                contexts: ["page", "action"]
              },
              function () {
                void chrome.runtime.lastError;
                resolve();
              }
            );
            return;
          }
          resolve();
        }
      );
    });
  });
  return menuQueue;
}

function loadLocaleAndMenu() {
  return loadLocale().then(createMenu);
}

function ensureLocaleAndMenu() {
  return loadLocale().then(updateMenuTitle);
}

chrome.runtime.onInstalled.addListener(loadLocaleAndMenu);
chrome.runtime.onStartup.addListener(ensureLocaleAndMenu);
ensureLocaleAndMenu();

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== "local" || !changes.locale) return;
  setCurrentLocale(changes.locale.newValue);
  updateMenuTitle();
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

async function probeImage(url, pageUrl) {
  if (!url || url.indexOf("data:") === 0) return null;
  var candidates = buildDownloadCandidates(url, pageUrl);
  for (var i = 0; i < candidates.length; i++) {
    var head = timeoutSignal(4000);
    try {
      var response = await fetch(candidates[i], {
        method: "HEAD",
        redirect: "follow",
        signal: head.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer"
      });
      if (response.ok) {
        var type = response.headers.get("content-type");
        var length = response.headers.get("content-length");
        if (type || length) {
          return {
            type: type,
            size: length ? Number(length) : null,
            url: candidates[i]
          };
        }
      }
    } catch (err) {
      /* HEAD is often blocked; GET fallback is too heavy for a probe */
    } finally {
      head.cancel();
    }
  }
  return null;
}

async function saveBytesAsDownload(bytes, mime, filename) {
  // Prefer data: URLs — URL.createObjectURL is missing in MV3 service workers,
  // and calling it before a try/catch previously aborted successful fetches.
  var dataUrl = bytesToDataUrl(bytes, mime);
  try {
    var dataId = await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    return { ok: true, id: dataId };
  } catch (dataErr) {
    if (!canCreateObjectUrl()) {
      throw dataErr;
    }
    var blob = new Blob([bytes], { type: mime || "application/octet-stream" });
    var objectUrl = URL.createObjectURL(blob);
    try {
      var id = await chrome.downloads.download({
        url: objectUrl,
        filename: filename,
        saveAs: false,
        conflictAction: "uniquify"
      });
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
      return { ok: true, id: id };
    } catch (err) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (revokeErr) {
        /* ignore */
      }
      var fallbackUrl = await blobToDataUrl(blob);
      var fallbackId = await chrome.downloads.download({
        url: fallbackUrl,
        filename: filename,
        saveAs: false,
        conflictAction: "uniquify"
      });
      return { ok: true, id: fallbackId };
    }
  }
}

function waitForDownloadTerminal(downloadId, timeoutMs) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      finish({ ok: false, errorKey: "downloadFailed" });
    }, timeoutMs || 30000);

    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve(result);
    }

    function onChanged(delta) {
      if (!delta || delta.id !== downloadId) return;
      if (delta.state && delta.state.current === "complete") {
        finish({ ok: true, id: downloadId });
        return;
      }
      if (delta.state && delta.state.current === "interrupted") {
        finish({ ok: false, errorKey: "downloadFailed" });
      }
    }

    chrome.downloads.onChanged.addListener(onChanged);
    chrome.downloads.search({ id: downloadId }, function (items) {
      var item = items && items[0];
      if (!item) return;
      if (item.state === "complete") finish({ ok: true, id: downloadId });
      if (item.state === "interrupted") finish({ ok: false, errorKey: "downloadFailed" });
    });
  });
}

async function downloadDirectRemote(url, filename) {
  try {
    var id = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    return waitForDownloadTerminal(id, 25000);
  } catch (err) {
    return { ok: false, errorKey: "downloadFailed", error: err.message || t("downloadFailed") };
  }
}

async function downloadWithFallback(url, filename, pageUrl) {
  if (!url) {
    return { ok: false, errorKey: "downloadFailed", error: t("downloadFailed") };
  }

  var resolved = await resolveImageDownload(url, pageUrl);
  if (resolved.ok) {
    var finalName = ensureImageFilename(filename, resolved.mime, resolved.url, resolved.bytes);
    try {
      return await saveBytesAsDownload(
        resolved.bytes,
        resolved.mime || "application/octet-stream",
        finalName
      );
    } catch (err) {
      return { ok: false, errorKey: "downloadFailed", error: err.message || t("downloadFailed") };
    }
  }

  // Last resort: let Chrome fetch the remote URL, but only accept a completed download.
  var candidates = buildDownloadCandidates(url, pageUrl);
  for (var i = 0; i < candidates.length; i++) {
    var direct = await downloadDirectRemote(candidates[i], filename);
    if (direct && direct.ok) return direct;
  }

  if (resolved.error && String(resolved.error).indexOf("status-") === 0) {
    var status = String(resolved.error).slice("status-".length);
    return {
      ok: false,
      errorKey: "serverStatus",
      errorVars: { status: status },
      error: t("serverStatus", { status: status })
    };
  }

  return { ok: false, errorKey: "downloadFailed", error: t("downloadFailed") };
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
    var result = await downloadWithFallback(
      image.url,
      buildFilename(data, image),
      (data && data.pageUrl) || tab.url
    );
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
    probeImage(message.url, message.pageUrl).then(sendResponse);
    return true;
  }

  if (message.type === "download") {
    downloadWithFallback(message.url, message.filename, message.pageUrl).then(sendResponse);
    return true;
  }

  if (message.type === "downloadMany") {
    downloadMany(
      message.items || [],
      Boolean(message.zip),
      message.zipName || "images.zip",
      message.pageUrl
    ).then(sendResponse);
    return true;
  }
});

function notifyPopup(payload) {
  chrome.runtime.sendMessage(payload, function () {
    void chrome.runtime.lastError;
  });
}

async function fetchBytes(url, pageUrl) {
  if (url.indexOf("data:") === 0) {
    var payload = await fetchImageBytes(url);
    return payload.bytes;
  }
  var resolved = await resolveImageDownload(url, pageUrl);
  if (!resolved.ok) throw new Error(resolved.error || "downloadFailed");
  return resolved.bytes;
}

async function downloadMany(items, zip, zipName, pageUrl) {
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
        var bytes = await fetchBytes(items[i].url, pageUrl);
        files.push({
          name: ensureImageFilename(
            items[i].filename || "image-" + (i + 1) + ".jpg",
            null,
            items[i].url,
            bytes
          ),
          bytes: bytes
        });
      } catch (err) {
        /* skip failed fetches */
      }
    }
    if (!files.length) return { ok: false, errorKey: "downloadFailed" };
    var zipBytes = buildZip(files);
    try {
      var saved = await saveBytesAsDownload(zipBytes, "application/zip", zipName);
      return { ok: true, zip: true, id: saved.id, count: files.length, total: items.length };
    } catch (err) {
      return { ok: false, errorKey: "downloadFailed" };
    }
  }

  var ok = 0;
  for (var d = 0; d < items.length; d++) {
    notifyPopup({
      type: "downloadProgress",
      current: d + 1,
      total: items.length
    });
    var result = await downloadWithFallback(items[d].url, items[d].filename, pageUrl);
    if (result && result.ok) ok += 1;
    await new Promise(function (resolve) {
      setTimeout(resolve, 120);
    });
  }
  return { ok: ok > 0, count: ok, total: items.length };
}
