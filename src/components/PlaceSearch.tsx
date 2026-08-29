import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../map/geocode'
import type { GeocodedPlace } from '../map/placeTypes'

type PlaceSearchProps = {
  chosen?: GeocodedPlace
  busy: boolean
  disabled: boolean
  onChoose: (place: GeocodedPlace) => void
  onClear: () => void
}

/**
 * Pick the place explicitly, the way a map app does.
 *
 * Inferring the destination from prose was the single biggest source of wrong
 * output: a brief that mentioned Bandung while the map still held Jakarta
 * produced Jakarta geography under a Bandung title. Choosing from real
 * OpenStreetMap results makes the ground truth a decision rather than a guess.
 */
export function PlaceSearch({ chosen, busy, disabled, onChoose, onClear }: PlaceSearchProps) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ forQuery: string; places: GeocodedPlace[] }>({ forQuery: '', places: [] })
  const [open, setOpen] = useState(false)
  const latest = useRef(0)

  // Derived rather than stored: results either match the box or they are stale.
  const searching = query.trim().length >= 2 && found.forQuery !== query.trim()
  const results = found.forQuery === query.trim() ? found.places : []

  useEffect(() => {
    if (!query.trim() || chosen) return
    const ticket = ++latest.current
    const timer = window.setTimeout(async () => {
      const places = await searchPlaces(query)
      if (latest.current !== ticket) return
      setFound({ forQuery: query.trim(), places })
      setOpen(true)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [query, chosen])

  if (chosen) {
    return (
      <div className="place-chosen">
        <span className="place-chosen-dot" aria-hidden="true" />
        <div>
          <strong>{chosen.name}</strong>
          <small>{chosen.label}</small>
        </div>
        <button type="button" onClick={() => { setQuery(''); setFound({ forQuery: '', places: [] }); onClear() }} disabled={busy}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="place-search">
      <input
        type="search"
        className="place-input"
        aria-label="Search for a place"
        placeholder="Search a city, building or landmark…"
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 ? (
        <ul className="place-results">
          {searching ? (
            <li className="place-note">Searching OpenStreetMap…</li>
          ) : results.length ? (
            results.map((place) => (
              <li key={place.label}>
                <button type="button" className="place-result" onClick={() => { setOpen(false); onChoose(place) }}>
                  <strong>{place.name}</strong>
                  <small>{place.label}</small>
                </button>
              </li>
            ))
          ) : (
            <li className="place-note">Nothing on the map matches that.</li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
