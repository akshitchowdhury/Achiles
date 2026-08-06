import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { WelcomePage } from './pages/WelcomePage'
import { SelectPlanPage } from './pages/SelectPlanPage'
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

      {/* Outside AppShell deliberately: the picker previews themes on the whole
          screen, so it must not render inside the shell it is choosing. */}
      <Route path="/select-plan" element={<SelectPlanPage />} />

      {/* AppShell redirects to /welcome without a user id, and to /select-plan
          without a chosen plan. */}
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
