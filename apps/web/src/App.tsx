import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";
import { useSession } from "./store";
import Login from "./pages/Login";
import Home from "./pages/Home";
import SoloPuzzle from "./pages/SoloPuzzle";
import CollabPuzzle from "./pages/CollabPuzzle";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";

export default function App() {
  const { profile, setProfile } = useSession();
  const [loaded, setLoaded] = useState(false);
  const loc = useLocation();

  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((r) => setProfile(r.profile))
      .catch((err) => {
        console.error("/api/auth/me failed:", err);
        setAuthError(err instanceof Error ? err.message : String(err));
        setProfile(null);
      })
      .finally(() => setLoaded(true));
  }, [setProfile]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Betöltés…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <pre className="bg-red-50 text-red-800 p-4 rounded text-xs max-w-xl whitespace-pre-wrap">
          API error talking to /api/auth/me — {authError}
        </pre>
      </div>
    );
  }

  const requireAuth = (el: JSX.Element) =>
    profile ? el : <Navigate to="/login" state={{ from: loc }} replace />;

  return (
    <Routes>
      <Route path="/login" element={profile ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={requireAuth(<Home />)} />
      <Route path="/daily" element={requireAuth(<SoloPuzzle />)} />
      <Route path="/collab" element={requireAuth(<CollabPuzzle />)} />
      <Route path="/leaderboard" element={requireAuth(<Leaderboard />)} />
      <Route path="/admin" element={requireAuth(<Admin />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
