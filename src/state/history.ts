import { getMapRuntime } from '../map/runtime'
import { addActivity, appStore } from './store'
import type { MapTruthState } from '../types/maptruth'

type Snapshot = Pick<MapTruthState, 'data' | 'place' | 'map' | 'selection' | 'poster' | 'ai'> & {
  ui: Pick<MapTruthState['ui'], 'comparisonMode' | 'seam'>
  label: string
}

const stack: Snapshot[] = []

export const captureUndo = (label: string) => {
  const state = appStore.getState()
  stack.push(structuredClone({
    label,
    data: state.data,
    place: state.place,
    map: state.map,
    selection: state.selection,
    poster: state.poster,
    ai: state.ai,
    ui: { comparisonMode: state.ui.comparisonMode, seam: state.ui.seam },
  }))
  if (stack.length > 12) stack.shift()
  appStore.setState((current) => ({ ui: { ...current.ui, canUndo: true } }))
}

export const clearUndoHistory = () => {
  stack.length = 0
  appStore.setState((state) => ({ ui: { ...state.ui, canUndo: false } }))
}

export const undoLastChange = async () => {
  const snapshot = stack.pop()
  if (!snapshot) return false
  appStore.setState((state) => ({
    data: snapshot.data,
    place: snapshot.place,
    map: snapshot.map,
    selection: snapshot.selection,
    poster: snapshot.poster,
    ai: snapshot.ai,
    ui: { ...state.ui, ...snapshot.ui, canUndo: stack.length > 0 },
  }))
  const runtime = getMapRuntime()
  if (runtime) await runtime.navigate(snapshot.map.center, snapshot.map.zoom)
  addActivity('undo', 'ok', `Reverted ${snapshot.label}`, { source: 'manual' })
  return true
}
