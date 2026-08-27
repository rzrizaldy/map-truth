import { useAppStore, appStore } from '../state/store'
import { PosterSvg } from './PosterSvg'

export function TruthSeam() {
  const seam = useAppStore((state) => state.ui.seam)
  const mode = useAppStore((state) => state.ui.comparisonMode)
  const artLayer = useAppStore((state) => state.ai.routes.mapTruthGrounded.imageDataUrl)
  const setSeam = (value: number) => appStore.setState((state) => ({ ui: { ...state.ui, seam: value } }))

  return (
    <div className="truth-seam" data-mode={mode}>
      <div className="truth-layer truth-layer--source"><PosterSvg sourceMode /></div>
      <div className="truth-layer truth-layer--poster" style={{ clipPath: `inset(0 ${100 - seam}% 0 0)` }}>
        <PosterSvg id="maptruth-poster-svg" backgroundImage={artLayer} />
      </div>
      <div className="truth-ruler" style={{ left: `${seam}%` }} aria-hidden="true">
        <span>TRUTH</span>
      </div>
      <input
        className="truth-range"
        type="range"
        min="0"
        max="100"
        value={seam}
        onChange={(event) => setSeam(Number(event.target.value))}
        aria-label="Reveal source geometry beneath poster"
      />
    </div>
  )
}
