import type { ReactNode } from 'react'

type SiteShellProps = {
  children: ReactNode
  headerCode?: string
}

export function SiteShell({ children, headerCode = 'WEBMCP' }: SiteShellProps) {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="MapTruth home"><span>MAP</span>TRUTH</a>
        <nav>
          <a href="/demo">Demo</a>
          <a href="/about">About</a>
        </nav>
        <span className="header-code">{headerCode}</span>
      </header>
      {children}
      <footer>
        <div>
          <strong>MAPTRUTH</strong>
          <p>Provenance against OpenStreetMap-derived geometry—not a claim that OSM is perfectly complete or current.</p>
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          Map data © OpenStreetMap contributors · ODbL 1.0
        </a>
      </footer>
    </main>
  )
}

export function HeroMap() {
  return (
    <svg viewBox="0 0 440 360" role="img" aria-label="Illustrative fabricated map poster demonstrating invented geography">
      <rect width="440" height="360" fill="#D43D28" />
      <path d="M-20 270C90 180 105 232 206 146S322 95 465 25" fill="none" stroke="#FFF9EC" strokeWidth="26" />
      <path d="M48 28L155 330M330 6L256 359M15 125L418 257" fill="none" stroke="#141512" strokeWidth="7" />
      <path d="M80 70L172 98L146 176L54 149ZM300 198L400 220L372 309L282 279Z" fill="#F2E7CF" stroke="#141512" strokeWidth="5" />
      <circle cx="223" cy="155" r="22" fill="#141512" />
      <text x="24" y="338" fontFamily="IBM Plex Mono,monospace" fontSize="13" fill="#FFF9EC" letterSpacing="2">ILLUSTRATIVE / FABRICATED MAP</text>
    </svg>
  )
}
