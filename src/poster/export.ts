import { Canvg } from 'canvg'

const getPosterSvg = (): SVGSVGElement => {
  const svg = document.querySelector<SVGSVGElement>('#maptruth-poster-svg')
  if (!svg) throw new Error('Poster is not ready for export')
  return svg
}

export const serializePosterSvg = (): string => {
  const source = getPosterSvg().cloneNode(true) as SVGSVGElement
  source.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  source.setAttribute('width', '1200')
  source.setAttribute('height', '1500')
  return new XMLSerializer().serializeToString(source)
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

const nativeRasterize = (svg: string, canvas: HTMLCanvasElement): Promise<void> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    image.onload = () => {
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Canvas is unavailable'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve()
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Native SVG rasterization failed'))
    }
    image.src = url
  })

export const exportArtwork = async (format: 'png' | 'svg', download = true) => {
  const svg = serializePosterSvg()
  if (format === 'svg') {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    if (download) downloadBlob(blob, 'maptruth-jakarta.svg')
    return { format, fileName: 'maptruth-jakarta.svg', bytes: blob.size }
  }

  const canvas = document.createElement('canvas')
  canvas.width = 2400
  canvas.height = 3000
  try {
    await nativeRasterize(svg, canvas)
  } catch {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    const canvg = Canvg.fromString(context, svg)
    await canvg.render()
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('PNG export failed'))), 'image/png'),
  )
  if (download) downloadBlob(blob, 'maptruth-jakarta.png')
  return { format, fileName: 'maptruth-jakarta.png', bytes: blob.size, width: 2400, height: 3000 }
}

