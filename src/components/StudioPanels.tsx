import { appStore, useAppStore } from '../state/store'
import { undoLastChange } from '../state/history'
import { exportGroundedArtwork, lockLiveOsm, renderGroundedPoster, verifyGeography, verifyOsmLock } from '../webmcp/commands'

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
      <span className="cost-boundary">GPT IMAGE · EXPLICIT COST GATE</span>
      <span className={`agent-mode agent-mode--${webmcp.webmcpStatus}`}>{webmcp.webmcpAvailable ? 'Agent mode · 8 tools' : 'Manual mode'}</span>
    </div>
  )
}

export function AgentReceiptRail({ compact = false }: { compact?: boolean }) {
  const activity = useAppStore((state) => state.activity)
  const selectedId = useAppStore((state) => state.ui.selectedReceiptId)
  const canUndo = useAppStore((state) => state.ui.canUndo)
  return (
    <aside className={`receipt-rail ${compact ? 'receipt-rail--compact' : ''}`} aria-label="Visible agent execution receipts">
      <div className="receipt-heading">
        <div><span>VISIBLE TOOL RECEIPTS</span><strong>Agent actions leave evidence</strong></div>
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

export function ManualControls() {
  const spec = useAppStore((state) => state.poster.spec)
  const webmcp = useAppStore((state) => state.ui)
  const data = useAppStore((state) => state.data)
  const update = (patch: Partial<typeof spec>) => appStore.setState((state) => ({
    poster: { ...state.poster, spec: { ...state.poster.spec, ...patch } },
  }))

  return (
    <aside className="controls-panel">
      <div className="panel-heading"><span>MANUAL COMMAND PARITY</span><strong>Art direction</strong></div>
      <div className="lock-actions">
        <button className="button button--primary" type="button" onClick={() => void lockLiveOsm()} disabled={!webmcp.mapReady || data.status === 'loading'}>Lock live OSM</button>
        <button className="button" type="button" onClick={() => void verifyOsmLock()} disabled={!data.lock || data.verificationStatus === 'verifying'}>{data.verificationStatus === 'verifying' ? 'Verifying…' : 'Verify with Overpass'}</button>
      </div>
      <label>Title<input value={spec.title} maxLength={80} onChange={(event) => update({ title: event.target.value })} /></label>
      <label>Subtitle<input value={spec.subtitle ?? ''} maxLength={140} onChange={(event) => update({ subtitle: event.target.value })} /></label>
      <label>Preset
        <select value={spec.preset} onChange={(event) => update({ preset: event.target.value as typeof spec.preset })}>
          <option value="editorial">Editorial</option><option value="retro">Retro civic</option><option value="blueprint">Blueprint</option>
        </select>
      </label>
      <label>Palette
        <select value={spec.palette} onChange={(event) => update({ palette: event.target.value as typeof spec.palette })}>
          <option value="red-cream-black">Dispatch red</option><option value="blue-white">Survey blue</option><option value="sunset">Jakarta sunset</option>
        </select>
      </label>
      <label>Labels
        <select value={spec.labelDensity} onChange={(event) => update({ labelDensity: event.target.value as typeof spec.labelDensity })}>
          <option value="minimal">Minimal</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option>
        </select>
      </label>
      <label className="legend-toggle"><input type="checkbox" checked={spec.showLegend} onChange={(event) => update({ showLegend: event.target.checked })} />Show legend</label>
      <div className="button-row">
        <button className="button button--primary" type="button" onClick={() => renderGroundedPoster(appStore.getState().poster.spec)}>Render grounded</button>
        <button className="button" type="button" onClick={() => void verifyGeography()}>Open truth seam</button>
      </div>
      <div className="button-row">
        <button className="button button--small" type="button" onClick={() => void exportGroundedArtwork({ format: 'svg' })}>Export SVG</button>
        <button className="button button--small" type="button" onClick={() => void exportGroundedArtwork({ format: 'png' })}>Export PNG</button>
      </div>
      <div className={`compatibility compatibility--${webmcp.webmcpStatus}`}>
        <strong>{webmcp.webmcpAvailable ? 'Agent mode active' : 'Manual mode active'}</strong>
        <p>{webmcp.webmcpMessage ?? 'Checking this browser for document.modelContext…'}</p>
      </div>
      <AgentReceiptRail compact />
    </aside>
  )
}
