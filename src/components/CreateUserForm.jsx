import { useState } from 'react'
import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { ref as databaseRef, set } from 'firebase/database'
import Button from './Button.jsx'
import { db, firebaseConfig } from '../firebase.js'

const initialForm = {
  employeeId: '',
  name: '',
  email: '',
  password: '',
  role: 'Employee',
  shift: '09:00 - 18:00',
  isAdmin: false,
}

function CreateUserForm() {
  const [formData, setFormData] = useState(initialForm)
  const [status, setStatus] = useState('Create employee accounts and assign shift details.')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus('Creating employee account...')

    const secondaryApp = initializeApp(
      firebaseConfig,
      `admin-user-create-${Date.now()}`,
    )
    const secondaryAuth = getAuth(secondaryApp)
    let createdUser = null

    try {
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
        email: formData.email.trim(),
        role: formData.role.trim(),
        shift: formData.shift.trim(),
        isAdmin: formData.isAdmin,
        createdAt: Date.now(),
      })

      setFormData(initialForm)
      setStatus('Employee account created successfully.')
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser)
        } catch {
          // If cleanup fails, we still surface the original error below.
        }
      }

      const message =
        error?.code === 'auth/email-already-in-use'
          ? 'This email is already in use. Try a different employee email.'
          : error?.code === 'auth/weak-password'
            ? 'Use a stronger password with at least 6 characters.'
            : 'Unable to create employee account right now. Please try again.'

      setStatus(message)
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

  return (
    <section className="glass rounded-[30px] p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
          Admin Controls
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          Create employee accounts
        </h3>
        <p className="mt-3 text-sm leading-7 text-blue-50/76">
          Provision new employees, assign their role, and set their standard shift
          in one place.
        </p>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-blue-50">
            Employee ID
          </span>
          <input
            name="employeeId"
            value={formData.employeeId}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-blue-50">
            Full Name
          </span>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
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
            className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-blue-50">
            Temporary Password
          </span>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            minLength={6}
            required
            className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
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
            className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
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
            className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-blue-50/80 md:col-span-2">
          <input
            type="checkbox"
            name="isAdmin"
            checked={formData.isAdmin}
            onChange={handleChange}
            className="h-4 w-4 rounded border-white/20 bg-transparent"
          />
          Grant admin access to this user
        </label>

        <div className="md:col-span-2">
          <Button type="submit" className="w-full py-3.5" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Employee'}
          </Button>
        </div>
      </form>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/16 px-4 py-3 text-sm text-blue-50/76">
        {status}
      </div>
    </section>
  )
}

export default CreateUserForm
