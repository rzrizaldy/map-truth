import { appStore, useAppStore } from '../state/store'
import { undoLastChange } from '../state/history'

export function StatusRail() {
  const data = useAppStore((state) => state.data)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const webmcp = useAppStore((state) => state.ui)
  const place = useAppStore((state) => state.place)
  const label = !mapReady
    ? 'LOADING SOURCES'
    : data.verificationStatus === 'verifying'
      ? 'VERIFYING OSM'
      : data.lock?.kind === 'verified'
        ? 'OSM VERIFIED'
        : data.lock
          ? 'LIVE OSM LOCK'
          : data.status === 'error'
            ? 'LOCK ERROR'
            : 'EXPLORE'
  const tone = data.status === 'error' || data.verificationStatus === 'error' ? 'error' : data.lock?.kind === 'verified' ? 'verified' : data.lock ? 'locked' : 'idle'

  return (
    <div className={`status-rail status-rail--${tone}`} aria-label="Live geography context">
      <div><span className="status-dot" /> {label}</div>
      <strong>{data.features.length ? `${data.features.length.toLocaleString()} paths` : mapReady ? 'vector sources ready' : 'connecting to tiles'}</strong>
      <span>{data.lock ? `${place.name} · ${data.lock.geometryHash.slice(0, 13)}` : 'move the map, then lock the viewport'}</span>
      <span className="cost-boundary">Cost gate on</span>
      <span className={`agent-mode agent-mode--${webmcp.webmcpStatus}`}>{webmcp.webmcpAvailable ? 'Agent mode · 8 tools' : 'Manual mode'}</span>
    </div>
  )
}

export function AgentReceiptRail() {
  const activity = useAppStore((state) => state.activity)
  const selectedId = useAppStore((state) => state.ui.selectedReceiptId)
  const canUndo = useAppStore((state) => state.ui.canUndo)
  return (
    <aside className="receipt-rail" aria-label="Visible agent execution receipts">
      <div className="receipt-heading">
        <div><span>VISIBLE TOOL RECEIPTS</span><strong>Every action leaves evidence</strong></div>
        <button type="button" disabled={!canUndo} onClick={() => void undoLastChange()}>Undo last change</button>
      </div>
      <div className="receipt-list">
        {activity.length ? activity.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={`receipt receipt--${entry.status} ${selectedId === entry.id ? 'receipt--selected' : ''}`}
            onClick={() => appStore.setState((state) => ({ ui: { ...state.ui, selectedReceiptId: entry.id } }))}
          >
            <time>{entry.time}</time>
            <span className="receipt-tool">{entry.tool}</span>
            <p>{entry.summary}</p>
            <small>{entry.source ?? 'system'}{entry.durationMs != null ? ` · ${entry.durationMs}ms` : ''}{entry.afterHash ? ` · ${entry.afterHash.slice(0, 13)}` : ''}</small>
          </button>
        )) : <p className="receipt-empty">The first map or WebMCP action will appear here.</p>}
      </div>
    </aside>
  )
}
