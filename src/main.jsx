import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializeZoomSdk, preloadBackgroundImages } from './utils/zoomSdk'

// Initialize Zoom SDK before rendering the app
async function initApp() {
  try {
    await initializeZoomSdk();
  } catch (error) {
    // SDK initialization failed (expected in local development)
    console.log('Continuing without Zoom SDK (local development mode)');
  }

  // Pre-load background images (works better in Zoom client than fetching on-demand)
  try {
    await preloadBackgroundImages();
  } catch (error) {
    console.warn('Failed to pre-load background images:', error);
  }

  // Render app regardless of SDK initialization status
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Start the app
initApp();
