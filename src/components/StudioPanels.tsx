import { appStore, useAppStore } from '../state/store'
import { exportGroundedArtwork, renderGroundedPoster, verifyGeography } from '../webmcp/commands'

export function StatusRail() {
  const ui = useAppStore((state) => state.ui)
  const selection = useAppStore((state) => state.selection)
  const poster = useAppStore((state) => state.poster)
  const place = useAppStore((state) => state.place)
  return (
    <div className="status-rail" aria-label="Geography status">
      <div><span className="status-dot" /> GEOGRAPHY LOCKED</div>
      <strong>{poster.renderedFeatureIds.length.toLocaleString() || '—'} source paths</strong>
      <span>{selection ? `${place.name} · ${selection.geometryHash.slice(0, 13)}` : 'waiting for boundary'}</span>
      <span className={`webmcp-pill webmcp-pill--${ui.webmcpStatus}`}>WebMCP {ui.webmcpStatus}</span>
    </div>
  )
}

export function ManualControls() {
  const spec = useAppStore((state) => state.poster.spec)
  const activity = useAppStore((state) => state.activity)
  const webmcp = useAppStore((state) => state.ui)
  const update = (patch: Partial<typeof spec>) => appStore.setState((state) => ({
    poster: { ...state.poster, spec: { ...state.poster.spec, ...patch } },
  }))

  return (
    <aside className="controls-panel">
      <div className="panel-heading"><span>MANUAL FALLBACK</span><strong>Art direction</strong></div>
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
      <label className="legend-toggle">
        <input type="checkbox" checked={spec.showLegend} onChange={(event) => update({ showLegend: event.target.checked })} />
        Show legend
      </label>
      <div className="button-row">
        <button className="button button--primary" type="button" onClick={() => renderGroundedPoster(appStore.getState().poster.spec)}>Render grounded</button>
        <button className="button" type="button" onClick={() => verifyGeography()}>Verify</button>
      </div>
      <div className="button-row">
        <button className="button button--small" type="button" onClick={() => exportGroundedArtwork({ format: 'svg' })}>Export SVG</button>
        <button className="button button--small" type="button" onClick={() => exportGroundedArtwork({ format: 'png' })}>Export PNG</button>
      </div>
      <div className={`compatibility compatibility--${webmcp.webmcpStatus}`}>
        <strong>{webmcp.webmcpAvailable ? '6 tools registered' : 'Manual studio active'}</strong>
        <p>{webmcp.webmcpMessage ?? 'Checking this browser for document.modelContext…'}</p>
      </div>
      <div className="activity-log">
        <span>ACTIVITY</span>
        {activity.length ? activity.map((entry) => (
          <div key={entry.id}><time>{entry.time}</time><p><b>{entry.tool}</b> · {entry.summary}</p></div>
        )) : <p>No tool calls yet.</p>}
      </div>
    </aside>
  )
}
