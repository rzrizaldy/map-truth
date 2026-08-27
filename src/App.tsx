import './App.css'
import { useEffect } from 'react'
import { StudioPage } from './pages/Studio'

function App() {
  useEffect(() => {
    // The demo is one page. Older /demo and /about links land on the same journey.
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', `/${window.location.hash}`)
    }
  }, [])

  return <StudioPage />
}

export default App
