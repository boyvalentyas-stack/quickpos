import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login     from './pages/Login'
import Signup    from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Products  from './pages/Products'
import POS       from './pages/POS'
import Orders    from './pages/Orders'
import Settings  from './pages/Settings'
import Staff     from './pages/Staff'

// ── Role-aware protected route ──────────────────────────────
// ownerOnly=true  → redirects cashiers to /dashboard
// ownerOnly=false → any logged-in user can access
function ProtectedRoute({ children, ownerOnly = false }) {
  const [session,  setSession]  = useState(undefined)
  const [role,     setRole]     = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session && ownerOnly) {
        const { data: prof } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.session.user.id)
          .single()
        setRole(prof?.role || 'cashier')
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined || checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (ownerOnly && role && role !== 'owner') return <Navigate to="/dashboard" replace />

  return children
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Any authenticated user */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/pos"       element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/orders"    element={<ProtectedRoute><Orders /></ProtectedRoute>} />

        {/* Owner only */}
        <Route path="/products"  element={<ProtectedRoute ownerOnly><Products /></ProtectedRoute>} />
        <Route path="/settings"  element={<ProtectedRoute ownerOnly><Settings /></ProtectedRoute>} />
        <Route path="/staff"     element={<ProtectedRoute ownerOnly><Staff /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}
