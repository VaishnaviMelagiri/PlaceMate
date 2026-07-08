import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthProvider'
import { FullScreenLoader } from './ui'

/** Renders children only for signed-in users; otherwise redirects to /login. */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
