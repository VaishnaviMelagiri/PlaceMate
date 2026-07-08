import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Applications from './pages/Applications'
import Board from './pages/Board'
import Dashboard from './pages/Dashboard'
import Reminders from './pages/Reminders'
import Directory from './pages/Directory'
import { Splash } from './components/ui'

// Boot gate: hold the whole router behind the initial getSession() so a
// returning, already-logged-in user never sees a flash of the login screen.
function BootGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  if (loading) return <Splash />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BootGate>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="applications" element={<Applications />} />
            <Route path="board" element={<Board />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="directory" element={<Directory />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </BootGate>
    </AuthProvider>
  )
}
