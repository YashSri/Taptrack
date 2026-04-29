import { useCallback, useEffect, useState } from 'react'
import L from 'leaflet'
import {
  get,
  onValue,
  push,
  ref as databaseRef,
  update,
} from 'firebase/database'
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import Button from './Button.jsx'
import { auth, db } from '../firebase.js'
import { normalizeEmail } from '../utils/adminOwnership.js'

const LOCATION_FRESHNESS_MS = 60000
const ADMIN_LINK_MISSING_MESSAGE =
  'Your employee profile is not linked to an admin yet. Contact your admin before marking attendance.'
const OFFICE_SETTINGS_MISSING_MESSAGE =
  'Your admin has not configured office settings yet. Attendance stays locked until a location and radius are saved.'

const officeIcon = L.divIcon({
  className: 'office-map-marker',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,#dbeafe,#60a5fa);border:2px solid rgba(255,255,255,0.9);box-shadow:0 10px 28px rgba(59,130,246,0.45);">
      <div style="width:8px;height:8px;border-radius:9999px;background:#1d4ed8;"></div>
    </div>
  `,
  iconAnchor: [11, 11],
})

const userIcon = L.divIcon({
  className: 'user-map-marker',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:linear-gradient(135deg,#86efac,#10b981);border:2px solid rgba(255,255,255,0.95);box-shadow:0 12px 30px rgba(16,185,129,0.4);">
      <div style="width:9px;height:9px;border-radius:9999px;background:#ecfdf5;"></div>
    </div>
  `,
  iconAnchor: [12, 12],
})

const formatCoordinate = (value) =>
  typeof value === 'number' ? value.toFixed(6) : '--'

const formatDistance = (value) =>
  typeof value === 'number' ? `${Math.round(value)} m` : '--'

const formatAttendanceTime = (timestamp) =>
  new Date(timestamp).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

function getDistance(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const earthRadius = 6371000
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

const normalizeOfficeConfig = (value) => {
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

  return {
    lat,
    lng,
    radius,
  }
}

const getGeolocationErrorMessage = (error) => {
  const messages = {
    1: 'Location permission was denied. Allow GPS access to continue.',
    2: 'GPS is unavailable right now. Check your device location settings.',
    3: 'Location request timed out. Please try again.',
  }

  return messages[error?.code] || 'Unable to fetch your current location.'
}

const getDatabaseErrorMessage = (error) => {
  if (error?.code === 'PERMISSION_DENIED') {
    return 'Realtime Database blocked this save. Check your database rules.'
  }

  return 'Attendance could not be saved right now. Please try again.'
}

const getCurrentPosition = (options) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })

const fetchCurrentPosition = async () => {
  try {
    return await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
    })
  } catch (error) {
    if (error?.code !== 3) {
      throw error
    }

    return getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000,
    })
  }
}

function LiveMapViewport({ userPosition, officeLocation }) {
  const map = useMap()

  useEffect(() => {
    if (!userPosition) {
      map.setView([officeLocation.lat, officeLocation.lng], 17, {
        animate: true,
      })
      return
    }

    const bounds = L.latLngBounds(
      [officeLocation.lat, officeLocation.lng],
      [userPosition.lat, userPosition.lng],
    )

    map.fitBounds(bounds.pad(0.5), {
      animate: true,
      maxZoom: 18,
    })
  }, [map, officeLocation, userPosition])

  return null
}

const evaluateOfficeRange = (nextLocation, nextOfficeConfig) => {
  const nextDistance = getDistance(
    nextLocation.lat,
    nextLocation.lng,
    nextOfficeConfig.lat,
    nextOfficeConfig.lng,
  )

  return {
    distance: nextDistance,
    insideRange: nextDistance <= nextOfficeConfig.radius,
  }
}

