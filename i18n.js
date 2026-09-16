"use strict";

var DEFAULT_LOCALE = "en";
var currentLocale = DEFAULT_LOCALE;

function getLocales() {
  var pack = typeof I18N_LOCALES === "object" && I18N_LOCALES ? I18N_LOCALES : {};
  return Object.keys(pack).map(function (code) {
    return { code: code, name: pack[code].name || code };
  });
}

function resolveLocale(code) {
  if (code && typeof I18N_LOCALES === "object" && I18N_LOCALES[code]) return code;
  return DEFAULT_LOCALE;
}

function t(key, vars) {
  var pack = (typeof I18N_LOCALES === "object" && I18N_LOCALES[currentLocale]) || {};
  var fallback = (typeof I18N_LOCALES === "object" && I18N_LOCALES[DEFAULT_LOCALE]) || {};
  var text =
    (pack.strings && pack.strings[key]) ||
    (fallback.strings && fallback.strings[key]) ||
    key;
  if (vars) {
    Object.keys(vars).forEach(function (name) {
      text = text.split("{" + name + "}").join(String(vars[name]));
    });
  }
  return text;
}

function applyDomTranslations(root) {
  if (typeof document === "undefined") return;
  var scope = root || document;
  var nodes = scope.querySelectorAll("[data-i18n]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
  }
  var htmlNodes = scope.querySelectorAll("[data-i18n-html]");
  for (var j = 0; j < htmlNodes.length; j++) {
    htmlNodes[j].innerHTML = t(htmlNodes[j].getAttribute("data-i18n-html"));
  }
  if (document.documentElement) {
    document.documentElement.lang = currentLocale;
  }
}

function loadLocale() {
  return new Promise(function (resolve) {
    chrome.storage.local.get({ locale: DEFAULT_LOCALE }, function (data) {
      currentLocale = resolveLocale(data && data.locale);
      resolve(currentLocale);
    });
  });
}

function setLocale(code) {
  currentLocale = resolveLocale(code);
  return chrome.storage.local.set({ locale: currentLocale });
}
