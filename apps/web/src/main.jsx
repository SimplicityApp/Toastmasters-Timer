import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Temporary: basename so landing is at /landing until Zoom prod approved. See docs/TEMPORARY_ROUTING.md */}
    <BrowserRouter basename="/landing">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