function UploadCard({ employeeProfile = null }) {
  const [officeConfig, setOfficeConfig] = useState(null)
  const [location, setLocation] = useState(null)
  const [distance, setDistance] = useState(null)
  const [status, setStatus] = useState('Loading office settings and location...')
  const [locationState, setLocationState] = useState('loading')
  const [isFetchingLocation, setIsFetchingLocation] = useState(true)
  const [isLoadingOfficeConfig, setIsLoadingOfficeConfig] = useState(true)
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [lastAttendance, setLastAttendance] = useState(null)
  const [adminId, setAdminId] = useState(employeeProfile?.adminId || null)
  const [adminEmail, setAdminEmail] = useState(
    normalizeEmail(employeeProfile?.adminEmail || ''),
  )

  useEffect(() => {
    if (employeeProfile?.adminId) {
      setAdminId(employeeProfile.adminId)
    }

    if (employeeProfile?.adminEmail) {
      setAdminEmail(normalizeEmail(employeeProfile.adminEmail))
    }
  }, [employeeProfile])

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setAdminId(null)
      setAdminEmail('')
      return undefined
    }

    const userRef = databaseRef(db, `users/${auth.currentUser.uid}`)
    const unsubscribe = onValue(
      userRef,
      (snapshot) => {
        const value = snapshot.val()
        setAdminId(value?.adminId || null)
        setAdminEmail(
          normalizeEmail(value?.adminEmail || ''),
        )
      },
      (error) => {
        console.error('Failed to read employee admin mapping.', error)
        setAdminId(null)
        setAdminEmail('')
      },
    )

    return () => unsubscribe()
  }, [])

  const syncLocationState = useCallback((
    coords,
    messageOverride,
    officeConfigOverride = officeConfig,
    adminIdOverride = adminId,
  ) => {
    const nextLocation = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy ?? null,
      capturedAt: Date.now(),
    }

    const officeEvaluation = officeConfigOverride
      ? evaluateOfficeRange(nextLocation, officeConfigOverride)
      : null

    setLocation(nextLocation)
    setDistance(officeEvaluation?.distance ?? null)
    setLocationState(
      officeEvaluation
        ? officeEvaluation.insideRange
          ? 'inside'
          : 'outside'
        : adminIdOverride
          ? 'missing-settings'
          : 'error',
    )
    setStatus(
      messageOverride ||
        (officeEvaluation
          ? officeEvaluation.insideRange
            ? 'Inside office range. You can tap in or tap out now.'
            : `Outside the ${officeConfigOverride.radius}m office radius. Move closer to continue.`
          : adminIdOverride
            ? OFFICE_SETTINGS_MISSING_MESSAGE
            : ADMIN_LINK_MISSING_MESSAGE),
    )

    if (auth.currentUser) {
      update(databaseRef(db, `users/${auth.currentUser.uid}`), {
        lastLocation: {
          latitude: nextLocation.lat,
          longitude: nextLocation.lng,
          distance: officeEvaluation ? Math.round(officeEvaluation.distance) : null,
          updatedAt: nextLocation.capturedAt,
        },
      }).catch((error) => {
        console.error('Failed to persist the latest employee location.', error)
      })
    }

    return {
      ...nextLocation,
      distance: officeEvaluation?.distance ?? null,
      insideRange: officeEvaluation?.insideRange ?? false,
    }
  }, [adminId, officeConfig])

  const resolveLocationForAction = async (officeConfigOverride = officeConfig) => {
    const hasFreshLocation =
      location &&
      typeof location.capturedAt === 'number' &&
      Date.now() - location.capturedAt <= LOCATION_FRESHNESS_MS

    if (hasFreshLocation) {
      const officeEvaluation =
        officeConfigOverride &&
        (typeof distance === 'number'
          ? {
              distance,
              insideRange: distance <= officeConfigOverride.radius,
            }
          : evaluateOfficeRange(location, officeConfigOverride))

      return {
        ...location,
        distance: officeEvaluation?.distance ?? null,
        insideRange: officeEvaluation?.insideRange ?? false,
      }
    }

    const position = await fetchCurrentPosition()
    return syncLocationState(position.coords, undefined, officeConfigOverride)
  }

  useEffect(() => {
    if (!adminId) {
      setOfficeConfig(null)
      setIsLoadingOfficeConfig(false)
      return undefined
    }

    setIsLoadingOfficeConfig(true)
    const officeRef = databaseRef(db, `settings/${adminId}`)
    const unsubscribe = onValue(
      officeRef,
      (snapshot) => {
        setOfficeConfig(normalizeOfficeConfig(snapshot.val()))
        setIsLoadingOfficeConfig(false)
      },
      (error) => {
        console.error('Failed to read office settings for the employee.', error)
        setOfficeConfig(null)
        setIsLoadingOfficeConfig(false)
      },
    )

    return () => unsubscribe()
  }, [adminId])

  useEffect(() => {
    if (!location) {
      return
    }

    if (!officeConfig) {
      setDistance(null)
      setLocationState(adminId ? 'missing-settings' : 'error')
      setStatus(adminId ? OFFICE_SETTINGS_MISSING_MESSAGE : ADMIN_LINK_MISSING_MESSAGE)
      return
    }

    const officeEvaluation = evaluateOfficeRange(location, officeConfig)
    setDistance(officeEvaluation.distance)
    setLocationState(officeEvaluation.insideRange ? 'inside' : 'outside')
    setStatus(
      officeEvaluation.insideRange
        ? 'Inside office range. You can tap in or tap out now.'
        : `Outside the ${officeConfig.radius}m office radius. Move closer to continue.`,
    )
  }, [adminId, location, officeConfig])

  useEffect(() => {
    let active = true
    let watchId = null

    const handleLocationError = (error) => {
      if (!active) {
        return
      }

      const message =
        error instanceof Error &&
        error.message === 'Geolocation is not supported by this browser.'
          ? error.message
          : getGeolocationErrorMessage(error)

      setLocation(null)
      setDistance(null)
      setLocationState('error')
      setStatus(message)
      setIsFetchingLocation(false)
    }

    const initializeLocation = async () => {
      setIsFetchingLocation(true)
      setStatus('Fetching location...')

      try {
        const position = await fetchCurrentPosition()
        if (!active) {
          return
        }

        syncLocationState(position.coords)
      } catch (error) {
        handleLocationError(error)
      } finally {
        if (active) {
          setIsFetchingLocation(false)
        }
      }

      if (!navigator.geolocation || !active) {
        return
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!active) {
            return
          }

          syncLocationState(position.coords)
        },
        (error) => {
          handleLocationError(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 10000,
        },
      )
    }

    initializeLocation()

    return () => {
      active = false
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [syncLocationState])

  const refreshLocation = async () => {
    setIsFetchingLocation(true)
    setStatus('Fetching location...')

    try {
      const position = await fetchCurrentPosition()
      syncLocationState(position.coords)
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message === 'Geolocation is not supported by this browser.'
          ? error.message
          : getGeolocationErrorMessage(error)

      setLocationState('error')
      setStatus(message)
      throw error
    } finally {
      setIsFetchingLocation(false)
    }
  }

  const handleTap = async (type) => {
    if (!auth.currentUser) {
      setLocationState('error')
      setStatus('Please log in again before marking attendance.')
      return
    }

    setIsSavingAttendance(true)

    try {
      let resolvedAdminId = adminId
      let resolvedAdminEmail = normalizeEmail(adminEmail)
      let resolvedOfficeConfig = officeConfig

      if (!resolvedAdminId || !resolvedAdminEmail) {
        const profileSnapshot = await get(
          databaseRef(db, `users/${auth.currentUser.uid}`),
        )

        resolvedAdminId = profileSnapshot.val()?.adminId || null
        resolvedAdminEmail = normalizeEmail(profileSnapshot.val()?.adminEmail || '')

        if (!resolvedAdminEmail && resolvedAdminId) {
          const adminSnapshot = await get(databaseRef(db, `users/${resolvedAdminId}`))
          resolvedAdminEmail = normalizeEmail(
            adminSnapshot.val()?.email || adminSnapshot.val()?.adminEmail || '',
          )
        }

        setAdminId(resolvedAdminId)
        setAdminEmail(resolvedAdminEmail)
      }

      if (!resolvedAdminId) {
        setLocationState('error')
        setStatus(ADMIN_LINK_MISSING_MESSAGE)
        return
      }

      if (!resolvedOfficeConfig) {
        const settingsSnapshot = await get(
          databaseRef(db, `settings/${resolvedAdminId}`),
        )
        resolvedOfficeConfig = normalizeOfficeConfig(settingsSnapshot.val())

        if (resolvedOfficeConfig) {
          setOfficeConfig(resolvedOfficeConfig)
        }
      }

      if (!resolvedOfficeConfig) {
        setLocationState('missing-settings')
        setStatus(OFFICE_SETTINGS_MISSING_MESSAGE)
        return
      }

      const currentLocation = await resolveLocationForAction(resolvedOfficeConfig)

      if (!currentLocation.insideRange) {
        setStatus('Outside the office radius, so attendance was not saved.')
        return
      }

      setStatus('Saving attendance...')

      const record = {
        adminId: resolvedAdminId,
        adminEmail: resolvedAdminEmail,
        type,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        distance: Math.round(currentLocation.distance),
        createdAt: Date.now(),
      }

      await push(databaseRef(db, `attendance/${auth.currentUser.uid}`), record)

      const typeLabel = type === 'tap_in' ? 'Tap In' : 'Tap Out'
      setLastAttendance({
        type: typeLabel,
        createdAt: record.createdAt,
        distance: record.distance,
      })
      setLocationState('inside')
      setStatus(`${typeLabel} recorded successfully inside the office radius.`)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Geolocation is not supported by this browser.'
      ) {
        setLocationState('error')
        setStatus(error.message)
      } else if (error?.code && [1, 2, 3].includes(error.code)) {
        setLocationState('error')
        setStatus(getGeolocationErrorMessage(error))
      } else {
        console.error('Failed to save GPS attendance.', error)
        setLocationState('error')
        setStatus(getDatabaseErrorMessage(error))
      }
    } finally {
      setIsSavingAttendance(false)
    }
  }

  const isBusy = isFetchingLocation || isSavingAttendance
  const canMarkAttendance =
    Boolean(adminId) && Boolean(officeConfig) && !isLoadingOfficeConfig
  const isInsideRange = locationState === 'inside'
  const statusTone =
    locationState === 'inside'
      ? 'border-emerald-200/20 bg-emerald-500/10 text-emerald-50'
      : locationState === 'outside' ||
          locationState === 'error' ||
          locationState === 'missing-settings'
        ? 'border-rose-200/20 bg-rose-500/10 text-rose-50'
        : 'border-white/12 bg-white/8 text-blue-50/80'

  return (
    <section className="glass mx-auto w-full max-w-md rounded-[30px] p-4 sm:max-w-4xl sm:rounded-[34px] sm:p-8">
      <div className="mb-6 flex flex-col gap-5 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
            Live GPS Attendance
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
            Tap only when your live location falls inside the office radius.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50/78 sm:text-base">
            The map tracks your current position in real time, shows the office
            zone from admin settings, and only allows attendance when you are
            within the configured radius.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refreshLocation().catch(() => {})}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-blue-50/80 transition duration-300 hover:scale-[1.02] hover:border-blue-200/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-5 sm:py-2.5"
        >
          {isFetchingLocation ? 'Refreshing...' : 'Refresh Location'}
        </button>
      </div>

      {officeConfig ? (
        <div className="overflow-hidden rounded-[28px] border border-white/12 bg-slate-950/18 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[30px] sm:p-3">
          <div className="relative overflow-hidden rounded-[22px] sm:rounded-[24px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-24 bg-gradient-to-b from-slate-950/25 to-transparent" />
            <MapContainer
              center={[officeConfig.lat, officeConfig.lng]}
              zoom={17}
              scrollWheelZoom
              className="h-[300px] w-full bg-slate-900 sm:h-[400px]"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[officeConfig.lat, officeConfig.lng]} icon={officeIcon}>
                <Popup>Office location</Popup>
              </Marker>
              <Circle
                center={[officeConfig.lat, officeConfig.lng]}
                radius={officeConfig.radius}
                pathOptions={{
                  color: '#60a5fa',
                  fillColor: '#60a5fa',
                  fillOpacity: 0.18,
                  weight: 2,
                }}
              />
              {location ? (
                <Marker position={[location.lat, location.lng]} icon={userIcon}>
                  <Popup>Your live location</Popup>
                </Marker>
              ) : null}
              <LiveMapViewport userPosition={location} officeLocation={officeConfig} />
            </MapContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-white/14 bg-slate-950/18 px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[30px]">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-100/65">
            Office Map
          </p>
          <p className="mt-4 text-lg font-semibold text-white">
            {isLoadingOfficeConfig
              ? 'Loading office settings...'
              : 'Office location not configured yet.'}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-blue-50/72">
            {adminId
              ? 'Ask your admin to save a latitude, longitude, and radius before attendance can be marked.'
              : 'Your employee profile still needs an admin link before office settings can load.'}
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-100/70">
            Live Coordinates
          </p>
          <div className="mt-4 space-y-3 text-sm text-blue-50/78">
            <p>
              <span className="font-medium text-white">Latitude:</span>{' '}
              {formatCoordinate(location?.lat)}
            </p>
            <p>
              <span className="font-medium text-white">Longitude:</span>{' '}
              {formatCoordinate(location?.lng)}
            </p>
            <p>
              <span className="font-medium text-white">Accuracy:</span>{' '}
              {typeof location?.accuracy === 'number'
                ? `${Math.round(location.accuracy)} m`
                : '--'}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-100/70">
            Distance From Office
          </p>
          <div className="mt-4 space-y-3 text-sm text-blue-50/78">
            <p>
              <span className="font-medium text-white">Distance:</span>{' '}
              {formatDistance(distance)}
            </p>
            <p>
              <span className="font-medium text-white">Radius:</span>{' '}
              {officeConfig ? `${officeConfig.radius} m` : '--'}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-1 sm:col-span-2 xl:col-span-1">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-100/70">
            Range Status
          </p>
          <div className="mt-4 space-y-3 text-sm text-blue-50/78">
            <p>
              <span className="font-medium text-white">Status:</span>{' '}
              {locationState === 'inside'
                ? 'Inside Range'
                : locationState === 'outside'
                  ? 'Outside Range'
                  : locationState === 'missing-settings'
                    ? 'Settings Missing'
                  : locationState === 'error'
                    ? 'Location Error'
                    : 'Checking'}
            </p>
            <p>
              <span className="font-medium text-white">Office:</span>{' '}
              {officeConfig
                ? `${officeConfig.lat.toFixed(4)}, ${officeConfig.lng.toFixed(4)}`
                : '--'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          className="w-full"
          onClick={() => handleTap('tap_in')}
          disabled={isBusy || !canMarkAttendance}
        >
          {isBusy ? 'Fetching location...' : 'Tap In'}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => handleTap('tap_out')}
          disabled={isBusy || !canMarkAttendance}
        >
          {isBusy ? 'Fetching location...' : 'Tap Out'}
        </Button>
      </div>

      <div
        className={`mt-6 rounded-3xl border px-4 py-4 text-sm transition-all duration-300 ${statusTone}`}
      >
        <div className="flex items-center gap-3">
          {isBusy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          ) : (
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isInsideRange
                  ? 'bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.65)]'
                  : locationState === 'outside' ||
                      locationState === 'error' ||
                      locationState === 'missing-settings'
                    ? 'bg-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.65)]'
                    : 'bg-blue-200/80'
              }`}
            />
          )}
          <span className="transition-opacity duration-300">{status}</span>
        </div>
      </div>

      {lastAttendance ? (
        <div className="mt-4 rounded-[28px] border border-white/10 bg-slate-950/15 p-5 text-sm text-blue-50/78">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-100/70">
            Last Attendance
          </p>
          <p className="mt-3">
            <span className="font-medium text-white">Action:</span>{' '}
            {lastAttendance.type}
          </p>
          <p className="mt-2">
            <span className="font-medium text-white">Distance:</span>{' '}
            {lastAttendance.distance} m
          </p>
          <p className="mt-2">
            <span className="font-medium text-white">Time:</span>{' '}
            {formatAttendanceTime(lastAttendance.createdAt)}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export default UploadCard
