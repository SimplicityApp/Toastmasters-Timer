import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import TimerApp from './pages/TimerApp'
import OAuthRedirect from './pages/OAuthRedirect'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<TimerApp />} />
      <Route path="/oauth/redirect" element={<OAuthRedirect />} />
    </Routes>
  )
}

export default App
