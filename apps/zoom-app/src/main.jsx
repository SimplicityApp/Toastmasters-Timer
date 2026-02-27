import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializeZoomSdk, preloadBackgroundImages } from './utils/zoomSdk'
import { initPostHog } from './utils/posthog'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'

// Initialize Zoom SDK before rendering the app
async function initApp() {
  try {
    await initializeZoomSdk();
  } catch (error) {
    // SDK initialization failed (expected in local development)
    console.log('Continuing without Zoom SDK (local development mode)');
  }

  // Render immediately after SDK init
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    </React.StrictMode>,
  )

  // Defer non-critical work
  try {
    await preloadBackgroundImages();
  } catch (error) {
    console.warn('Failed to pre-load background images:', error);
  }

  try {
    initPostHog();
  } catch (error) {
    console.warn('Failed to initialize PostHog:', error);
  }
}

// Start the app
initApp();
