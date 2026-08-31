import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializeZoomSdk, preloadBackgroundImages } from './utils/zoomSdk'
import { initCardImages } from '@toastmaster-timer/shared'
import { initPostHog } from './utils/posthog'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'

// Render immediately — don't block on SDK init
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </React.StrictMode>,
)

// Initialize SDK and defer non-critical work in background. Custom card
// images load in parallel with the SDK handshake; pre-decode waits for both
// so it caches the cards that will actually be pushed.
const sdkReady = initializeZoomSdk().catch(() => {
  console.log('Continuing without Zoom SDK (local development mode)');
});
Promise.all([sdkReady, initCardImages()]).then(() => preloadBackgroundImages()).catch((error) => {
  console.warn('Failed to pre-load background images:', error);
});

try {
  initPostHog();
} catch (error) {
  console.warn('Failed to initialize PostHog:', error);
}
