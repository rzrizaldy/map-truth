import { ComparisonGrid } from './ComparisonGrid'
import { useAppStore } from '../state/store'

export function StageCompare({ onBack }: { onBack: () => void }) {
  const place = useAppStore((state) => state.place)
  const routes = useAppStore((state) => state.ai.routes)
  const running = Object.values(routes).some((route) => route.status === 'generating' || route.status === 'queued')

  return (
    <div className="stage stage--compare">
      <div className="compare-head">
        <div>
          <h2>Same brief. One of them saw the real place.</h2>
          <p className="stage-lead">{place.name}</p>
        </div>
        <button className="button" type="button" onClick={onBack}>← Change the brief</button>
      </div>
      <ComparisonGrid />
      {running ? <p className="stage-note">Two real image generations, about a minute each.</p> : null}
    </div>
  )
}
