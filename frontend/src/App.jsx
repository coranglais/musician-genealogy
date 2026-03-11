import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SearchResults from './pages/SearchResults'
import MusicianDetail from './pages/MusicianDetail'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/musician/:id" element={<MusicianDetail />} />
      </Route>
    </Routes>
  )
}
