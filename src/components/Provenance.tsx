import { useAppStore } from '../state/store'
import type { ComparisonRoute } from '../types/maptruth'

const format = ([longitude, latitude]: [number, number]) =>
  `${Math.abs(latitude).toFixed(5)}°${latitude >= 0 ? 'N' : 'S'} ${Math.abs(longitude).toFixed(5)}°${longitude >= 0 ? 'E' : 'W'}`

/**
 * Where this image's geography came from — stated, not implied.
 *
 * A claim nobody can check is just a claim, so the exact coordinates the model
 * was given link straight out to openstreetmap.org. Anyone can confirm the
 * grounded image in about two seconds, which is the only version of "trust me"
 * worth shipping.
 */
export function Provenance({ route }: { route: ComparisonRoute }) {
  const place = useAppStore((state) => state.place)
  const lock = useAppStore((state) => state.data.lock)
  const featureCount = useAppStore((state) => state.data.features.length)
  const pins = useAppStore((state) => state.truthPins)

  if (route === 'promptOnly') {
    return (
      <div className="provenance provenance--none">
        <span className="provenance-dot" aria-hidden="true" />
        <span>No source. Every street, label and marker here was invented by the model.</span>
      </div>
    )
  }

  if (!lock) {
    return (
      <div className="provenance provenance--none">
        <span className="provenance-dot" aria-hidden="true" />
        <span>Pick a place and this becomes checkable.</span>
      </div>
    )
  }

  const centre: [number, number] = pins[0]?.center ?? place.center ?? [
    (lock.bbox[0] + lock.bbox[2]) / 2,
    (lock.bbox[1] + lock.bbox[3]) / 2,
  ]
  const osmUrl = `https://www.openstreetmap.org/#map=16/${centre[1].toFixed(5)}/${centre[0].toFixed(5)}`

  return (
    <div className="provenance">
      <span className="provenance-dot provenance-dot--ok" aria-hidden="true" />
      <div className="provenance-facts">
        <strong>{pins[0]?.name ?? place.name}</strong>
        <code>{format(centre)}</code>
        <span>{featureCount.toLocaleString()} OpenStreetMap shapes verified</span>
      </div>
      <a className="provenance-check" href={osmUrl} target="_blank" rel="noreferrer">
        Check on OpenStreetMap ↗
      </a>
    </div>
  )
}
