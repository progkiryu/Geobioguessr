import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { GamePage } from '@/pages/GamePage'

function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<GamePage mode="random" />} />
          <Route path="/daily" element={<GamePage mode="daily" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
