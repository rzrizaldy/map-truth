import { useAppStore } from '../state/store'

/** What an agent can actually call, in the order it would call it. */
const TOOLS: Array<{ name: string; does: string }> = [
  { name: 'focus_place', does: 'go to a place by name and lock it' },
  { name: 'lock_live_osm', does: 'freeze the visible OSM geometry, hashed' },
  { name: 'mark_from_osm', does: 'decide what the brief needs, mark the real ones' },
  { name: 'inspect_map_context', does: 'read back what is on the map' },
  { name: 'verify_geography', does: 're-hash every shape against its source' },
  { name: 'verify_osm_lock', does: 'upgrade to canonical OSM ids via Overpass' },
  { name: 'navigate_map', does: 'move the camera to coordinates' },
  { name: 'generate_comparison', does: 'stage the images, stop for approval' },
  { name: 'inspect_comparison', does: 'read per-image progress' },
  { name: 'export_artwork', does: 'download a result' },
]

export function AgentPanel() {
  const available = useAppStore((state) => state.ui.webmcpAvailable)

  return (
    <div className="agent-panel">
      <p className={`agent-state agent-state--${available ? 'on' : 'off'}`}>
        {available
          ? 'This browser speaks WebMCP. An assistant can call these directly — no clicking, no screen-scraping.'
          : 'No WebMCP in this browser. The walkthrough below runs the very same functions so you can watch them.'}
      </p>
      <ol className="tool-list">
        {TOOLS.map((tool) => (
          <li key={tool.name}>
            <code>{tool.name}</code>
            <span>{tool.does}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
