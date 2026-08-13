import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// IBM Plex, autohospedada. Solo los pesos que el sistema usa (400/500/600) y solo
// el subset latino: la app tiene que precachearse entera para abrir sin señal, y
// el cirílico son 60 KiB que nunca vamos a mostrar.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans-condensed/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'

import './styles/app.css'
import { App } from './App'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
