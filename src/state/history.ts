import { getMapRuntime } from '../map/runtime'
import { addActivity, appStore } from './store'
import type { MapTruthState } from '../types/maptruth'

type Snapshot = Pick<MapTruthState, 'data' | 'place' | 'map' | 'selection' | 'truthPins' | 'ai'> & {
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
    truthPins: state.truthPins,
    ai: state.ai,
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
    truthPins: snapshot.truthPins,
    ai: snapshot.ai,
    ui: { ...state.ui, canUndo: stack.length > 0 },
  }))
  const runtime = getMapRuntime()
  if (runtime) await runtime.navigate(snapshot.map.center, snapshot.map.zoom)
  addActivity('undo', 'ok', `Reverted ${snapshot.label}`, { source: 'manual' })
  return true
}
