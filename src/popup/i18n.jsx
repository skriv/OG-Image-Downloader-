import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  currentLocale as sharedLocale,
  getLocales,
  loadLocale,
  setLocale as persistLocale,
  t as translate
} from "../shared/i18n.js";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(sharedLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadLocale().then((code) => {
      setLocaleState(code);
      if (typeof document !== "undefined") {
        document.documentElement.lang = code;
      }
      setReady(true);
    });
  }, []);

  const setLocale = useCallback(async (code) => {
    await persistLocale(code);
    setLocaleState(code);
    if (typeof document !== "undefined") {
      document.documentElement.lang = code;
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      void locale;
      return translate(key, vars);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: getLocales(),
      ready
    }),
    [locale, setLocale, t, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
