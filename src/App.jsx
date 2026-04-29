import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { onValue, ref as databaseRef } from 'firebase/database'
import { Navigate, Route, Routes } from 'react-router-dom'
import { auth, db } from './firebase.js'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EmployeeDetails from './pages/EmployeeDetails.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'

const BOOTSTRAP_PROFILE_KEY = 'taptrack:bootstrap-profile'

const readBootstrapProfile = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(BOOTSTRAP_PROFILE_KEY)
    return rawValue ? JSON.parse(rawValue) : null
  } catch {
    return null
  }
}

const normalizeEmail = (value = '') => value.trim().toLowerCase()

const matchesBootstrapProfile = (pendingProfile, user) => {
  if (!pendingProfile || !user) {
    return false
  }

  if (pendingProfile.uid && pendingProfile.uid === user.uid) {
    return true
  }

  const pendingEmail = normalizeEmail(
    pendingProfile.profile?.email || pendingProfile.profile?.adminEmail || '',
  )

  return pendingEmail !== '' && pendingEmail === normalizeEmail(user.email || '')
}

const clearBootstrapProfile = (user) => {
  if (typeof window === 'undefined' || !user) {
    return
  }

  const pendingProfile = readBootstrapProfile()
  if (!matchesBootstrapProfile(pendingProfile, user)) {
    return
  }

  window.localStorage.removeItem(BOOTSTRAP_PROFILE_KEY)
}

const toPendingBootstrapProfile = (pendingProfile, user) => ({
  ...pendingProfile.profile,
  adminId: pendingProfile.profile?.adminId || user.uid,
  adminEmail:
    pendingProfile.profile?.adminEmail || pendingProfile.profile?.email || user.email || '',
  email: pendingProfile.profile?.email || user.email || '',
  isAdmin: true,
  __pendingBootstrap: true,
})

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass flex flex-col items-center gap-4 rounded-[28px] px-8 py-8 text-center text-white">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-blue-100/70">
            Checking Session
          </p>
          <p className="mt-2 text-sm text-blue-50/78">
            Restoring your TapTrack workspace...
          </p>
        </div>
      </div>
    </div>
  )
}

const getRouteForProfile = (profile) =>
  profile?.isAdmin ? '/admin' : '/dashboard'

function PrivateRoute({
  user,
  profile,
  isLoading,
  allowedRole,
  children,
}) {
  if (isLoading) {
    return <AuthLoader />
  }

  if (!user || !profile) {
    return <Navigate to="/" replace />
  }

  if (allowedRole === 'admin' && !profile.isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  if (allowedRole === 'employee' && profile.isAdmin) {
    return <Navigate to="/admin" replace />
  }

  return children
}

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const root = document.documentElement
    root.style.setProperty('--pointer-x', '50%')
    root.style.setProperty('--pointer-y', '50%')

    let frameId = null

    const updatePointerPosition = (event) => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      frameId = window.requestAnimationFrame(() => {
        const x = `${(event.clientX / window.innerWidth) * 100}%`
        const y = `${(event.clientY / window.innerHeight) * 100}%`
        root.style.setProperty('--pointer-x', x)
        root.style.setProperty('--pointer-y', y)
      })
    }

    window.addEventListener('pointermove', updatePointerPosition, {
      passive: true,
    })

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      window.removeEventListener('pointermove', updatePointerPosition)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthLoading(false)

      if (!nextUser) {
        setProfile(null)
        setProfileLoading(false)
      } else {
        const pendingProfile = readBootstrapProfile()

        if (matchesBootstrapProfile(pendingProfile, nextUser)) {
          setProfile(toPendingBootstrapProfile(pendingProfile, nextUser))
          setProfileLoading(false)
        } else {
          setProfileLoading(true)
        }
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    let isActive = true
    const userRef = databaseRef(db, `users/${user.uid}`)
    const unsubscribe = onValue(
      userRef,
      (snapshot) => {
        if (!isActive) {
          return
        }

        if (!snapshot.exists()) {
          const pendingProfile = readBootstrapProfile()
          if (matchesBootstrapProfile(pendingProfile, user)) {
            setProfile(toPendingBootstrapProfile(pendingProfile, user))
            setProfileLoading(false)
            return
          }

          setProfile(null)
          setProfileLoading(false)
          signOut(auth).catch(() => {})
          return
        }

        setProfile(snapshot.val())
        setProfileLoading(false)
        clearBootstrapProfile(user)
      },
      () => {
        if (!isActive) {
          return
        }

        const pendingProfile = readBootstrapProfile()
        if (matchesBootstrapProfile(pendingProfile, user)) {
          setProfile(toPendingBootstrapProfile(pendingProfile, user))
          setProfileLoading(false)
          return
        }

        setProfile(null)
        setProfileLoading(false)
      },
    )

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [user])

  const isLoading = authLoading || (Boolean(user) && profileLoading)
  const homeRoute = getRouteForProfile(profile)

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-12 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl md:h-96 md:w-96" />
        <div className="absolute right-[-8rem] top-1/4 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl md:h-[28rem] md:w-[28rem]" />
        <div className="absolute bottom-[-8rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-200/10 blur-3xl md:h-[26rem] md:w-[26rem]" />
      </div>

      <div className="relative z-10">
        <Routes>
          <Route
            path="/"
            element={
              isLoading ? (
                <AuthLoader />
              ) : user && profile && !profile.__pendingBootstrap ? (
                <Navigate to={homeRoute} replace />
              ) : user && profile?.__pendingBootstrap ? (
                <Navigate to="/admin" replace />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/signup"
            element={
              isLoading ? (
                <AuthLoader />
              ) : user && profile && !profile.__pendingBootstrap ? (
                <Navigate to={homeRoute} replace />
              ) : user && profile?.__pendingBootstrap ? (
                <Navigate to="/admin" replace />
              ) : (
                <Signup />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute
                user={user}
                profile={profile}
                isLoading={isLoading}
                allowedRole="employee"
              >
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute
                user={user}
                profile={profile}
                isLoading={isLoading}
                allowedRole="admin"
              >
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/employee/:id"
            element={
              <PrivateRoute
                user={user}
                profile={profile}
                isLoading={isLoading}
                allowedRole="admin"
              >
                <EmployeeDetails />
              </PrivateRoute>
            }
          />
          <Route
            path="*"
            element={<Navigate to={user && profile ? homeRoute : '/'} replace />}
          />
        </Routes>
      </div>
    </div>
  )
}

export default App
