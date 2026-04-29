import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef } from 'firebase/database'
import { db } from '../firebase.js'
import {
  attendanceBelongsToAdmin,
  collectAdminIdsForEmail,
} from '../utils/adminOwnership.js'

const toDateKey = (timestamp) => {
  const date = new Date(timestamp)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const getTodayKey = () => toDateKey(Date.now())

function StatsCards({ totalEmployees, currentAdminEmail, currentAdminId }) {
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(currentAdminId))
  const [adminUsers, setAdminUsers] = useState({})

  useEffect(() => {
    if (!currentAdminId) {
      return undefined
    }

    const usersRef = databaseRef(db, 'users')
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        setAdminUsers(snapshot.val() || {})
      },
      () => {
        setAdminUsers({})
      },
    )

    return () => unsubscribe()
  }, [currentAdminId])

  useEffect(() => {
    if (!currentAdminId) {
      return undefined
    }

    const { normalizedAdminEmail, relatedAdminIds } = collectAdminIdsForEmail(
      adminUsers,
      currentAdminEmail,
      currentAdminId,
    )
    const attendanceRef = databaseRef(db, 'attendance')
    const unsubscribe = onValue(
      attendanceRef,
      (snapshot) => {
        const value = snapshot.val()
        const nextRecords = value
          ? Object.entries(value).flatMap(([userId, userAttendance]) =>
              Object.entries(userAttendance).map(([id, record]) => ({
                id,
                userId,
                ...record,
              })),
            ).filter((record) =>
              attendanceBelongsToAdmin(
                record,
                relatedAdminIds,
                normalizedAdminEmail,
              ),
            )
          : []

        setAttendanceRecords(nextRecords)
        setIsLoading(false)
      },
      (error) => {
        console.error('Failed to read admin attendance analytics.', error)
        setAttendanceRecords([])
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [adminUsers, currentAdminEmail, currentAdminId])

  const stats = useMemo(() => {
    const todayKey = getTodayKey()
    const presentToday = new Set(
      attendanceRecords
        .filter((record) => toDateKey(record.createdAt) === todayKey)
        .map((record) => record.userId),
    ).size

    return {
      totalAttendanceEntries: attendanceRecords.length,
      presentToday,
    }
  }, [attendanceRecords])

  const cards = [
    {
      label: 'Total Employees',
      value: totalEmployees,
      helper: 'All employee profiles synced from Realtime Database.',
      accent: 'from-slate-200/25 via-white/8 to-transparent',
    },
    {
      label: 'Attendance Entries',
      value: isLoading ? '...' : stats.totalAttendanceEntries,
      helper: 'All tap in and tap out records currently stored.',
      accent: 'from-blue-300/30 via-blue-400/10 to-transparent',
    },
    {
      label: 'Present Today',
      value: isLoading ? '...' : stats.presentToday,
      helper: 'Employees with at least one attendance record today.',
      accent: 'from-emerald-300/30 via-emerald-400/10 to-transparent',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="glass relative overflow-hidden rounded-[28px] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(15,23,42,0.28)] sm:p-6"
        >
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent}`}
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.3em] text-blue-100/72">
              {card.label}
            </p>
            <p className="mt-4 text-4xl font-semibold text-white">
              {card.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-blue-50/72">
              {card.helper}
            </p>
          </div>
        </article>
      ))}
    </div>
  )
}

export default StatsCards
