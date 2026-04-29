import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { ref as databaseRef, set } from 'firebase/database'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/Button.jsx'
import { auth, db } from '../firebase.js'
import { normalizeEmail } from '../utils/adminOwnership.js'

const persistLastAdminEmail = (email) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem('taptrack:last-admin-email', normalizeEmail(email))
}

const getSignupErrorMessage = (code) => {
  const messages = {
    'auth/email-already-in-use':
      'That email is already in use. Try logging in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed':
      'Network error. Check your connection and try again.',
    'auth/too-many-requests':
      'Too many attempts. Please wait a moment and try again.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
  }

  return (
    messages[code] ||
    'Something went wrong while creating the account. Please try again.'
  )
}

function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedRole =
    searchParams.get('role') === 'admin' ? 'admin' : 'employee'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    selectedRole: requestedRole,
  })
  const [feedback, setFeedback] = useState({
    type: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleEmployeeSignup = async ({ name, email, password }) => {
    const userCred = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCred.user.uid
    console.log('UID:', uid)

    const employeeProfile = {
      uid,
      name,
      email,
      isAdmin: false,
      role: 'employee',
      adminId: null,
      adminEmail: '',
      employeeId: uid.slice(0, 8).toUpperCase(),
      shift: 'Not assigned',
      createdAt: Date.now(),
    }

    await set(databaseRef(db, `users/${uid}`), employeeProfile)
    console.log('User Data:', employeeProfile)

    return {
      user: userCred.user,
      profile: employeeProfile,
    }
  }

  const handleAdminSignup = async (event) => {
    event.preventDefault()
    setFeedback({
      type: '',
      message: '',
    })

    const name = formData.name.trim()
    const email = normalizeEmail(formData.email)
    const password = formData.password.trim()
    const confirmPassword = formData.confirmPassword.trim()

    if (!name) {
      setFeedback({
        type: 'error',
        message:
          formData.selectedRole === 'admin'
            ? 'Enter the admin name to continue.'
            : 'Enter your name to continue.',
      })
      return
    }

    if (password.length < 6) {
      setFeedback({
        type: 'error',
        message: 'Use at least 6 characters for the password.',
      })
      return
    }

    if (password !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: 'Password and confirm password do not match.',
      })
      return
    }

    setIsSubmitting(true)

    let createdUser = null
    let databaseSaved = false

    try {
      const signupResult =
        formData.selectedRole === 'admin'
          ? await (async () => {
              const userCred = await createUserWithEmailAndPassword(
                auth,
                email,
                password,
              )
              const uid = userCred.user.uid
              console.log('UID:', uid)

              const adminProfile = {
                uid,
                name,
                email,
                isAdmin: true,
                role: 'admin',
                adminId: uid,
                adminEmail: email,
                employeeId: 'ADMIN-001',
                shift: 'Flexible',
                createdAt: Date.now(),
              }

              await set(databaseRef(db, `users/${uid}`), adminProfile)
              console.log('User Data:', adminProfile)

              return {
                user: userCred.user,
                profile: adminProfile,
              }
            })()
          : await handleEmployeeSignup({
              name,
              email,
              password,
            })

      createdUser = signupResult.user
      databaseSaved = true

      await updateProfile(createdUser, {
        displayName: name,
      }).catch((error) => {
        console.error('Failed to update display name.', error)
      })

      if (signupResult.profile.isAdmin) {
        persistLastAdminEmail(email)
      }

      setFeedback({
        type: 'success',
        message: signupResult.profile.isAdmin
          ? 'Admin registered successfully.'
          : 'Employee account created successfully.',
      })

      navigate(signupResult.profile.isAdmin ? '/admin' : '/dashboard', {
        replace: true,
      })
    } catch (error) {
      console.error('Signup failed.', error)

      if (createdUser && !databaseSaved) {
        await deleteUser(createdUser).catch(() => {})
        await signOut(auth).catch(() => {})
      }

      setFeedback({
        type: 'error',
        message:
          error?.code === 'PERMISSION_DENIED'
            ? `${formData.selectedRole === 'admin' ? 'Admin' : 'Employee'} was created in Firebase Auth, but saving users/{uid} in Realtime Database was blocked.`
            : getSignupErrorMessage(error?.code),
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
            Account Setup
          </p>
          <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Create an account in Firebase Auth, then save the same UID in
            Realtime Database.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-blue-50/78 sm:text-lg">
            This flow writes the selected role profile to
            <code className="mx-1 rounded bg-white/10 px-2 py-1 text-sm">
              users/{'{uid}'}
            </code>
            so login can verify role-based access without drifting out of sync.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-blue-50/78">
            <Link
              to="/"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
            >
              Back to Login
            </Link>
          </div>
        </section>

        <section className="glass mx-auto w-full max-w-md rounded-[32px] p-6 sm:p-8">
          <div className="mb-8">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-blue-50/80">
              TapTrack
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Create Account
            </h2>
            <p className="mt-3 text-sm leading-7 text-blue-50/76">
              Choose a role, then we create the Firebase Auth user first and
              save the matching profile under the same UID.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleAdminSignup}>
            <div className="space-y-3">
              <span className="block text-sm font-medium text-blue-50">
                Account Role
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
                {formData.selectedRole === 'admin' ? 'Admin Name' : 'Full Name'}
              </span>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={
                  formData.selectedRole === 'admin'
                    ? 'Company Admin'
                    : 'Employee Name'
                }
                required
                className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none ring-0 transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-blue-50">
                {formData.selectedRole === 'admin' ? 'Admin Email' : 'Email'}
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={
                  formData.selectedRole === 'admin'
                    ? 'admin@company.com'
                    : 'employee@company.com'
                }
                required
                className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none ring-0 transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-blue-50">
                Password
              </span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a secure password"
                minLength={6}
                required
                className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none ring-0 transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-blue-50">
                Confirm Password
              </span>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat the password"
                minLength={6}
                required
                className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none ring-0 transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
              />
            </label>

            {feedback.message ? (
              <div
                className={`rounded-3xl border px-4 py-3 text-sm ${feedbackStyles}`}
              >
                {feedback.message}
              </div>
            ) : null}

            <Button
              type="submit"
              className="mt-2 w-full py-3.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  {formData.selectedRole === 'admin'
                    ? 'Creating admin...'
                    : 'Creating account...'}
                </span>
              ) : formData.selectedRole === 'admin' ? (
                'Create Admin'
              ) : (
                'Create Employee Account'
              )}
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default Signup
