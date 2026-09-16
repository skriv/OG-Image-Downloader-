"use strict";

import { I18N_LOCALES } from "./locales.js";

export const DEFAULT_LOCALE = "en";
export let currentLocale = DEFAULT_LOCALE;

export function getLocales() {
  var pack = typeof I18N_LOCALES === "object" && I18N_LOCALES ? I18N_LOCALES : {};
  return Object.keys(pack).map(function (code) {
    return { code: code, name: pack[code].name || code };
  });
}

export function resolveLocale(code) {
  if (code && typeof I18N_LOCALES === "object" && I18N_LOCALES[code]) return code;
  return DEFAULT_LOCALE;
}

export function t(key, vars) {
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

export function loadLocale() {
  return new Promise(function (resolve) {
    chrome.storage.local.get({ locale: DEFAULT_LOCALE }, function (data) {
      currentLocale = resolveLocale(data && data.locale);
      resolve(currentLocale);
    });
  });
}

export function setLocale(code) {
  currentLocale = resolveLocale(code);
  return chrome.storage.local.set({ locale: currentLocale });
}

export function setCurrentLocale(code) {
  currentLocale = resolveLocale(code);
}
