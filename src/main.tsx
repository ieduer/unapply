import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { mountUnapplyIdentity } from './lib/bdfzIdentity'
import { applyThemeState, loadThemeState } from './lib/theme'

mountUnapplyIdentity()
applyThemeState(loadThemeState())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
