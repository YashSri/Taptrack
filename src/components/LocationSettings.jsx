import { useEffect, useState } from 'react'
import { onValue, ref as databaseRef, set } from 'firebase/database'
import Button from './Button.jsx'
import { db } from '../firebase.js'

const EMPTY_FORM = {
  lat: '',
  lng: '',
  radius: '',
}

const normalizeSettings = (value) => {
  const lat = Number(value?.officeLocation?.lat)
  const lng = Number(value?.officeLocation?.lng)
  const radius = Number(value?.radius)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {
    return null
  }

  return { lat, lng, radius }
}

function LocationSettings({ adminId }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('Loading saved office settings...')
  const [isSaving, setIsSaving] = useState(false)
  const [savedSettings, setSavedSettings] = useState(null)

  useEffect(() => {
    if (!adminId) {
      setForm(EMPTY_FORM)
      setSavedSettings(null)
      setStatus('Admin session not found. Please log in again.')
      return undefined
    }

    const settingsRef = databaseRef(db, `settings/${adminId}`)
    const unsubscribe = onValue(
      settingsRef,
      (snapshot) => {
        const nextSettings = normalizeSettings(snapshot.val())

        if (!nextSettings) {
          setSavedSettings(null)
          setForm(EMPTY_FORM)
          setStatus('No office location saved yet. Add coordinates and a radius below.')
          return
        }

        setSavedSettings(nextSettings)
        setForm({
          lat: String(nextSettings.lat),
          lng: String(nextSettings.lng),
          radius: String(nextSettings.radius),
        })
        setStatus('Office settings synced from Firebase.')
      },
      (error) => {
        console.error('Failed to read office settings.', error)
        setSavedSettings(null)
        setStatus('Unable to load office settings right now.')
      },
    )

    return () => unsubscribe()
  }, [adminId])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const lat = Number(form.lat)
    const lng = Number(form.lng)
    const radius = Number(form.radius)

    if (!form.lat || !form.lng || !form.radius) {
      setStatus('Latitude, longitude, and radius are all required.')
      return
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setStatus('Enter a valid latitude between -90 and 90.')
      return
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setStatus('Enter a valid longitude between -180 and 180.')
      return
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      setStatus('Enter a radius greater than 0 meters.')
      return
    }

    setIsSaving(true)
    setStatus('Saving office settings...')

    try {
      const nextSettings = {
        officeLocation: {
          lat,
          lng,
        },
        radius,
      }

      await set(databaseRef(db, `settings/${adminId}`), nextSettings)
      setSavedSettings({
        lat,
        lng,
        radius,
      })
      setStatus('Office location and radius saved successfully.')
    } catch (error) {
      console.error('Failed to save office settings.', error)
      setStatus('Unable to save office settings right now. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="glass rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
            Office Settings
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            Configure office location and allowed radius
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50/76">
            These values are stored per admin in Firebase Realtime Database and
            applied instantly to employee tap validation.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/12 bg-slate-950/18 px-4 py-3 text-sm text-blue-50/78">
          <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">
            Current Saved Zone
          </p>
          <p className="mt-3">
            <span className="font-medium text-white">Latitude:</span>{' '}
            {savedSettings ? savedSettings.lat.toFixed(6) : '--'}
          </p>
          <p className="mt-2">
            <span className="font-medium text-white">Longitude:</span>{' '}
            {savedSettings ? savedSettings.lng.toFixed(6) : '--'}
          </p>
          <p className="mt-2">
            <span className="font-medium text-white">Radius:</span>{' '}
            {savedSettings ? `${savedSettings.radius} m` : '--'}
          </p>
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Latitude
            </span>
            <input
              type="number"
              name="lat"
              value={form.lat}
              onChange={handleChange}
              step="any"
              placeholder="28.613900"
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Longitude
            </span>
            <input
              type="number"
              name="lng"
              value={form.lng}
              onChange={handleChange}
              step="any"
              placeholder="77.209000"
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-blue-50">
              Radius (meters)
            </span>
            <input
              type="number"
              name="radius"
              value={form.radius}
              onChange={handleChange}
              min="1"
              step="1"
              placeholder="200"
              className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-blue-100/35 focus:border-blue-200/60 focus:bg-white/12"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/16 px-4 py-3 text-sm text-blue-50/76">
            {status}
          </div>

          <Button
            type="submit"
            className="w-full px-6 py-3.5 sm:w-auto"
            disabled={isSaving || !adminId}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </section>
  )
}

export default LocationSettings
