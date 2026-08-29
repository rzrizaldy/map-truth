import type { ToolResult } from '../types/maptruth'

export type MapRuntime = {
  capture: () => string | Promise<string>
  lockLiveOsm: (source?: 'manual' | 'webmcp') => Promise<ToolResult>
  navigate: (center: [number, number], zoom: number) => Promise<void>
}

let activeRuntime: MapRuntime | null = null

export const registerMapRuntime = (runtime: MapRuntime) => {
  activeRuntime = runtime
  return () => {
    if (activeRuntime === runtime) activeRuntime = null
  }
}

export const getMapRuntime = () => activeRuntime
