import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef } from 'firebase/database'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Navbar from '../components/Navbar.jsx'
import {
  calculateStats,
  getDuration,
  processAttendance,
} from '../components/AttendanceSection.jsx'
import { auth, db } from '../firebase.js'
import {
  attendanceBelongsToAdmin,
  belongsToAdmin,
  collectAdminIdsForEmail,
} from '../utils/adminOwnership.js'

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

function EmployeeDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const currentAdminId = auth.currentUser?.uid ?? null
  const currentAdminEmail = auth.currentUser?.email ?? ''
  const [employee, setEmployee] = useState(null)
  const [isAllowedEmployee, setIsAllowedEmployee] = useState(null)
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(Boolean(id))
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(Boolean(id))
  const [accessContext, setAccessContext] = useState({
    normalizedAdminEmail: '',
    relatedAdminIds: new Set(),
  })

  useEffect(() => {
    if (!currentAdminId || !id) {
      setEmployee(null)
      setIsAllowedEmployee(false)
      setIsLoadingEmployee(false)
      return undefined
    }

    const usersRef = databaseRef(db, 'users')
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const users = snapshot.val() || {}
        const employeeProfile = users[id]
        const { normalizedAdminEmail, relatedAdminIds } = collectAdminIdsForEmail(
          users,
          currentAdminEmail,
          currentAdminId,
        )

        const nextEmployee = employeeProfile
          ? {
              id,
              ...employeeProfile,
            }
          : null
        const nextIsAllowed = nextEmployee
          ? belongsToAdmin(nextEmployee, relatedAdminIds, normalizedAdminEmail)
          : false

        setEmployee(nextEmployee)
        setIsAllowedEmployee(nextIsAllowed)
        setAccessContext({
          normalizedAdminEmail,
          relatedAdminIds,
        })
        setIsLoadingEmployee(false)
      },
      (error) => {
        console.error('Failed to read employee details for admin view.', error)
        setEmployee(null)
        setIsAllowedEmployee(false)
        setAccessContext({
          normalizedAdminEmail: '',
          relatedAdminIds: new Set(),
        })
        setIsLoadingEmployee(false)
      },
    )

    return () => unsubscribe()
  }, [currentAdminEmail, currentAdminId, id])

  useEffect(() => {
    if (!id || !currentAdminId || !isAllowedEmployee) {
      setAttendanceRecords([])
      setIsLoadingAttendance(false)
      return undefined
    }

    setIsLoadingAttendance(true)
    const attendanceRef = databaseRef(db, `attendance/${id}`)
    const unsubscribe = onValue(
      attendanceRef,
      (snapshot) => {
        const userAttendance = snapshot.val() || {}
        const nextRecords = Object.entries(userAttendance)
          .map(([recordId, record]) => ({
            id: recordId,
            userId: id,
            ...record,
          }))
          .filter((record) =>
            attendanceBelongsToAdmin(
              record,
              accessContext.relatedAdminIds,
              accessContext.normalizedAdminEmail,
            ),
          )

        setAttendanceRecords(nextRecords)
        setIsLoadingAttendance(false)
      },
      (error) => {
        console.error('Failed to read employee attendance details.', error)
        setAttendanceRecords([])
        setIsLoadingAttendance(false)
      },
    )

    return () => unsubscribe()
  }, [accessContext, currentAdminId, id, isAllowedEmployee])

  const attendanceSummary = useMemo(() => {
    if (!employee) {
      return null
    }

    return processAttendance(attendanceRecords, [employee])[0] || {
      employee,
      sessions: [],
      stats: calculateStats([]),
    }
  }, [attendanceRecords, employee])

  const isLoading = isLoadingEmployee || isLoadingAttendance

  return (
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6">
      <Navbar />

      <section className="mx-auto w-full max-w-md py-6 sm:max-w-6xl sm:py-8">
        <div className="mb-6 flex justify-start sm:mb-8">
          <Button
            variant="secondary"
            className="w-full px-4 py-3 sm:w-auto sm:px-5 sm:py-2.5"
            onClick={() => navigate('/admin')}
          >
            Back to Admin Dashboard
          </Button>
        </div>

        {isLoading ? (
          <div className="glass rounded-[30px] px-6 py-12 text-center text-blue-50/78">
            Loading employee attendance details...
          </div>
        ) : !employee ? (
          <div className="glass rounded-[30px] px-6 py-12 text-center text-blue-50/78">
            This employee could not be found.
          </div>
        ) : !isAllowedEmployee ? (
          <div className="glass rounded-[30px] px-6 py-12 text-center text-blue-50/78">
            You do not have access to view this employee.
          </div>
        ) : (
          <>
            <div className="glass rounded-[30px] p-5 sm:p-8">
              <p className="text-sm uppercase tracking-[0.45em] text-blue-100/70">
                Employee Detail
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-5xl">
                {employee.name || employee.email || 'Employee Attendance'}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-50/76 sm:text-base">
                Review daily tap in and tap out sessions, completed working
                hours, and high-level attendance performance for this employee.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                  {
                    label: 'Email',
                    value: employee.email || '--',
                    tone: 'from-blue-300/28 via-blue-400/10 to-transparent',
                  },
                  {
                    label: 'Employee ID',
                    value: employee.employeeId || '--',
                    tone: 'from-slate-200/25 via-white/8 to-transparent',
                  },
                  {
                    label: 'Total Days',
                    value: attendanceSummary?.stats.totalDaysWorked ?? 0,
                    tone: 'from-cyan-300/28 via-cyan-400/10 to-transparent',
                  },
                  {
                    label: 'Total Hours',
                    value: getDuration(attendanceSummary?.stats.totalDurationMs ?? 0),
                    tone: 'from-emerald-300/28 via-emerald-400/10 to-transparent',
                  },
                  {
                    label: 'Average Hours',
                    value: getDuration(attendanceSummary?.stats.averageDurationMs ?? 0),
                    tone: 'from-indigo-300/28 via-indigo-400/10 to-transparent',
                  },
                ].map((card) => (
                  <article
                    key={card.label}
                    className="glass relative overflow-hidden rounded-[26px] p-4 sm:p-5"
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.tone}`}
                    />
                    <div className="relative">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-blue-100/66">
                        {card.label}
                      </p>
                      <p className="mt-3 break-all text-lg font-semibold text-white">
                        {card.value}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="glass mt-8 rounded-[30px] p-4 sm:p-6">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
                  Attendance History
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  Daily sessions
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50/74">
                  Every completed work session is paired from the employee's tap
                  in and tap out records. Incomplete sessions stay visible so
                  you can spot missing taps quickly.
                </p>
              </div>

              {!attendanceSummary?.sessions.length ? (
                <div className="rounded-[24px] border border-white/10 bg-slate-950/16 px-4 py-10 text-center text-sm text-blue-50/76">
                  No attendance records found for this employee yet.
                </div>
              ) : (
                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {attendanceSummary.sessions.map((session) => (
                    <article
                      key={session.id}
                      className="rounded-[24px] border border-white/10 bg-slate-950/16 p-4 transition duration-300 hover:border-blue-200/20 hover:bg-white/[0.06] sm:p-5"
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
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default EmployeeDetails
