import './App.css'
import { AboutPage } from './pages/About'
import { DemoPage } from './pages/Demo'
import { LandingPage } from './pages/Landing'

function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'

  if (path === '/demo') return <DemoPage />
  if (path === '/about') return <AboutPage />
  return <LandingPage />
}

export default App
