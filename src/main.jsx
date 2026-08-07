/* eslint-disable react-refresh/only-export-components -- entry point, nothing imports from it, so Fast Refresh boundaries don't apply */
import React, { Suspense, lazy } from "react";
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
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

// Every page is its own chunk, fetched only when that route is actually
// visited — without this the whole site (every page, including the ~2600
// line match-page trio) shipped as one bundle on the very first load.
const Home = lazy(() => import("./pages/Home"));
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

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070a] text-sm font-semibold text-slate-500">
      Loading...
    </div>
  );
}

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
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
              <Route
                path="/rankings"
                element={<RankingsPage />}
              />

              <Route
                path="/teams/:slug"
                element={<TeamPage />}
              />

              <Route
                path="/team/:slug"
                element={<TeamPage />}
              />

              <Route
                path="/about"
                element={<About />}
              />

              <Route
                path="/media"
                element={<MediaPage />}
              />

              <Route
                path="/matches"
                element={<MatchesPage />}
              />

              <Route
                path="/match/:id"
                element={<MatchPageRouter />}
              />

              <Route
                path="/teams/:slug/matches"
                element={<MatchesPage />}
              />

              <Route
                path="/team/:slug/matches"
                element={<MatchesPage />}
              />

              <Route
                path="/teams/:slug/stats"
                element={<StatsPage />}
              />

              <Route
                path="/team/:slug/stats"
                element={<StatsPage />}
              />

              <Route
                path="/teams/:slug/analytics"
                element={<AnalyticsPage />}
              />

              <Route
                path="/team/:slug/analytics"
                element={<AnalyticsPage />}
              />

              <Route
                path="/teams/:slug/veto"
                element={<VetoPage />}
              />

              <Route
                path="/team/:slug/veto"
                element={<VetoPage />}
              />

              <Route
                path="/teams/:slug/matches/:matchId"
                element={<MatchPageRouter />}
              />

              <Route
                path="/team/:slug/matches/:matchId"
                element={<MatchPageRouter />}
              />

              <Route
                path="/player/:playerId"
                element={<PlayerPage />}
              />

              <Route
                path="/players/:playerId"
                element={<PlayerPage />}
              />

              <Route
                path="/matches/:matchId"
                element={<MatchPageRouter />}
              />

              <Route
                path="/players"
                element={<TopPlayersPage />}
              />

              <Route
  path="/profile/:username"
  element={<UserProfilePage />}
/>

<Route
  path="/profile/:username/edit"
  element={<EditProfilePage />}
/>

<Route
  path="/profile/:username/verification"
  element={<VerificationRequestPage />}
/>

<Route
  path="/admin/verifications"
  element={<AdminVerificationPage />}
/>

            </Route>
          </Routes>
        </Suspense>

        <Analytics />
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
