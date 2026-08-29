import { appStore, useAppStore } from '../state/store'
import { undoLastChange } from '../state/history'

export function StatusRail() {
  const data = useAppStore((state) => state.data)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const webmcp = useAppStore((state) => state.ui)
  const place = useAppStore((state) => state.place)
  const label = !mapReady
    ? 'Loading the map…'
    : data.verificationStatus === 'verifying'
      ? 'Double-checking…'
      : data.lock?.kind === 'verified'
        ? 'Confirmed with OpenStreetMap'
        : data.lock
          ? 'Map locked in'
          : data.status === 'error'
            ? 'Something went wrong'
            : 'Move the map'
  const tone = data.status === 'error' || data.verificationStatus === 'error' ? 'error' : data.lock?.kind === 'verified' ? 'verified' : data.lock ? 'locked' : 'idle'

  return (
    <div className={`status-rail status-rail--${tone}`} aria-label="Live geography context">
      <div><span className="status-dot" /> {label}</div>
      <strong>{data.lock ? place.name : mapReady ? 'Ready' : ''}</strong>
      <span>{data.lock
        ? `${data.features.length.toLocaleString()} OSM-derived streets, parks and waterways in this view`
        : 'Drag to somewhere you know, then keep the view'}</span>
      <span className={`agent-mode agent-mode--${webmcp.webmcpStatus}`}>{webmcp.webmcpAvailable ? 'Agent mode · 10 tools' : 'Manual mode'}</span>
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
