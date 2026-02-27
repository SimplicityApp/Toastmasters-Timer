import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import App from './App.jsx'
import './index.css'
import { initPostHog } from './utils/posthog.js'

// Render first with uninitialized posthog (all trackEvent calls already check __loaded)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </React.StrictMode>,
)

// Init PostHog when browser is idle
const deferInit = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
deferInit(() => { initPostHog() })
