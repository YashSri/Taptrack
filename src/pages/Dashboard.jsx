import { useEffect, useMemo, useState } from 'react'
import { updatePassword } from 'firebase/auth'
import { onValue, ref as databaseRef } from 'firebase/database'
import ChartSection from '../components/ChartSection.jsx'
import HistoryList from '../components/HistoryList.jsx'
import Navbar from '../components/Navbar.jsx'
import StatsCard from '../components/StatsCard.jsx'
import UploadCard from '../components/UploadCard.jsx'
import { auth, db } from '../firebase.js'

const createFallbackProfile = (user) => ({
  name: user.displayName || user.email?.split('@')[0] || 'Employee',
  email: user.email || '',
  role: 'Employee',
  shift: 'Not assigned',
  isAdmin: false,
  employeeId: user.uid.slice(0, 8).toUpperCase(),
})

function Dashboard() {
  const currentUser = auth.currentUser
  const userId = currentUser?.uid ?? null
  const [profile, setProfile] = useState(
    currentUser ? createFallbackProfile(currentUser) : null,
  )
  const [records, setRecords] = useState([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(Boolean(userId))
  const [isLoadingProfile, setIsLoadingProfile] = useState(Boolean(userId))
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordStatus, setPasswordStatus] = useState(
    'Change your password here. Role and shift details are view-only for employees.',
  )
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      setIsLoadingProfile(false)
      setIsLoadingRecords(false)
      return undefined
    }

    const fallbackProfile = createFallbackProfile(currentUser)
    setProfile(fallbackProfile)

    const userRef = databaseRef(db, `users/${currentUser.uid}`)
    const unsubscribe = onValue(
      userRef,
      (snapshot) => {
        const value = snapshot.val()

        setProfile(
          value
            ? {
                ...fallbackProfile,
                ...value,
              }
            : fallbackProfile,
        )
        setIsLoadingProfile(false)
      },
      () => {
        setProfile(fallbackProfile)
        setIsLoadingProfile(false)
      },
    )

    return () => unsubscribe()
  }, [currentUser])

  useEffect(() => {
    if (!userId) {
      return undefined
    }

    const attendanceRef = databaseRef(db, `attendance/${userId}`)
    const unsubscribe = onValue(
      attendanceRef,
      (snapshot) => {
        const value = snapshot.val()
        const nextRecords = value
          ? Object.entries(value)
              .map(([id, record]) => ({
                id,
                ...record,
              }))
              .sort((first, second) => second.createdAt - first.createdAt)
          : []

        setRecords(nextRecords)
        setIsLoadingRecords(false)
      },
      () => {
        setRecords([])
        setIsLoadingRecords(false)
      },
    )

    return () => unsubscribe()
  }, [userId])

  const stats = useMemo(() => {
    const tapInCount = records.filter((record) => record.type === 'tap_in').length
    const tapOutCount = records.filter((record) => record.type === 'tap_out').length

    return {
      total: records.length,
      tapIn: tapInCount,
      tapOut: tapOutCount,
      latest: records[0] ?? null,
    }
  }, [records])

  const groupedByDate = useMemo(() => {
    return records.reduce((groups, record) => {
      const date = new Date(record.createdAt)
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-')
      const current = groups[key] || { tapIn: 0, tapOut: 0 }

      groups[key] = {
        tapIn: current.tapIn + (record.type === 'tap_in' ? 1 : 0),
        tapOut: current.tapOut + (record.type === 'tap_out' ? 1 : 0),
      }

      return groups
    }, {})
  }, [records])

  const handlePasswordChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    if (!currentUser) {
      setPasswordStatus('Please log in again before changing your password.')
      return
    }

    const nextPassword = passwordForm.newPassword.trim()

    if (nextPassword.length < 6) {
      setPasswordStatus('Use at least 6 characters for your new password.')
      return
    }

    if (nextPassword !== passwordForm.confirmPassword.trim()) {
      setPasswordStatus('New password and confirmation do not match.')
      return
    }

    setIsUpdatingPassword(true)
    setPasswordStatus('Updating your password...')

    try {
      await updatePassword(currentUser, nextPassword)
      setPasswordForm({
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordStatus('Password updated successfully.')
    } catch (error) {
      setPasswordStatus(
        error?.code === 'auth/requires-recent-login'
          ? 'Please log in again before changing your password.'
          : 'Unable to update your password right now.',
      )
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (isLoadingProfile) {
    return (
      <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6">
        <Navbar />
        <section className="mx-auto max-w-md py-8 sm:max-w-6xl sm:py-12">
          <div className="glass rounded-[30px] px-6 py-10 text-center text-blue-50/78">
            Loading your dashboard...
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6">
      <Navbar />

      <section className="mx-auto w-full max-w-md py-6 sm:max-w-6xl sm:py-8">
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <p className="text-sm uppercase tracking-[0.45em] text-blue-100/70">
            Employee Dashboard
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-5xl">
            Tap attendance, review your profile, and keep your access secure.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-blue-50/76">
            Your workspace is focused on attendance actions only. Role and shift
            settings are managed by your employer, while password changes stay
            in your control.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="glass rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
              Profile
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Employee identity
            </h3>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
                  Name
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {profile?.name}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
                  Email
                </p>
                <p className="mt-3 max-w-full break-all text-lg font-semibold text-white">
                  {profile?.email || currentUser?.email || '--'}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
                  Employee ID
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {profile?.employeeId || '--'}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
                  Role
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {profile?.role || 'Employee'}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
                  Shift Timing
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {profile?.shift || 'Not assigned'}
                </p>
                <p className="mt-2 text-sm text-blue-50/68">
                  Role and shift are read-only here and can only be updated by
                  an employer or admin.
                </p>
              </div>
            </div>
          </section>

          <section className="glass rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
              Security
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Change password
            </h3>
            <p className="mt-3 text-sm leading-7 text-blue-50/76">
              Update your account password without exposing any admin-managed
              employment settings.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={handlePasswordSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-blue-50">
                  New Password
                </span>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  minLength={6}
                  placeholder="Enter a stronger password"
                  className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-blue-50">
                  Confirm New Password
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  minLength={6}
                  placeholder="Re-enter the new password"
                  className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
                />
              </label>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(59,130,246,0.32)] transition duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isUpdatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/16 px-4 py-3 text-sm text-blue-50/76">
              {passwordStatus}
            </div>
          </section>
        </div>

        <div className="mt-8">
          <UploadCard employeeProfile={profile} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatsCard
            label="Total Records"
            value={stats.total}
            accent="slate"
            helper="All attendance actions recorded in your history."
          />
          <StatsCard
            label="Tap In Count"
            value={stats.tapIn}
            accent="emerald"
            helper="Successful office entries captured in realtime."
          />
          <StatsCard
            label="Tap Out Count"
            value={stats.tapOut}
            accent="blue"
            helper="Successful office exits recorded from your dashboard."
          />
        </div>

        {stats.latest ? (
          <div className="glass mt-8 rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
              Latest Entry
            </p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-2xl font-semibold text-white">
                  {stats.latest.type === 'tap_in' ? 'Tap In' : 'Tap Out'}
                </p>
                <p className="mt-2 text-sm text-blue-50/72">
                  Distance: {stats.latest.distance} m
                </p>
              </div>
              <p className="text-sm text-blue-50/72">
                {new Date(stats.latest.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <ChartSection records={records} groupedByDate={groupedByDate} />
        </div>

        <div className="mt-8">
          <HistoryList records={records} isLoading={isLoadingRecords} />
        </div>
      </section>
    </main>
  )
}

export default Dashboard
