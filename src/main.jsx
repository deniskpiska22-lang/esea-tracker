import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from "@vercel/analytics/react"

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

      </Routes>

      <Analytics />

    </BrowserRouter>

  </React.StrictMode>
)