import { useEffect, useRef, useState } from 'react'
import { MapStudio } from '../map/MapStudio'
import { EXAMPLES } from '../map/examples'
import { EMPTY_INTENT, readIntent, type Intent } from '../map/intent'
import { syncOverlays } from '../map/overlays'
import { syncTruthPins } from '../map/pinSync'
import { generateComparisonManually } from '../ai/generation'
import { focusPlace } from '../webmcp/commands'
import { appStore, useAppStore } from '../state/store'

export function StageAsk({ onGenerate }: { onGenerate: () => void }) {
  const prompt = useAppStore((state) => state.ai.prompt)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const place = useAppStore((state) => state.place)
  const data = useAppStore((state) => state.data)
  const overlays = useAppStore((state) => state.overlays)
  const overlayCategories = useAppStore((state) => state.overlayCategories)
  const overlayStatus = useAppStore((state) => state.overlayStatus)

  const [intent, setIntent] = useState<Intent>(EMPTY_INTENT)
  const [moving, setMoving] = useState(false)
  // Only fly when the destination actually changes, not on every keystroke.
  const arrivedAt = useRef<string>('')

  // Staleness is derived, not stored: the reading either belongs to what is in
  // the box or it does not.
  const reading = Boolean(prompt.trim()) && intent.forPrompt !== prompt

  useEffect(() => {
    if (!prompt.trim()) return
    const timer = window.setTimeout(() => { void readIntent(prompt).then(setIntent) }, 650)
    return () => window.clearTimeout(timer)
  }, [prompt])

  // The map is the read-back: it goes where the brief says, as you write it.
  useEffect(() => {
    if (!mapReady || reading || intent.status !== 'ready' || !intent.place) return
    const destination = intent.place.label
    if (arrivedAt.current === destination) return
    arrivedAt.current = destination
    setMoving(true)
    // Re-use the query that resolved, not the raw word, so the fly matches the read-back.
    void focusPlace({ place: intent.query ?? intent.place.name }).then(() => setMoving(false))
  }, [mapReady, reading, intent])

  // Re-mark whenever the brief or the locked view changes.
  const lockId = data.lock?.id
  const planned = intent.status === 'ready' ? intent.categories : undefined
  useEffect(() => {
    if (!lockId || !planned) return
    const timer = window.setTimeout(() => {
      void syncTruthPins()
      void syncOverlays(planned)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [lockId, prompt, planned])

  const marking = overlayStatus === 'planning' || overlayStatus === 'finding'
  const ready = Boolean(data.lock) && !moving && !marking && !reading

  return (
    <div className="stage stage--ask">
      <div className="ask-panel">
        <h1>What map do you need?</h1>
        <p className="stage-lead">
          Name a real place. An AI reads the brief; OpenStreetMap decides where everything actually is.
        </p>

        <textarea
          className="ask-input"
          aria-label="Describe the map you need"
          value={prompt}
          maxLength={1200}
          rows={3}
          placeholder="Peta demo DPR Jakarta. Tandai titik kumpul dan pos medis."
          onChange={(event) => appStore.setState((state) => ({ ai: { ...state.ai, prompt: event.target.value } }))}
        />

        <div className="examples">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className={`example ${prompt === example.prompt ? 'example--on' : ''}`}
              onClick={() => appStore.setState((state) => ({ ai: { ...state.ai, prompt: example.prompt } }))}
            >
              <strong>{example.label}</strong>
              <span>{example.note}</span>
            </button>
          ))}
        </div>

        <div className="readback" aria-live="polite">
          {reading ? (
            <span className="readback-line readback-muted">Reading the brief…</span>
          ) : intent.status === 'ready' && intent.place ? (
            <>
              <span className="readback-line">
                <b>Place</b>
                <em>{data.lock ? place.name : intent.place.name}</em>
              </span>
              <span className="readback-line">
                <b>Marking</b>
                {overlayStatus === 'error' ? (
                  <em className="readback-line--warn">
                    OpenStreetMap didn’t answer — the map is still real, just unmarked.
                  </em>
                ) : null}
                {overlayStatus === 'error' ? null : overlayCategories.length ? overlayCategories.map((category) => {
                  const count = overlays.filter((marker) => marker.category === category.key).length
                  return (
                    <i key={category.key} className="readback-chip" style={{ borderColor: category.colour, color: category.colour }}>
                      {category.label}{overlayStatus === 'ready' ? ` · ${count}` : ''}
                    </i>
                  )
                }) : intent.categories.length ? intent.categories.map((category) => (
                  <i key={category.key} className="readback-chip" style={{ borderColor: category.colour, color: category.colour }}>
                    {category.label}
                  </i>
                )) : <em className="readback-muted">just the place itself</em>}
              </span>
              {data.lock ? (
                <span className="readback-line readback-muted">
                  {data.features.length.toLocaleString()} OpenStreetMap shapes in view
                </span>
              ) : null}
            </>
          ) : prompt.trim() ? (
            <span className="readback-line readback-line--warn">
              {intent.term
                ? `We couldn’t find “${intent.term}” on the map. Try a fuller name.`
                : 'No place named yet. Add a city, building or landmark.'}
            </span>
          ) : (
            <span className="readback-line readback-muted">Type a brief, or pick an example.</span>
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
