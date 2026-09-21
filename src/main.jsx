/* eslint-disable react-refresh/only-export-components -- entry point, nothing imports from it, so Fast Refresh boundaries don't apply */
import React, { Suspense, lazy, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import "./index.css";

import App from "./App";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import MaintenancePage from "./pages/MaintenancePage";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

// Supabase egress-quota incident (Aug 2026) resolved — worker fixes
// verified against live Supabase and confirmed clean in Railway prod logs.
const MAINTENANCE_ACTIVE = false;

// Every page is its own chunk, fetched only when that route is actually
// visited — without this the whole site shipped on the very first load.
const RankingsPage = lazy(() => import("./pages/RankingsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const About = lazy(() => import("./pages/About"));
const MediaPage = lazy(() => import("./pages/MediaPage"));
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const MatchPageRouter = lazy(() => import("./pages/MatchPageRouter"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const TopPlayersPage = lazy(() => import("./pages/TopPlayersPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));
const VerificationRequestPage = lazy(() => import("./pages/VerificationRequestPage"));
const AdminVerificationPage = lazy(() => import("./pages/AdminVerificationPage"));
const DataStatusPage = lazy(() => import("./pages/DataStatusPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const VetoPage = lazy(() => import("./pages/VetoPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const TournamentPage = lazy(() => import("./pages/TournamentPage"));

function BootShellCleanup() {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("app-boot-shell")?.remove();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}

function RouteLoading() {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#05070a] text-sm font-semibold text-slate-500">
      Loading...
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Application render failed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-5 text-white">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d131a] p-7 text-center">
            <img
              src="/logo.png"
              alt=""
              width="56"
              height="56"
              className="mx-auto h-14 w-14 rounded-2xl"
            />
            <h1 className="mt-5 text-2xl font-black">ESEA Tracker не загрузился</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Похоже, один из файлов сайта не загрузился или произошла ошибка в браузере.
              Перезагрузка обычно решает проблему.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400"
            >
              Перезагрузить
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function Application() {
  return (
    <AppErrorBoundary>
      <BootShellCleanup />
      <React.StrictMode>
        {MAINTENANCE_ACTIVE ? (
          <LanguageProvider>
            <MaintenancePage />
          </LanguageProvider>
        ) : (
          <BrowserRouter>
            <LanguageProvider>
              <AuthProvider>
                <ScrollToTop />

                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route element={<App />}>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/auth/callback" element={<AuthCallbackPage />} />
                      <Route path="/" element={<Home />} />
                      <Route path="/data-status" element={<DataStatusPage />} />
                      <Route path="/calendar" element={<CalendarPage />} />
                      <Route path="/calendar/:id" element={<TournamentPage />} />
                      <Route path="/rankings" element={<RankingsPage />} />
                      <Route path="/teams/:slug" element={<TeamPage />} />
                      <Route path="/team/:slug" element={<TeamPage />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/media" element={<MediaPage />} />
                      <Route path="/matches" element={<MatchesPage />} />
                      <Route path="/match/:id" element={<MatchPageRouter />} />
                      <Route path="/teams/:slug/matches" element={<MatchesPage />} />
                      <Route path="/team/:slug/matches" element={<MatchesPage />} />
                      <Route path="/teams/:slug/stats" element={<StatsPage />} />
                      <Route path="/team/:slug/stats" element={<StatsPage />} />
                      <Route path="/teams/:slug/analytics" element={<AnalyticsPage />} />
                      <Route path="/team/:slug/analytics" element={<AnalyticsPage />} />
                      <Route path="/teams/:slug/veto" element={<VetoPage />} />
                      <Route path="/team/:slug/veto" element={<VetoPage />} />
                      <Route path="/teams/:slug/matches/:matchId" element={<MatchPageRouter />} />
                      <Route path="/team/:slug/matches/:matchId" element={<MatchPageRouter />} />
                      <Route path="/player/:playerId" element={<PlayerPage />} />
                      <Route path="/players/:playerId" element={<PlayerPage />} />
                      <Route path="/matches/:matchId" element={<MatchPageRouter />} />
                      <Route path="/players" element={<TopPlayersPage />} />
                      <Route path="/profile/:username" element={<UserProfilePage />} />
                      <Route path="/profile/:username/edit" element={<EditProfilePage />} />
                      <Route path="/profile/:username/verification" element={<VerificationRequestPage />} />
                      <Route path="/admin/verifications" element={<AdminVerificationPage />} />
                    </Route>
                  </Routes>
                </Suspense>

                <Analytics />
              </AuthProvider>
            </LanguageProvider>
          </BrowserRouter>
        )}
      </React.StrictMode>
    </AppErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Application />);
