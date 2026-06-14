// ─── Strava API helpers ──────────────────────────────────────────────────────
// OAuth flow uses the Vite dev server middleware (/api/strava/token) to keep
// the client_secret server-side only.

export const STRAVA_SCOPES = 'read,activity:read_all'

export function getStravaAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

// Exchange auth code for tokens via the Vite middleware (keeps secret server-side)
export async function exchangeStravaCode(code) {
  const res = await fetch('/api/strava/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

// Refresh an expired token
export async function refreshStravaToken(refreshToken) {
  const res = await fetch('/api/strava/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json()
}

// Fetch all activities after a given epoch timestamp
export async function fetchStravaActivities(accessToken, afterEpoch = 0, perPage = 100) {
  const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=${perPage}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json()
}

// Convert meters to miles
const metersToMiles = (m) => +(m / 1609.344).toFixed(2)
// Convert m/s to min/mile pace string
const mpsToMilePace = (mps) => {
  if (!mps || mps === 0) return null
  const secsPerMile = 1609.344 / mps
  const min = Math.floor(secsPerMile / 60)
  const sec = Math.round(secsPerMile % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}
// Convert meters to feet
const metersToFeet = (m) => Math.round(m * 3.28084)

/**
 * Map a Strava activity object to the format used by trainingStore.updateDay
 */
export function stravaActivityToDay(activity) {
  return {
    date: activity.start_date_local.split('T')[0],
    mileage: metersToMiles(activity.distance),
    avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    avgPace: mpsToMilePace(activity.average_speed),
    elevationGain: activity.total_elevation_gain ? metersToFeet(activity.total_elevation_gain) : 0,
    completed: true,
    stravaId: activity.id,
    stravaName: activity.name,
  }
}

/**
 * Given a list of Strava activities and existing weeks, return an array of
 * { weekId, date, fields } update instructions.
 */
export function matchActivitiesToWeeks(activities, weeks) {
  const updates = []
  const runTypes = ['Run', 'TrailRun', 'VirtualRun', 'Treadmill']

  for (const act of activities) {
    if (!runTypes.includes(act.sport_type) && !runTypes.includes(act.type)) continue
    const dateStr = act.start_date_local.split('T')[0]
    const week = weeks.find(w => {
      const start = new Date(w.startDate)
      const end = new Date(start); end.setDate(end.getDate() + 6)
      const d = new Date(dateStr)
      return d >= start && d <= end
    })
    if (!week) continue
    updates.push({ weekId: week.id, date: dateStr, fields: stravaActivityToDay(act) })
  }
  return updates
}
