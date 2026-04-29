import { useState } from 'react'
import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signOut,
  updateCurrentUser,
  updateProfile,
} from 'firebase/auth'
import { ref as databaseRef, set } from 'firebase/database'
import Button from './Button.jsx'
import { auth, db, firebaseConfig } from '../firebase.js'
import { normalizeEmail } from '../utils/adminOwnership.js'

const initialForm = {
  name: '',
  email: '',
  password: '',
  employeeId: '',
  role: 'Employee',
  shift: '09:00 - 18:00',
}

function AddEmployeeModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState(initialForm)
  const [feedback, setFeedback] = useState({
    type: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) {
    return null
  }

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

  const resetState = () => {
    setFormData(initialForm)
    setFeedback({
      type: '',
      message: '',
    })
    setIsSubmitting(false)
  }

  const handleClose = () => {
    if (isSubmitting) {
      return
    }

    resetState()
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = formData.name.trim()
    const trimmedEmail = normalizeEmail(formData.email)
    const password = formData.password
    const trimmedEmployeeId = formData.employeeId.trim()
    const trimmedRole = formData.role.trim()
    const trimmedShift = formData.shift.trim()

    if (
      !trimmedName ||
      !trimmedEmail ||
      !password ||
      !trimmedEmployeeId ||
      !trimmedRole ||
      !trimmedShift
    ) {
      setFeedback({
        type: 'error',
        message: 'Fill in every field before creating the employee.',
      })
      return
    }

    if (password.length < 6) {
      setFeedback({
        type: 'error',
        message: 'Password must be at least 6 characters long.',
      })
      return
    }

    setIsSubmitting(true)
    setFeedback({
      type: 'info',
      message: 'Creating employee account...',
    })

    const currentAdminUser = auth.currentUser
    const currentAdminEmail = normalizeEmail(currentAdminUser?.email || '')

    if (!currentAdminUser?.uid) {
      setFeedback({
        type: 'error',
        message: 'Admin session not found. Please log in again and try.',
      })
      setIsSubmitting(false)
      return
    }

    const secondaryApp = initializeApp(
      firebaseConfig,
      `add-employee-${Date.now()}`,
    )
    const secondaryAuth = getAuth(secondaryApp)
    let createdUser = null

    try {
      await setPersistence(secondaryAuth, inMemoryPersistence)

      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        trimmedEmail,
        password,
      )
      createdUser = credential.user

      await updateProfile(createdUser, {
        displayName: trimmedName,
      })

      await set(databaseRef(db, `users/${createdUser.uid}`), {
        name: trimmedName,
        email: trimmedEmail,
        employeeId: trimmedEmployeeId,
        role: trimmedRole,
        shift: trimmedShift,
        adminId: currentAdminUser.uid,
        adminEmail: currentAdminEmail,
        isAdmin: false,
        createdAt: Date.now(),
      })

      if (currentAdminUser && auth.currentUser?.uid !== currentAdminUser.uid) {
        await updateCurrentUser(auth, currentAdminUser)
      }

      setFeedback({
        type: 'success',
        message: 'Employee created successfully. Admin access is still active.',
      })

      window.setTimeout(() => {
        resetState()
        onClose()
      }, 700)
    } catch (error) {
      console.error('Employee creation failed.', error)
      if (createdUser) {
        try {
          await deleteUser(createdUser)
        } catch {
          // Ignore rollback failures and keep the original error below.
        }
      }

      if (currentAdminUser && auth.currentUser?.uid !== currentAdminUser.uid) {
        await updateCurrentUser(auth, currentAdminUser).catch(() => {})
      }

      setFeedback({
        type: 'error',
        message:
          error?.code === 'auth/email-already-in-use'
            ? 'That email is already in use. Try a different employee email.'
            : error?.code === 'auth/weak-password'
              ? 'Use a stronger password with at least 6 characters.'
              : 'Unable to create the employee right now.',
      })
    } finally {
      try {
        await signOut(secondaryAuth)
      } catch (error) {
        console.error('Failed to clean up the secondary auth session.', error)
      }

      await deleteApp(secondaryApp)
      setIsSubmitting(false)
    }
  }

  const feedbackStyles =
    feedback.type === 'error'
      ? 'border-rose-200/20 bg-rose-500/10 text-rose-100'
      : feedback.type === 'success'
        ? 'border-emerald-200/20 bg-emerald-500/10 text-emerald-100'
        : 'border-white/10 bg-slate-950/16 text-blue-50/76'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="glass w-full max-w-md max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[28px] p-4 sm:max-w-3xl sm:max-h-[calc(100vh-3rem)] sm:rounded-[32px] sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
              Add Employee
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Create a new employee
            </h3>
            <p className="mt-3 text-sm leading-7 text-blue-50/76">
              Create a Firebase Auth account, store the employee profile in
              Realtime Database, and keep the admin logged in automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-blue-50/78 transition duration-300 hover:bg-white/12 hover:text-white sm:w-auto sm:py-2"
          >
            Close
          </button>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Name
            </span>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Email
            </span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-blue-200/60 focus:bg-white/12"
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
              minLength={6}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Employee ID
            </span>
            <input
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Role
            </span>
            <input
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Shift
            </span>
            <input
              name="shift"
              value={formData.shift}
              onChange={handleChange}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          {feedback.message ? (
            <div
              className={`rounded-[24px] border px-4 py-3 text-sm md:col-span-2 ${feedbackStyles}`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
            <Button
              type="submit"
              className="w-full flex-1 py-3.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating employee...' : 'Create Employee'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full px-6 py-3.5 sm:w-auto"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddEmployeeModal
