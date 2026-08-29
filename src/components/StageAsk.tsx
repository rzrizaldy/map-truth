import { useEffect, useMemo, useState } from 'react'
import { MapStudio } from '../map/MapStudio'
import { PlaceSearch } from './PlaceSearch'
import { EXAMPLES } from '../map/examples'
import { geocodePlace } from '../map/geocode'
import { planOverlayCategories, syncOverlays, type PlannedCategory } from '../map/overlays'
import { syncTruthPins } from '../map/pinSync'
import { generateComparisonManually } from '../ai/generation'
import { focusResolvedPlace } from '../webmcp/commands'
import type { GeocodedPlace } from '../map/placeTypes'
import { appStore, useAppStore } from '../state/store'

export function StageAsk({ onGenerate }: { onGenerate: () => void }) {
  const prompt = useAppStore((state) => state.ai.prompt)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const place = useAppStore((state) => state.place)
  const data = useAppStore((state) => state.data)
  const overlays = useAppStore((state) => state.overlays)
  const overlayCategories = useAppStore((state) => state.overlayCategories)
  const overlayStatus = useAppStore((state) => state.overlayStatus)

  const [chosen, setChosen] = useState<GeocodedPlace | undefined>()
  const [moving, setMoving] = useState(false)
  const [focusFailed, setFocusFailed] = useState<string | undefined>()
  const [plan, setPlan] = useState<{ forPrompt: string; categories: PlannedCategory[] }>({ forPrompt: '', categories: [] })

  // The lock must belong to the place that was chosen. Without this a stale
  // lock from a previous place will happily ground the next brief — which is
  // how a Bandung brief came back drawn on Jakarta.
  const lockedHere = Boolean(data.lock) && place.source === 'geocoded' && place.label === chosen?.label

  const choose = async (next: GeocodedPlace) => {
    setChosen(next)
    setFocusFailed(undefined)
    setMoving(true)
    // The record is already resolved; looking its own label up again fails.
    const outcome = await focusResolvedPlace(next)
    // A failed lock used to leave the panel reading "Reading the map…" for
    // ever, with nothing to act on.
    setFocusFailed(outcome.status === 'ok' ? undefined : String(outcome.reason ?? 'lock_failed'))
    setMoving(false)
  }

  const clear = () => {
    setChosen(undefined)
    appStore.setState((state) => ({
      data: { status: 'idle', features: [], verificationStatus: 'idle' },
      place: { name: 'Nowhere yet', source: 'none' },
      selection: undefined,
      truthPins: [],
      overlays: [],
      overlayCategories: [],
      overlayStatus: 'idle',
      ui: { ...state.ui },
    }))
  }

  const applyExample = async (example: typeof EXAMPLES[number]) => {
    appStore.setState((state) => ({ ai: { ...state.ai, prompt: example.prompt } }))
    const found = await geocodePlace(example.place)
    if (found.ok) void choose(found.place)
  }

  // Whether the plan is stale is derivable from which brief it was made for.
  const planning = Boolean(prompt.trim()) && plan.forPrompt !== prompt
  // Stable identity so the marking effect does not re-fire every render.
  const planned = useMemo(
    () => (plan.forPrompt === prompt ? plan.categories : []),
    [plan, prompt],
  )

  // Read what the brief asks the map to show, independent of where it is.
  useEffect(() => {
    if (!prompt.trim()) return
    const timer = window.setTimeout(async () => {
      const categories = await planOverlayCategories(prompt)
      setPlan({ forPrompt: prompt, categories })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [prompt])

  // Mark once we have both a place and a plan for it.
  const lockId = data.lock?.id
  useEffect(() => {
    if (!lockId || !lockedHere) return
    const timer = window.setTimeout(() => {
      void syncTruthPins()
      void syncOverlays(planned)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [lockId, lockedHere, planned])

  const marking = overlayStatus === 'planning' || overlayStatus === 'finding'
  const ready = lockedHere && !moving && !marking && !planning && Boolean(prompt.trim())

  return (
    <div className="stage stage--ask">
      <div className="ask-panel">
        <div className="ask-intro">
          <h1>Make a map that is actually there</h1>
          <p className="stage-lead">
            Pick a real place, say what the map needs, and see it beside what an AI invents without one.
          </p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="place-search">1 · Which place?</label>
          <PlaceSearch
            chosen={chosen}
            busy={moving}
            disabled={!mapReady}
            onChoose={(next) => void choose(next)}
            onClear={clear}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ask-input">2 · What map do you need?</label>
          <textarea
            id="ask-input"
            className="ask-input"
            value={prompt}
            maxLength={1200}
            rows={3}
            placeholder="Peta demo. Tandai titik kumpul dan pos medis."
            onChange={(event) => appStore.setState((state) => ({ ai: { ...state.ai, prompt: event.target.value } }))}
          />
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button key={example.label} type="button" className="example" onClick={() => void applyExample(example)} disabled={!mapReady}>
                <strong>{example.label}</strong>
                <span>{example.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="readback" aria-live="polite">
          {!chosen ? (
            <span className="readback-line readback-muted">Pick a place and the map will lock onto it.</span>
          ) : moving ? (
            <span className="readback-line readback-muted">Going to {chosen.name}…</span>
          ) : focusFailed ? (
            <span className="readback-line readback-line--warn">
              {focusFailed === 'bbox_too_large'
                ? 'That area is too wide to read. Pick somewhere more specific.'
                : focusFailed === 'no_supported_features'
                  ? 'No OpenStreetMap detail here yet. Try a nearby town or city.'
                  : 'Could not read the map there.'}
              <button type="button" className="retry" onClick={() => void choose(chosen)}>Try again</button>
            </span>
          ) : !lockedHere ? (
            <span className="readback-line readback-muted">Reading the map…</span>
          ) : (
            <>
              <span className="readback-line">
                <b>Grounded</b>
                <em>{place.name}</em>
              </span>
              <span className="readback-line">
                <b>Marking</b>
                {overlayStatus === 'error' ? (
                  <em className="readback-line--warn">OpenStreetMap didn’t answer — the map is real, just unmarked.</em>
                ) : marking || planning ? (
                  <em className="readback-muted">working it out…</em>
                ) : overlayCategories.length ? overlayCategories.map((category) => (
                  <i key={category.key} className="readback-chip" style={{ borderColor: category.colour, color: category.colour }}>
                    {category.label} · {overlays.filter((marker) => marker.category === category.key).length}
                  </i>
                )) : <em className="readback-muted">just the place itself</em>}
              </span>
              <span className="readback-line readback-muted">{data.features.length.toLocaleString()} OpenStreetMap shapes in view</span>
            </>
          )}
        </div>

        <button
          className="button button--primary button--go"
          type="button"
          disabled={!ready}
          onClick={() => { void generateComparisonManually(); onGenerate() }}
        >
          {moving ? 'Going there…' : marking ? 'Marking the map…' : 'Make both maps →'}
        </button>
        {data.error ? <div className="ai-error">{data.error}</div> : null}
      </div>

      <div className="ask-map"><MapStudio /></div>
    </div>
  )
}
