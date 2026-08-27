import { useMemo, useState } from 'react'
import { generateComparisonManually } from '../ai/generation'
import { extractPlaceMentions, promptMatchesPlace } from '../map/places'
import { focusPlace } from '../webmcp/commands'
import { appStore, useAppStore } from '../state/store'

export function PromptStep() {
  const prompt = useAppStore((state) => state.ai.prompt)
  const place = useAppStore((state) => state.place)
  const locked = useAppStore((state) => Boolean(state.data.lock))
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const routes = useAppStore((state) => state.ai.routes)
  const [focusing, setFocusing] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ query: string; reason: string } | null>(null)

  const mentions = useMemo(() => extractPlaceMentions(prompt), [prompt])
  const anyRunning = Object.values(routes).some((route) => route.status === 'generating' || route.status === 'queued')
  const matches = promptMatchesPlace(mentions, place.label ?? place.name)

  const goTo = async (query: string) => {
    setFocusing(query)
    setProblem(null)
    const result = await focusPlace({ place: query })
    setFocusing(null)
    if (result.status === 'needs_user_action' && typeof result.reason === 'string' && result.reason !== 'map_not_ready') {
      setProblem({ query, reason: result.reason })
    }
  }

  return (
    <section className="step" id="step-1">
      <div className="step-head">
        <span className="step-num">1</span>
        <h2>Say what you want</h2>
        <p>Name a real place in your prompt and we’ll take the map there.</p>
      </div>

      <div className="prompt-block">
        <textarea
          id="ai-prompt"
          aria-label="What should the image look like?"
          value={prompt}
          maxLength={1200}
          placeholder="A vintage travel poster of Jakarta at sunset"
          onChange={(event) => appStore.setState((current) => ({ ai: { ...current.ai, prompt: event.target.value } }))}
        />

        {mentions.length ? (
          <div className="place-chips">
            <span className="place-chips-label">Places in your prompt:</span>
            {mentions.map((mention) => (
              <button
                key={mention.query}
                type="button"
                className="place-chip"
                disabled={!mapReady || focusing !== null}
                onClick={() => void goTo(mention.query)}
              >
                {focusing === mention.query ? `Going to ${mention.text}…` : `Go to ${mention.text}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="prompt-hint">Tip: mention a city and a button appears to jump the map straight there.</p>
        )}

        {problem ? (
          <p className="prompt-hint prompt-hint--warn">
            {problem.reason === 'place_not_found'
              ? `We couldn’t find “${problem.query}” on the map. Try a fuller name.`
              : 'Place search is unavailable right now — drag the map yourself and use the view below.'}
          </p>
        ) : null}

        {locked && !matches ? (
          <p className="prompt-hint prompt-hint--warn">
            Your prompt mentions {mentions.map((mention) => mention.text).join(' and ')}, but the map is somewhere else
            {place.source === 'live' ? '' : ` (${place.name})`}. The grounded image will follow the map, not the prompt — use a
            button above to move it.
          </p>
        ) : null}

        <div className="prompt-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => void generateComparisonManually()}
            disabled={!mapReady || anyRunning}
          >
            {anyRunning ? 'Making 3 images…' : 'Make 3 images'}
          </button>
          <small>{locked ? `Grounded on ${place.name}.` : 'Pick a place below first for the grounded version.'}</small>
        </div>
      </div>
    </section>
  )
}
