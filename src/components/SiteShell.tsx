import type { ReactNode } from 'react'
import { useAppStore } from '../state/store'

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
          {onAgent ? <AgentBadge onClick={onAgent} open={Boolean(agentOpen)} /> : null}
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

/**
 * Whether an agent can actually drive this page, stated in the header.
 *
 * This is the WebMCP claim, so it belongs where it is always visible rather
 * than behind the drawer it opens.
 */
function AgentBadge({ onClick, open }: { onClick: () => void; open: boolean }) {
  const available = useAppStore((state) => state.ui.webmcpAvailable)
  return (
    <button
      type="button"
      className={`agent-mode agent-toggle ${available ? 'agent-mode--available' : ''} ${open ? 'agent-toggle--on' : ''}`}
      onClick={onClick}
      title={available ? 'This browser exposes WebMCP' : 'No WebMCP here — the walkthrough runs the same tools'}
    >
      {available ? 'Agent mode · 10 tools' : 'Manual mode'}
    </button>
  )
}
