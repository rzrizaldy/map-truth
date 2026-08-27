import { createRoot } from 'react-dom/client'
import * as maplibregl from 'maplibre-gl'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.tsx'

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')

createRoot(document.getElementById('root')!).render(<App />)
