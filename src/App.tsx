import './App.css'
import { useEffect, useState } from 'react'
import { AboutPage } from './pages/About'
import { DemoPage } from './pages/Demo'
import { LandingPage } from './pages/Landing'

function App() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/$/, '') || '/')

  useEffect(() => {
    const sync = () => setPath(window.location.pathname.replace(/\/$/, '') || '/')
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target || anchor.download) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || !['/', '/demo', '/about'].includes(url.pathname.replace(/\/$/, '') || '/')) return
      event.preventDefault()
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
      sync()
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', sync)
    document.addEventListener('click', onClick)
    return () => { window.removeEventListener('popstate', sync); document.removeEventListener('click', onClick) }
  }, [])

  if (path === '/demo') return <DemoPage />
  if (path === '/about') return <AboutPage />
  return <LandingPage />
}

export default App
