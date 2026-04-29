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

const initialForm = {
  employeeId: '',
  name: '',
  role: 'Employee',
  shift: '09:00 - 18:00',
  email: '',
  password: '',
}

function CreateEmployeeForm() {
  const [formData, setFormData] = useState(initialForm)
  const [feedback, setFeedback] = useState({
    type: 'info',
    message:
      'Create employee accounts and keep the admin session active after each invite.',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback({
      type: 'info',
      message: 'Creating employee account...',
    })

    const currentAdminUser = auth.currentUser
    const secondaryApp = initializeApp(
      firebaseConfig,
      `create-employee-${Date.now()}`,
    )
    const secondaryAuth = getAuth(secondaryApp)
    let createdUser = null

    try {
      await setPersistence(secondaryAuth, inMemoryPersistence)

      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email.trim(),
        formData.password,
      )
      createdUser = credential.user

      await updateProfile(createdUser, {
        displayName: formData.name.trim(),
      })

      await set(databaseRef(db, `users/${createdUser.uid}`), {
        employeeId: formData.employeeId.trim(),
        name: formData.name.trim(),
        role: formData.role.trim(),
        shift: formData.shift.trim(),
        email: formData.email.trim(),
        isAdmin: false,
        createdAt: Date.now(),
      })

      if (currentAdminUser && auth.currentUser?.uid !== currentAdminUser.uid) {
        await updateCurrentUser(auth, currentAdminUser)
      }

      setFormData(initialForm)
      setFeedback({
        type: 'success',
        message:
          'Employee account created successfully. Admin access is still active.',
      })
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser)
        } catch {
          // Ignore cleanup failures and surface the original error below.
        }
      }

      if (currentAdminUser && auth.currentUser?.uid !== currentAdminUser.uid) {
        await updateCurrentUser(auth, currentAdminUser).catch(() => {})
      }

      setFeedback({
        type: 'error',
        message:
          error?.code === 'auth/email-already-in-use'
            ? 'This email is already in use. Try a different employee email.'
            : error?.code === 'auth/weak-password'
              ? 'Use a stronger password with at least 6 characters.'
              : 'Unable to create the employee account right now.',
      })
    } finally {
      try {
        await signOut(secondaryAuth)
      } catch {
        // Ignore secondary auth cleanup failures.
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
    <section className="glass rounded-[30px] p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
          Create Employee
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          Provision a new employee account
        </h3>
        <p className="mt-3 text-sm leading-7 text-blue-50/76">
          Admins can create employee credentials here without losing their own
          dashboard session.
        </p>
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
            Shift Timing
          </span>
          <input
            name="shift"
            value={formData.shift}
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

        <div className="md:col-span-2">
          <Button type="submit" className="w-full py-3.5" disabled={isSubmitting}>
            {isSubmitting ? 'Creating employee...' : 'Create Employee'}
          </Button>
        </div>
      </form>

      <div className={`mt-5 rounded-[24px] border px-4 py-3 text-sm ${feedbackStyles}`}>
        {feedback.message}
      </div>
    </section>
  )
}

export default CreateEmployeeForm
