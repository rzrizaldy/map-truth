import type { ReactNode } from 'react'

type SiteShellProps = {
  children: ReactNode
  headerCode?: string
  stage?: 'ask' | 'compare'
  onAgent?: () => void
  agentOpen?: boolean
}

export function SiteShell({ children, headerCode = 'WEBMCP', stage, onAgent, agentOpen }: SiteShellProps) {
  return (
    <main className="app">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="MapTruth home"><span>Map</span>Truth</a>
        {stage ? (
          <nav className="stepper" aria-label="Progress">
            <span className={stage === 'ask' ? 'on' : 'done'}>1 · Ask</span>
            <span className={stage === 'compare' ? 'on' : ''}>2 · Compare</span>
          </nav>
        ) : null}
        <div className="header-right">
          {headerCode && headerCode !== 'MapTruth'
            ? <span className="header-code">{headerCode}</span>
            : null}
          {onAgent ? (
            <button type="button" className={`agent-toggle ${agentOpen ? 'agent-toggle--on' : ''}`} onClick={onAgent}>
              Agent
            </button>
          ) : null}
        </div>
      </header>
      {children}
      <footer>
        <span>Map data © OpenStreetMap contributors · ODbL 1.0</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Attribution</a>
      </footer>
    </main>
  )
}
