import type { ReactNode } from 'react'

type SiteShellProps = {
  children: ReactNode
  headerCode?: string
}

export function SiteShell({ children, headerCode = 'WEBMCP' }: SiteShellProps) {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="MapTruth home"><span>Map</span>Truth</a>
        <nav>
          <a href="#step-1">1 · Ask</a>
          <a href="#step-2">2 · Place</a>
          <a href="#step-3">3 · Compare</a>
        </nav>
        <span className="header-code">{headerCode}</span>
      </header>
      {children}
      <footer>
        <div>
          <strong>MapTruth</strong>
          <p>Provenance against OpenStreetMap-derived geometry—not a claim that OSM is perfectly complete or current.</p>
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          Map data © OpenStreetMap contributors · ODbL 1.0
        </a>
      </footer>
    </main>
  )
}
