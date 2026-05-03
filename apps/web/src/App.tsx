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

  useEffect(() => {
    api.me().then((r) => {
      setProfile(r.profile);
      setLoaded(true);
    });
  }, [setProfile]);

  if (!loaded) return null;

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
