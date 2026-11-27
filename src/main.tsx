import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import App from './App'
import { SessionProvider } from './lib/session'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBar from './components/OfflineBar'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <SessionProvider>
        <OfflineBar />
        <App />
      </SessionProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
