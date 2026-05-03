import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useSession } from "../store";
import type { Profile } from "@szavak/shared";
import { Layout } from "../components/Layout";

export default function Login() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const setProfile = useSession((s) => s.setProfile);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap (no profiles) flow:
  const [bootstrapName, setBootstrapName] = useState("");
  const [bootstrapPin, setBootstrapPin] = useState("");
  const [bootstrapBoot, setBootstrapBoot] = useState("");

  useEffect(() => {
    api.listProfiles().then((r) => {
      setProfiles(r.profiles);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Layout>
        <p>{t("common.loading")}</p>
      </Layout>
    );
  }

  if (profiles.length === 0) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">{t("login.createFirst")}</h2>
          <p className="text-sm text-slate-600 mb-3">{t("login.bootstrapPrompt")}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await api.createProfile(bootstrapName, bootstrapPin, bootstrapBoot);
                const r = await api.listProfiles();
                setProfiles(r.profiles);
              } catch {
                setError(t("login.invalid"));
              }
            }}
            className="space-y-2"
          >
            <label className="block text-sm">
              {t("login.name")}
              <input
                value={bootstrapName}
                onChange={(e) => setBootstrapName(e.target.value)}
                className="block w-full border rounded px-2 py-1"
                required
              />
            </label>
            <label className="block text-sm">
              {t("login.pin")}
              <input
                value={bootstrapPin}
                onChange={(e) => setBootstrapPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                pattern="\d{4}"
                className="block w-full border rounded px-2 py-1 font-mono"
                required
              />
            </label>
            <label className="block text-sm">
              Bootstrap PIN
              <input
                value={bootstrapBoot}
                onChange={(e) => setBootstrapBoot(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                pattern="\d{4}"
                className="block w-full border rounded px-2 py-1 font-mono"
                required
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button className="w-full bg-slate-900 text-white py-1.5 rounded">
              {t("login.create")}
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  if (!picked) {
    return (
      <Layout>
        <h2 className="text-lg font-semibold mb-4">{t("login.title")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPicked(p)}
              className="rounded-xl shadow bg-white p-4 flex flex-col items-center gap-2 hover:shadow-md"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: p.color }}
              >
                {p.name.slice(0, 1).toLocaleUpperCase("hu-HU")}
              </div>
              <span className="font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-sm mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: picked.color }}
          >
            {picked.name.slice(0, 1).toLocaleUpperCase("hu-HU")}
          </div>
          <div className="font-medium">{picked.name}</div>
        </div>
        <p className="text-sm text-slate-600 mb-3">{t("login.pinPrompt")}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              const r = await api.login(picked.id, pin);
              setProfile(r.profile);
              nav("/");
            } catch {
              setError(t("login.invalid"));
            }
          }}
          className="space-y-2"
        >
          <input
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            pattern="\d{4}"
            className="block w-full border rounded px-3 py-2 text-center text-2xl tracking-[0.5em] font-mono"
            required
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setPin("");
              }}
              className="flex-1 border rounded py-1.5"
            >
              {t("login.back")}
            </button>
            <button className="flex-1 bg-slate-900 text-white rounded py-1.5">
              {t("login.submit")}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
