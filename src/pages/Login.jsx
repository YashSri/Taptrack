import { useState } from 'react'
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { get, ref as databaseRef } from 'firebase/database'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import { auth, db } from '../firebase.js'
import { normalizeEmail } from '../utils/adminOwnership.js'

const persistLastAdminEmail = (email) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem('taptrack:last-admin-email', normalizeEmail(email))
}

const readLastAdminEmail = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return normalizeEmail(
    window.localStorage.getItem('taptrack:last-admin-email') || '',
  )
}

const getAuthErrorMessage = (code) => {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-password': 'Enter your password to continue.',
    'auth/network-request-failed':
      'Network error. Check your connection and try again.',
    'auth/too-many-requests':
      'Too many attempts. Please wait a moment and try again.',
    'auth/user-disabled':
      'This account has been disabled. Contact support for help.',
    'auth/user-not-found': 'User not found.',
    'auth/wrong-password': 'Wrong password.',
  }

  return (
    messages[code] ||
    'Something went wrong while logging in. Please try again.'
  )
}

function Login() {
  const navigate = useNavigate()
  const savedAdminEmail = readLastAdminEmail()
  const [formData, setFormData] = useState({
    email: savedAdminEmail,
    password: '',
    selectedRole: savedAdminEmail ? 'admin' : 'employee',
  })
  const [feedback, setFeedback] = useState({
    type: '',
    message: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
    setFeedback({
      type: '',
      message: '',
    })
  }

  const handleRoleSelect = (selectedRole) => {
    setFormData((current) => ({
      ...current,
      selectedRole,
    }))
    setFeedback({
      type: '',
      message: '',
    })
  }

  const handlePasswordReset = async () => {
    const trimmedEmail = normalizeEmail(formData.email)

    if (!trimmedEmail) {
      setFeedback({
        type: 'error',
        message: 'Enter the admin email first, then request a password reset.',
      })
      return
    }

    setIsSendingReset(true)
    setFeedback({
      type: '',
      message: '',
    })

    try {
      await sendPasswordResetEmail(auth, trimmedEmail)
      setFeedback({
        type: 'success',
        message:
          'Password reset email sent. Open your inbox and set a new password.',
      })
    } catch (error) {
      console.error('Failed to send password reset email.', error)
      setFeedback({
        type: 'error',
        message:
          error?.code === 'auth/user-not-found'
            ? 'User not found.'
            : 'Unable to send a password reset email right now.',
      })
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback({
      type: '',
      message: '',
    })

    const trimmedEmail = normalizeEmail(formData.email)
    let credential = null

    try {
      credential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        formData.password,
      )

      const uid = credential.user.uid
      console.log('UID:', uid)

      const snapshot = await get(databaseRef(db, `users/${uid}`))

      if (!snapshot.exists()) {
        await signOut(auth)
        setFeedback({
          type: 'error',
          message: 'User data not found.',
        })
        return
      }

      const userData = snapshot.val()
      console.log('User Data:', userData)

      if (formData.selectedRole === 'admin' && !userData?.isAdmin) {
        await signOut(auth)
        setFeedback({
          type: 'error',
          message: 'You are not an admin.',
        })
        return
      }

      if (formData.selectedRole === 'employee' && userData?.isAdmin) {
        await signOut(auth)
        setFeedback({
          type: 'error',
          message: 'This account is registered as an admin. Switch to Admin to continue.',
        })
        return
      }

      if (userData?.isAdmin) {
        persistLastAdminEmail(userData.email || credential.user.email || trimmedEmail)
      }

      if (formData.selectedRole === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      console.error('Login failed.', error)

      if (credential?.user) {
        await signOut(auth).catch(() => {})
      }

      setFeedback({
        type: 'error',
        message:
          error?.code === 'PERMISSION_DENIED'
            ? 'Unable to read user data from Realtime Database.'
            : getAuthErrorMessage(error?.code),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const feedbackStyles =
    feedback.type === 'error'
      ? 'border-rose-200/20 bg-rose-500/10 text-rose-100'
      : 'border-emerald-200/20 bg-emerald-500/10 text-emerald-100'

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="px-2 text-white sm:px-4 lg:px-6">
          <p className="text-sm uppercase tracking-[0.45em] text-blue-100/70">
            Premium Attendance Flow
          </p>
          <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Sign in once, then let Firebase Auth and Realtime Database agree on
            your role.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-blue-50/78 sm:text-lg">
            TapTrack now validates every login by reading the signed-in user at
            <code className="mx-1 rounded bg-white/10 px-2 py-1 text-sm">
              users/{'{uid}'}
            </code>
            and routes admins straight to the control center.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-blue-50/78">
            <Link
              to="/signup?role=employee"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
            >
              Register as Employee
            </Link>
            <Link
              to="/signup?role=admin"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
            >
              Register as Admin
            </Link>
          </div>
        </section>

        <section className="glass mx-auto w-full max-w-md rounded-[32px] p-6 sm:p-8">
          <div className="mb-8">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-blue-50/80">
              TapTrack
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-7 text-blue-50/76">
              Choose the workspace you want to open, then sign in with your
              Firebase credentials.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <span className="block text-sm font-medium text-blue-50">
                Access Role
              </span>
              <div className="grid grid-cols-2 rounded-[24px] border border-white/12 bg-white/8 p-1.5">
                {[
                  { label: 'Employee', value: 'employee' },
                  { label: 'Admin', value: 'admin' },
                ].map((role) => {
                  const isSelected = formData.selectedRole === role.value

                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => handleRoleSelect(role.value)}
                      className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-slate-900 text-white shadow-[0_18px_50px_rgba(59,130,246,0.28)]'
                          : 'text-blue-50/72 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {role.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-blue-50">
                Email
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@company.com"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none ring-0 transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-blue-50">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  minLength={6}
                  required
                  className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 pr-20 text-white outline-none ring-0 transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-50/72 transition hover:bg-white/12 hover:text-white"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {formData.selectedRole === 'admin' ? (
              <div className="rounded-[22px] border border-white/10 bg-slate-950/16 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
                  Admin Recovery
                </p>
                <p className="mt-2 text-sm leading-6 text-blue-50/72">
                  Reset the admin password if the Auth account exists but the
                  current password is incorrect.
                </p>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isSendingReset}
                  className="mt-3 text-sm font-semibold text-blue-200 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingReset
                    ? 'Sending reset email...'
                    : 'Reset admin password'}
                </button>
              </div>
            ) : null}

            {feedback.message ? (
              <div
                className={`rounded-3xl border px-4 py-3 text-sm ${feedbackStyles}`}
              >
                {feedback.message}
              </div>
            ) : null}

            <Button type="submit" className="mt-2 w-full py-3.5" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Signing in...
                </span>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default Login
