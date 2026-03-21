import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SearchResults from './pages/SearchResults'
import MusicianDetail from './pages/MusicianDetail'
import AboutPage from './pages/AboutPage'
import SubmitPage from './pages/SubmitPage'
import AdminLogin from './pages/AdminLogin'
import PrivacyPolicy from './pages/PrivacyPolicy'
import HowItWorksPage from './pages/HowItWorksPage'
import AdminReviewQueue from './pages/AdminReviewQueue'
import AdminSubmissionDetail from './pages/AdminSubmissionDetail'
import InstrumentsPage from './pages/InstrumentsPage'
import InstrumentDetail from './pages/InstrumentDetail'
import ContactPage from './pages/ContactPage'

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false)

  return (
    <Routes>
      <Route element={<Layout isAdmin={isAdmin} onLogout={() => setIsAdmin(false)} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/musician/:id" element={<MusicianDetail />} />
        <Route path="/instruments" element={<InstrumentsPage />} />
        <Route path="/instrument/:id" element={<InstrumentDetail />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admin/login" element={<AdminLogin onLogin={() => setIsAdmin(true)} />} />
        <Route
          path="/admin"
          element={isAdmin ? <AdminReviewQueue /> : <Navigate to="/admin/login" />}
        />
        <Route
          path="/admin/submissions/:id"
          element={isAdmin ? <AdminSubmissionDetail /> : <Navigate to="/admin/login" />}
        />
      </Route>
    </Routes>
  )
}
