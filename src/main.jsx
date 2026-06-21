import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from "@vercel/analytics/react"
import MatchesPage from "./pages/MatchesPage";
import ScrollToTop from "./components/ScrollToTop";
import StatsPage from "./pages/StatsPage";
import MatchPage from "./pages/MatchPage";
import PlayerPage from "./pages/PlayerPage.jsx";

import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom'

import './index.css'

import App from './App'
import TeamPage from './pages/TeamPage'
import About from './pages/About'
import MediaPage from './pages/MediaPage'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>

    <BrowserRouter>

    <ScrollToTop />

      <Routes>

        {/* HOME */}
        <Route
          path="/"
          element={<App />}
        />

        {/* TEAM PAGE */}
        <Route
          path="/teams/:slug"
          element={<TeamPage />}
        />

        {/* ABOUT */}
        <Route
          path="/about"
          element={<About />}
        />

        {/* MEDIA */}
        <Route
          path="/media"
          element={<MediaPage />}
        />

        {/* Matches */}
        <Route
  path="/team/:slug/matches"
  element={<MatchesPage />}
/>

{/* Stats */}
<Route
  path="/team/:slug/stats"
  element={<StatsPage />}
/>

<Route
  path="/team/:slug/matches/:matchId"
  element={<MatchPage />}
/>

<Route
  path="/team/:slug"
  element={<TeamPage />}
/>

<Route path="/players/:nickname"
 element={<PlayerPage />} />

 <Route path="/matches/:matchId" 
 element={<MatchPage />} />

      </Routes>

      <Analytics />

    </BrowserRouter>

  </React.StrictMode>
)