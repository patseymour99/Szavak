import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { api } from "../api";
import type { Profile } from "@szavak/shared";

export default function Admin() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.listProfiles().then((r) => setProfiles(r.profiles));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">{t("admin.title")}</h1>

      <section className="bg-white rounded shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">{t("admin.createProfile")}</h2>
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await api.createProfile(name, pin);
              setName("");
              setPin("");
              refresh();
            } catch {
              setError(t("common.error"));
            }
          }}
        >
          <label className="text-sm">
            {t("login.name")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block border rounded px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            {t("login.pin")}
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              className="block border rounded px-2 py-1 font-mono"
              pattern="\d{4}"
              required
            />
          </label>
          <button className="bg-slate-900 text-white px-3 py-1.5 rounded">
            {t("common.save")}
          </button>
          {error && <span className="text-rose-600 text-sm">{error}</span>}
        </form>
      </section>

      <section>
        <ul className="bg-white rounded shadow divide-y">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="font-medium">{p.name}</span>
              <button
                onClick={async () => {
                  if (!confirm(t("admin.confirmDelete"))) return;
                  await api.deleteProfile(p.id);
                  refresh();
                }}
                className="ml-auto text-sm text-rose-600 hover:underline"
              >
                {t("admin.deleteProfile")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
