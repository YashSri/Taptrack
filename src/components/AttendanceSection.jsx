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

const formatDateLabel = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    dateStyle: 'medium',
  })
}

const formatTime = (timestamp) => {
  if (!timestamp) {
    return '--'
  }

  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDuration(durationMs) {
  if (!durationMs || durationMs <= 0) {
    return '--'
  }

  const totalMinutes = Math.round(durationMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function calculateStats(sessions) {
  const workedDays = new Set()
  let totalDurationMs = 0

  sessions.forEach((session) => {
    if (session.durationMs > 0) {
      workedDays.add(session.dateKey)
      totalDurationMs += session.durationMs
    }
  })

  const totalDaysWorked = workedDays.size
  const averageDurationMs =
    totalDaysWorked > 0 ? totalDurationMs / totalDaysWorked : 0

  return {
    totalDaysWorked,
    totalDurationMs,
    averageDurationMs,
  }
}

function processAttendance(records, employees) {
  const sessionsByUser = new Map()

  records
    .slice()
    .sort((first, second) => first.createdAt - second.createdAt)
    .forEach((record) => {
      const dateKey = toDateKey(record.createdAt)
      const userSessions = sessionsByUser.get(record.userId) || new Map()
      const dayRecords = userSessions.get(dateKey) || []

      dayRecords.push(record)
      userSessions.set(dateKey, dayRecords)
      sessionsByUser.set(record.userId, userSessions)
    })

  return employees
    .map((employee) => {
      const employeeDays = sessionsByUser.get(employee.id) || new Map()
      const sessions = []

      Array.from(employeeDays.entries())
        .sort(([firstKey], [secondKey]) => secondKey.localeCompare(firstKey))
        .forEach(([dateKey, dayRecords]) => {
          const tapInQueue = []

          dayRecords.forEach((record) => {
            if (record.type === 'tap_in') {
              tapInQueue.push(record)
              return
            }

            if (record.type === 'tap_out') {
              const matchingTapIn = tapInQueue.shift() || null
              const durationMs =
                matchingTapIn && record.createdAt > matchingTapIn.createdAt
                  ? record.createdAt - matchingTapIn.createdAt
                  : 0

              sessions.push({
                id: `${employee.id}-${dateKey}-${record.id}`,
                dateKey,
                tapIn: matchingTapIn,
                tapOut: record,
                durationMs,
              })
            }
          })

          tapInQueue.forEach((record) => {
            sessions.push({
              id: `${employee.id}-${dateKey}-${record.id}`,
              dateKey,
              tapIn: record,
              tapOut: null,
              durationMs: 0,
            })
          })
        })

      sessions.sort((first, second) => {
        const firstTimestamp = first.tapIn?.createdAt || first.tapOut?.createdAt || 0
        const secondTimestamp =
          second.tapIn?.createdAt || second.tapOut?.createdAt || 0

        return secondTimestamp - firstTimestamp
      })

      return {
        employee,
        sessions,
        stats: calculateStats(sessions),
      }
    })
    .sort((first, second) =>
      (first.employee.name || '').localeCompare(second.employee.name || ''),
    )
}

function AttendanceSection({
  employees,
  isLoadingEmployees,
  currentAdminEmail,
  currentAdminId,
}) {
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(
    Boolean(employees.length),
  )
  const [adminUsers, setAdminUsers] = useState({})

  useEffect(() => {
    if (!currentAdminId) {
      setAdminUsers({})
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
    const attendanceRef = databaseRef(db, 'attendance')
    const unsubscribe = onValue(
      attendanceRef,
      (snapshot) => {
        const value = snapshot.val()
        const nextRecords = value
          ? Object.entries(value).flatMap(([userId, userAttendance]) =>
              Object.entries(userAttendance || {}).map(([id, record]) => ({
                id,
                userId,
                ...record,
              })),
            )
          : []

        setAttendanceRecords(nextRecords)
        setIsLoadingAttendance(false)
      },
      (error) => {
        console.error('Failed to read admin attendance history.', error)
        setAttendanceRecords([])
        setIsLoadingAttendance(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const employeeIds = useMemo(
    () => new Set(employees.map((employee) => employee.id)),
    [employees],
  )

  const attendanceByEmployee = useMemo(() => {
    const { normalizedAdminEmail, relatedAdminIds } = collectAdminIdsForEmail(
      adminUsers,
      currentAdminEmail,
      currentAdminId,
    )
    const filteredRecords = attendanceRecords.filter((record) =>
      employeeIds.has(record.userId) &&
      attendanceBelongsToAdmin(
        record,
        relatedAdminIds,
        normalizedAdminEmail,
      ),
    )

    return processAttendance(filteredRecords, employees)
  }, [
    adminUsers,
    attendanceRecords,
    currentAdminEmail,
    currentAdminId,
    employeeIds,
    employees,
  ])

  const overallStats = useMemo(() => {
    let totalDaysWorked = 0
    let totalDurationMs = 0
    let employeesWithHours = 0

    attendanceByEmployee.forEach(({ stats }) => {
      totalDaysWorked += stats.totalDaysWorked
      totalDurationMs += stats.totalDurationMs

      if (stats.totalDurationMs > 0) {
        employeesWithHours += 1
      }
    })

    const averageDurationMs =
      totalDaysWorked > 0 ? totalDurationMs / totalDaysWorked : 0

    return {
      totalDaysWorked,
      totalDurationMs,
      averageDurationMs,
      employeesWithHours,
    }
  }, [attendanceByEmployee])

  const isLoading = isLoadingEmployees || isLoadingAttendance
  const hasAttendance = attendanceByEmployee.some(
    ({ sessions }) => sessions.length > 0,
  )

  return (
    <section className="mt-8 sm:mt-10">
      <div className="glass rounded-[30px] p-4 sm:rounded-[34px] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.45em] text-blue-100/70">
              Attendance Analytics
            </p>
            <h3 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-4xl">
              Review tap in, tap out, and daily working hours for every employee.
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50/76 sm:text-base">
              Attendance records are paired by employee and date so you can scan
              daily sessions, total hours, and average productivity without
              leaving the admin dashboard.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Employees Tracked',
              value: employees.length,
              helper: 'Employee profiles currently assigned to this admin.',
              accent: 'from-blue-300/28 via-blue-400/10 to-transparent',
            },
            {
              label: 'Total Days Worked',
              value: isLoading ? '...' : overallStats.totalDaysWorked,
              helper: 'Combined employee workdays with complete tap pairs.',
              accent: 'from-slate-200/25 via-white/8 to-transparent',
            },
            {
              label: 'Total Hours',
              value: isLoading ? '...' : getDuration(overallStats.totalDurationMs),
              helper: 'All completed working hours captured from attendance.',
              accent: 'from-emerald-300/28 via-emerald-400/10 to-transparent',
            },
            {
              label: 'Average Hours / Day',
              value: isLoading ? '...' : getDuration(overallStats.averageDurationMs),
              helper: 'Average completed hours across all worked days.',
              accent: 'from-cyan-300/28 via-cyan-400/10 to-transparent',
            },
          ].map((card) => (
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
                <p className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                  {card.value}
                </p>
                <p className="mt-3 text-sm leading-6 text-blue-50/72">
                  {card.helper}
                </p>
              </div>
            </article>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/16 px-5 py-10 text-center text-sm text-blue-50/76">
            Loading attendance history...
          </div>
        ) : !employees.length ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/16 px-5 py-10 text-center text-sm text-blue-50/76">
            Add employees first to start reviewing attendance analytics.
          </div>
        ) : !hasAttendance ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/16 px-5 py-10 text-center text-sm text-blue-50/76">
            Attendance history will appear here after employees start tapping in
            and out.
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {attendanceByEmployee.map(({ employee, sessions, stats }) => (
              <article
                key={employee.id}
                className="glass overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04]"
              >
                <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-blue-100/70">
                        Employee Performance
                      </p>
                      <h4 className="mt-2 text-2xl font-semibold text-white">
                        {employee.name || employee.email || 'Unnamed employee'}
                      </h4>
                      <p className="mt-2 text-sm text-blue-50/72">
                        {employee.email || 'No email available'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-white/10 bg-slate-950/18 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/64">
                          Total Days
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {stats.totalDaysWorked}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-slate-950/18 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/64">
                          Total Hours
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {getDuration(stats.totalDurationMs)}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-slate-950/18 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/64">
                          Avg / Day
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {getDuration(stats.averageDurationMs)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="max-h-[460px] overflow-y-auto px-5 py-5 sm:px-6">
                  {sessions.length ? (
                    <div className="grid gap-3">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4 transition duration-300 hover:border-blue-200/20 hover:bg-white/[0.06]"
                        >
                          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr]">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/62">
                                Date
                              </p>
                              <p className="mt-2 text-base font-semibold text-white">
                                {formatDateLabel(session.dateKey)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/62">
                                Tap In
                              </p>
                              <p className="mt-2 text-base font-semibold text-white">
                                {formatTime(session.tapIn?.createdAt)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/62">
                                Tap Out
                              </p>
                              <p className="mt-2 text-base font-semibold text-white">
                                {formatTime(session.tapOut?.createdAt)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/62">
                                Total Hours
                              </p>
                              <p className="mt-2 text-base font-semibold text-white">
                                {getDuration(session.durationMs)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/16 px-4 py-8 text-center text-sm text-blue-50/72">
                      No attendance records found for this employee yet.
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export { calculateStats, getDuration, processAttendance }
export default AttendanceSection
