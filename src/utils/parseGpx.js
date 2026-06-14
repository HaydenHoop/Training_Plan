// ─── GPX Parser ──────────────────────────────────────────────────────────────
// Parses a GPX file string in the browser using DOMParser.
// Returns: { date, mileage, avgHeartRate, avgPace, elevationGain, durationMin, name }

const R = 6371000 // Earth radius in meters

function haversineMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function metersToMiles(m) { return +(m / 1609.344).toFixed(2) }

function secondsToPace(s) {
  const min = Math.floor(s / 60)
  return `${min}:${String(Math.round(s % 60)).padStart(2,'0')}`
}

export function parseGpxString(xmlStr) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid GPX file')

  // Activity name
  const nameEl = doc.querySelector('trk > name') || doc.querySelector('name')
  const name = nameEl?.textContent?.trim() || 'Run'

  // Collect all track points
  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  if (trkpts.length < 2) throw new Error('GPX has no track points')

  let totalMeters = 0
  let elevGainMeters = 0
  const hrValues = []
  let prevLat = null, prevLon = null, prevEle = null

  const times = []

  for (const pt of trkpts) {
    const lat = parseFloat(pt.getAttribute('lat'))
    const lon = parseFloat(pt.getAttribute('lon'))
    const eleEl = pt.querySelector('ele')
    const ele = eleEl ? parseFloat(eleEl.textContent) : null
    const timeEl = pt.querySelector('time')
    if (timeEl) times.push(new Date(timeEl.textContent))

    // HR — try both Garmin and Coros namespace styles
    const hrEl = pt.querySelector('hr') ||
                 pt.querySelector('HeartRateBpm Value') ||
                 pt.querySelector('TrackPointExtension hr')
    if (hrEl) {
      const hr = parseInt(hrEl.textContent)
      if (hr > 40 && hr < 230) hrValues.push(hr)
    }

    if (prevLat !== null) {
      totalMeters += haversineMeters(prevLat, prevLon, lat, lon)
    }

    if (ele !== null && prevEle !== null) {
      const diff = ele - prevEle
      if (diff > 0) elevGainMeters += diff
    }

    prevLat = lat; prevLon = lon; prevEle = ele
  }

  // Date from first timestamp
  const startTime = times[0] || null
  const endTime = times[times.length - 1] || null
  const date = startTime ? startTime.toISOString().split('T')[0] : null

  // Duration in seconds
  const durationSec = startTime && endTime ? (endTime - startTime) / 1000 : null

  // Average pace (sec/mile)
  const totalMiles = metersToMiles(totalMeters)
  const avgPaceSec = durationSec && totalMiles > 0 ? durationSec / totalMiles : null

  // Average HR
  const avgHR = hrValues.length > 0
    ? Math.round(hrValues.reduce((a,b) => a+b, 0) / hrValues.length)
    : null

  // Elevation gain in feet
  const elevGainFt = Math.round(elevGainMeters * 3.28084)

  return {
    name,
    date,
    mileage: totalMiles,
    avgHeartRate: avgHR,
    avgPace: avgPaceSec ? secondsToPace(avgPaceSec) : null,
    elevationGain: elevGainFt,
    durationMin: durationSec ? Math.round(durationSec / 60) : null,
  }
}

// Find which training week a date belongs to
export function matchRunToWeek(date, weeks) {
  return weeks.find(w => {
    const start = new Date(w.startDate)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    const d = new Date(date)
    return d >= start && d <= end
  }) || null
}
