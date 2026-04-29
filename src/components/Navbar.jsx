import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import Button from './Button.jsx'
import { auth } from '../firebase.js'

function Navbar() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const userEmail = auth.currentUser?.email ?? 'Signed in'

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await signOut(auth)
      navigate('/', { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="glass sticky top-3 z-30 mx-auto flex w-full max-w-md flex-col gap-4 rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 shadow-[0_20px_55px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:top-4 sm:max-w-6xl sm:flex-row sm:items-center sm:justify-between sm:rounded-[28px] sm:px-6">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
          Tap In / Tap Out
        </p>
        <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
          TapTrack
        </h1>
        <p className="mt-2 break-all text-sm text-blue-50/72">{userEmail}</p>
      </div>

      <Button
        variant="secondary"
        className="w-full px-4 py-3 sm:w-auto sm:px-5 sm:py-2.5"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </Button>
    </header>
  )
}

export default Navbar
