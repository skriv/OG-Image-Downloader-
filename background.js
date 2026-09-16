"use strict";

importScripts("extract.js");

var MENU_ID = "download-og-image";

function createMenu() {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Скачать OG-картинку",
      contexts: ["page", "action"]
    });
  });
}

chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      reject(reader.error || new Error("Не удалось прочитать файл"));
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
      return { ok: false, error: err.message || "Не удалось скачать" };
    }
  }

  var get = timeoutSignal(20000);
  try {
    var response = await fetch(url, {
      redirect: "follow",
      signal: get.signal
    });
    if (!response.ok) {
      return { ok: false, error: "Сервер вернул " + response.status };
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
    return { ok: false, error: err.message || "Не удалось скачать" };
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
    return { ok: false, error: "На этой странице расширение недоступно" };
  }
  try {
    var data = await extractFromTab(tab.id);
    var image = data && data.images && data.images[0];
    if (!image) {
      flashBadge("!");
      return { ok: false, error: "На этой странице нет OG-картинки" };
    }
    var result = await downloadWithFallback(image.url, buildFilename(data, image));
    flashBadge(result.ok ? "OK" : "!");
    return result;
  } catch (err) {
    flashBadge("!");
    return { ok: false, error: err.message || "Не удалось скачать" };
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
});
