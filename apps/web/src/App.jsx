import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'

const Landing = lazy(() => import('./pages/Landing'))
const TimerApp = lazy(() => import('./pages/TimerApp'))
const OAuthRedirect = lazy(() => import('./pages/OAuthRedirect'))

function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<TimerApp />} />
        <Route path="/oauth/redirect" element={<OAuthRedirect />} />
      </Routes>
    </Suspense>
  )
}

export default App
