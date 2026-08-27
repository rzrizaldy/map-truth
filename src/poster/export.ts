/**
 * Download a generated result.
 *
 * There is no vector poster to serialise any more: the grounded route hands the
 * image model a real, attributed map screenshot, and what the user wants to keep
 * is that image.
 */
import { appStore } from '../state/store'
import type { ComparisonRoute } from '../types/maptruth'

const FILE: Record<ComparisonRoute, string> = {
  promptOnly: 'maptruth-prompt-only.png',
  screenshotGrounded: 'maptruth-grounded.png',
}

export const exportRouteImage = async (route: ComparisonRoute) => {
  const dataUrl = appStore.getState().ai.routes[route].imageDataUrl
  if (!dataUrl) throw new Error('nothing_generated_yet')

  const blob = await (await fetch(dataUrl)).blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = FILE[route]
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return { format: 'png' as const, fileName: FILE[route], bytes: blob.size, route }
}
