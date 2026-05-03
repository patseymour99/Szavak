import { useTranslation } from "react-i18next";
import { setUiLanguage } from "../i18n";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const lng = i18n.language as "hu" | "en";
  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">{t("language.label")}:</span>
      <button
        onClick={() => setUiLanguage("hu")}
        className={`px-2 py-0.5 rounded ${
          lng === "hu" ? "bg-slate-900 text-white" : "bg-slate-200"
        }`}
      >
        HU
      </button>
      <button
        onClick={() => setUiLanguage("en")}
        className={`px-2 py-0.5 rounded ${
          lng === "en" ? "bg-slate-900 text-white" : "bg-slate-200"
        }`}
      >
        EN
      </button>
    </div>
  );
}
