import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { WelcomePage } from './pages/WelcomePage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { DashboardPage } from './pages/DashboardPage'
import { NutritionPage } from './pages/NutritionPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { CoachPage } from './pages/CoachPage'

function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />

      {/* Landing spot for the Go OAuth callback — see AuthCallbackPage. */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* AppShell redirects to /welcome when there's no stored user id. */}
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/coach" element={<CoachPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
