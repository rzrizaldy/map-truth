import './App.css'
import { useEffect } from 'react'
import { AboutPage } from './pages/About'
import { StudioPage } from './pages/Studio'

function App() {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
  const path = normalizedPath === '/about' ? '/about' : '/'

  useEffect(() => {
    // Keep the old demo link alive; unknown paths return to the studio too.
    if (normalizedPath !== '/' && normalizedPath !== '/about') {
      window.history.replaceState({}, '', `/${window.location.hash}`)
    }
  }, [normalizedPath])

  useEffect(() => {
    document.title = path === '/about'
      ? 'About & Architecture — MapTruth'
      : 'MapTruth — ground generated maps in real geography'
  }, [path])

  return path === '/about' ? <AboutPage /> : <StudioPage />
}

export default App
