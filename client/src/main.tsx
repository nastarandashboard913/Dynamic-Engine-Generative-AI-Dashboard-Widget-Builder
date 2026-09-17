import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { startPerfMonitoring } from '@/lib/perf'
import '@/index.css'

// Before render, so `buffered: true` captures shifts from the very first paint.
startPerfMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
