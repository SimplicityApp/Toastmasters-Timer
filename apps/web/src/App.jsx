import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import TimerApp from './pages/TimerApp'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<TimerApp />} />
    </Routes>
  )
}

export default App
