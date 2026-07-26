import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import "./index.css";

import App from "./App";
import Home from "./pages/Home";
import RankingsPage from "./pages/RankingsPage";
import TeamPage from "./pages/TeamPage";
import About from "./pages/About";
import MediaPage from "./pages/MediaPage";
import MatchesPage from "./pages/MatchesPage";
import ScrollToTop from "./components/ScrollToTop";
import StatsPage from "./pages/StatsPage";
import MatchPageRouter from "./pages/MatchPageRouter";
import PlayerPage from "./pages/PlayerPage";
import TopPlayersPage from "./pages/TopPlayersPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import UserProfilePage from "./pages/UserProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import VerificationRequestPage from "./pages/VerificationRequestPage";
import AdminVerificationPage from "./pages/AdminVerificationPage";
import DataStatusPage from "./pages/DataStatusPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalendarPage from "./pages/CalendarPage";
import TournamentPage from "./pages/TournamentPage";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
      <AuthProvider>
        <ScrollToTop />

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

        <Analytics />
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);