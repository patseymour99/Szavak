import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import hu from "./locales/hu.json";
import en from "./locales/en.json";

const STORAGE_KEY = "szavak.lang";

const initial =
  (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "hu";

i18n.use(initReactI18next).init({
  resources: {
    hu: { translation: hu },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: "hu",
  interpolation: { escapeValue: false },
});

export function setUiLanguage(lng: "hu" | "en") {
  i18n.changeLanguage(lng);
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, lng);
  if (typeof document !== "undefined") document.documentElement.lang = lng;
}

export default i18n;
