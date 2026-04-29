const normalizeEmail = (value = '') => value.trim().toLowerCase()

const collectAdminIdsForEmail = (users, adminEmail, currentAdminId) => {
  const normalizedAdminEmail = normalizeEmail(adminEmail)
  const relatedAdminIds = new Set()

  if (currentAdminId) {
    relatedAdminIds.add(currentAdminId)
  }

  Object.entries(users || {}).forEach(([uid, profile]) => {
    if (!profile?.isAdmin) {
      return
    }

    const profileEmail = normalizeEmail(profile.email || profile.adminEmail || '')
    if (profileEmail === normalizedAdminEmail) {
      relatedAdminIds.add(uid)
    }
  })

  return {
    normalizedAdminEmail,
    relatedAdminIds,
  }
}

const belongsToAdmin = (profile, relatedAdminIds, normalizedAdminEmail) => {
  if (!profile || profile.isAdmin) {
    return false
  }

  return (
    relatedAdminIds.has(profile.adminId) ||
    normalizeEmail(profile.adminEmail || '') === normalizedAdminEmail
  )
}

const attendanceBelongsToAdmin = (
  record,
  relatedAdminIds,
  normalizedAdminEmail,
) => {
  if (!record) {
    return false
  }

  return (
    relatedAdminIds.has(record.adminId) ||
    normalizeEmail(record.adminEmail || '') === normalizedAdminEmail
  )
}

const findAdminProfileByEmailInUsers = (users, adminEmail) => {
  const normalizedAdminEmail = normalizeEmail(adminEmail)
  const matchingEntry = Object.entries(users || {}).find(([, profile]) => {
    if (!profile?.isAdmin) {
      return false
    }

    return (
      normalizeEmail(profile.email || profile.adminEmail || '') ===
      normalizedAdminEmail
    )
  })

  if (!matchingEntry) {
    return null
  }

  const [uid, profile] = matchingEntry
  return {
    uid,
    profile,
  }
}

export {
  attendanceBelongsToAdmin,
  belongsToAdmin,
  collectAdminIdsForEmail,
  findAdminProfileByEmailInUsers,
  normalizeEmail,
}
