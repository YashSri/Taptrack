import { useEffect, useState } from 'react'
import { onValue, ref as databaseRef } from 'firebase/database'
import { useNavigate } from 'react-router-dom'
import AddEmployeeModal from '../components/AddEmployeeModal.jsx'
import AttendanceSection from '../components/AttendanceSection.jsx'
import EmployeeTable from '../components/EmployeeTable.jsx'
import LocationSettings from '../components/LocationSettings.jsx'
import Navbar from '../components/Navbar.jsx'
import StatsCards from '../components/StatsCards.jsx'
import Button from '../components/Button.jsx'
import { auth, db } from '../firebase.js'
import {
  belongsToAdmin,
  collectAdminIdsForEmail,
} from '../utils/adminOwnership.js'

function AdminDashboard() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(
    Boolean(auth.currentUser?.uid),
  )
  const [isModalOpen, setIsModalOpen] = useState(false)
  const currentAdminId = auth.currentUser?.uid ?? null
  const currentAdminEmail = auth.currentUser?.email ?? ''

  useEffect(() => {
    if (!currentAdminId) {
      return undefined
    }

    const usersRef = databaseRef(db, 'users')
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const value = snapshot.val()
        const { normalizedAdminEmail, relatedAdminIds } = collectAdminIdsForEmail(
          value,
          currentAdminEmail,
          currentAdminId,
        )
        const nextEmployees = value
          ? Object.entries(value)
              .map(([id, profile]) => ({
                id,
                ...profile,
              }))
              .filter((profile) =>
                belongsToAdmin(profile, relatedAdminIds, normalizedAdminEmail),
              )
              .sort((first, second) =>
                (first.name || '').localeCompare(second.name || ''),
              )
          : []

        setEmployees(nextEmployees)
        setIsLoadingEmployees(false)
      },
      (error) => {
        console.error('Failed to read employees for the admin dashboard.', error)
        setEmployees([])
        setIsLoadingEmployees(false)
      },
    )

    return () => unsubscribe()
  }, [currentAdminEmail, currentAdminId])

  return (
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6">
      <Navbar />

      <section className="mx-auto w-full max-w-md py-6 sm:max-w-6xl sm:py-8">
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <p className="text-sm uppercase tracking-[0.45em] text-blue-100/70">
            Admin Dashboard
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-5xl">
            View employee records, track attendance totals, and add new team
            members from one polished control center.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-blue-50/76">
            This workspace combines realtime employee data, analytics, and a
            Firebase-powered employee creation flow inside one premium
            glassmorphism dashboard.
          </p>
        </div>

        <StatsCards
          totalEmployees={employees.length}
          currentAdminEmail={currentAdminEmail}
          currentAdminId={currentAdminId}
        />

        <div className="mt-8">
          <LocationSettings adminId={currentAdminId} />
        </div>

        <div className="mt-6 flex justify-stretch sm:mt-8 sm:justify-end">
          <Button
            className="w-full px-6 py-3.5 sm:w-auto"
            onClick={() => setIsModalOpen(true)}
          >
            Add Employee
          </Button>
        </div>

        <div className="mt-8">
          <EmployeeTable
            employees={employees}
            isLoading={isLoadingEmployees}
            onEmployeeSelect={(employeeId) => navigate(`/employee/${employeeId}`)}
          />
        </div>

        <AttendanceSection
          employees={employees}
          isLoadingEmployees={isLoadingEmployees}
          currentAdminEmail={currentAdminEmail}
          currentAdminId={currentAdminId}
        />
      </section>

      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  )
}

export default AdminDashboard
