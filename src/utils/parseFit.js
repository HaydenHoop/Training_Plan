// ─── FIT file parser utility ──────────────────────────────────────────────────
// Uses fit-file-parser + JSZip for browser-side .fit/.zip processing.
// Returns lightweight run summary objects (no per-second records) to keep
// localStorage manageable even for years of data.

import FitParser from 'fit-file-parser'

const METERS_TO_MILES = 1 / 1609.344
const METERS_TO_FEET  = 3.28084

// Sports we consider "runs" — filter everything else out
const RUN_SPORTS = new Set([
  'running','trail_running','track','treadmill',
  'walk','hiking', // include hikes/walks if they want
])

// Convert m/s to "M:SS/mi" pace string
function mpsToMilePace(mps) {
  if (!mps || mps <= 0) return null
  const secsPerMile = 1609.344 / mps
  const min = Math.floor(secsPerMile / 60)
  const sec = Math.round(secsPerMile % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}

// Compute TRIMP (training impulse) — simplified Banister TRIMP
// Uses: duration_min × exp(1.92 × hrRatio) where hrRatio = (avgHR - restHR) / (maxHR - restHR)
// We use population defaults for rest/max HR if not known
function computeTrimp(durationMin, avgHR, restHR = 55, maxHR = 195) {
  if (!avgHR || !durationMin) return durationMin * 1 // fallback: just duration
  const hrRatio = Math.max(0, Math.min(1, (avgHR - restHR) / (maxHR - restHR)))
  return +(durationMin * hrRatio * Math.exp(1.92 * hrRatio)).toFixed(1)
}

// Compute HR zone time breakdown from time_in_hr_zone array
// Coros/Garmin store 5-zone array [z1, z2, z3, z4, z5] in seconds
function parseHrZones(timeInHrZone) {
  if (!Array.isArray(timeInHrZone) || timeInHrZone.length === 0) return null
  const zones = timeInHrZone.slice(0, 5).map(s => Math.round(s || 0))
  const total = zones.reduce((a, b) => a + b, 0) || 1
  return {
    z1: zones[0] || 0,
    z2: zones[1] || 0,
    z3: zones[2] || 0,
    z4: zones[3] || 0,
    z5: zones[4] || 0,
    totalSecs: total,
    // Percentages
    z1pct: +((zones[0] || 0) / total * 100).toFixed(1),
    z2pct: +((zones[1] || 0) / total * 100).toFixed(1),
    z3pct: +((zones[2] || 0) / total * 100).toFixed(1),
    z4pct: +((zones[3] || 0) / total * 100).toFixed(1),
    z5pct: +((zones[4] || 0) / total * 100).toFixed(1),
  }
}

/**
 * Parse a single .fit file from an ArrayBuffer.
 * Returns a run summary object, or null if not a run.
 *
 * @param {ArrayBuffer} buffer
 * @param {string} filename
 * @returns {Promise<Object|null>}
 */
export function parseFitBuffer(buffer, filename) {
  return new Promise((resolve) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',   // we convert manually
      lengthUnit: 'm',     // we convert manually
      temperatureUnit: 'celsius',
      elapsedRecordField: false,
      mode: 'list',
    })

    parser.parse(buffer, (error, data) => {
      if (error || !data) {
        resolve({ error: error || 'parse failed', filename })
        return
      }

      // Find the primary session record
      const sessions = data.sessions || []
      const session = sessions[0]
      if (!session) {
        resolve({ error: 'no session found', filename })
        return
      }

      // Filter by sport
      const sport = (session.sport || '').toLowerCase()
      const subSport = (session.sub_sport || '').toLowerCase()
      const isRun = RUN_SPORTS.has(sport) || RUN_SPORTS.has(subSport) ||
                    sport.includes('run') || sport.includes('trail') || sport === 'generic'
      if (!isRun) {
        resolve(null) // Not a run — skip silently
        return
      }

      // Date from start_time
      const startTime = session.start_time
      if (!startTime) {
        resolve({ error: 'no start_time', filename })
        return
      }
      const dateObj = startTime instanceof Date ? startTime : new Date(startTime)
      const date = dateObj.toISOString().split('T')[0]

      // Distance
      const distanceM = session.total_distance || 0
      const mileage = +(distanceM * METERS_TO_MILES).toFixed(2)

      // Duration
      const elapsedSecs = session.total_elapsed_time || session.total_timer_time || 0
      const timerSecs   = session.total_timer_time || elapsedSecs
      const durationMin = +(elapsedSecs / 60).toFixed(1)
      const movingMin   = +(timerSecs / 60).toFixed(1)

      // Speed / Pace
      const avgSpeedMps = session.enhanced_avg_speed || session.avg_speed || 0
      const maxSpeedMps = session.enhanced_max_speed || session.max_speed || 0
      const avgPace  = mpsToMilePace(avgSpeedMps)
      const bestPace = mpsToMilePace(maxSpeedMps)

      // Heart rate
      const avgHR = session.avg_heart_rate || null
      const maxHR = session.max_heart_rate || null

      // Cadence — Garmin/Coros store as strides per minute (one-leg), *2 for total spm
      const avgCadence = session.avg_cadence ? session.avg_cadence * 2 : null

      // Elevation
      const elevGainM = session.total_ascent || 0
      const elevGainFt = Math.round(elevGainM * METERS_TO_FEET)

      // Training effect (stored as value*10 in raw, but parser already divides)
      const aerobicEffect  = session.total_training_effect   != null ? +(session.total_training_effect).toFixed(1)   : null
      const anaerobicEffect = session.total_anaerobic_effect != null ? +(session.total_anaerobic_effect).toFixed(1) : null

      // Training Stress Score
      const tss = session.training_stress_score != null ? +session.training_stress_score.toFixed(1) : null

      // HR Zone breakdown
      const hrZones = parseHrZones(session.time_in_hr_zone)

      // VO2max — Coros/Garmin may put this in the records or as a custom field
      // Check records for vo2max_est
      const records = data.records || []
      let vo2max = null
      for (const r of records) {
        if (r.vo2_max != null) { vo2max = r.vo2_max; break }
        if (r.estimated_vo2_max != null) { vo2max = r.estimated_vo2_max; break }
      }

      // Laps summary
      const laps = (data.laps || []).map((lap, i) => ({
        index: i + 1,
        distanceMi: +(( lap.total_distance || 0) * METERS_TO_MILES).toFixed(2),
        avgPace: mpsToMilePace(lap.enhanced_avg_speed || lap.avg_speed || 0),
        avgHR: lap.avg_heart_rate || null,
        elapsedSecs: Math.round(lap.total_elapsed_time || 0),
      }))

      // TRIMP for CTL/ATL calculation
      const trimp = computeTrimp(movingMin, avgHR)

      const run = {
        id: `${date}-${filename.replace(/[^a-z0-9]/gi, '')}`,
        date,
        filename,
        sport,
        subSport,
        mileage,
        durationMin,
        movingMin,
        avgPace,
        bestPace,
        avgHR,
        maxHR,
        avgCadence,
        elevGainFt,
        aerobicEffect,
        anaerobicEffect,
        tss,
        hrZones,
        laps,
        vo2max,
        trimp,
        importedAt: new Date().toISOString(),
      }

      resolve(run)
    })
  })
}

/**
 * Convert a parsed run to the format used by trainingStore.updateDay
 */
export function fitRunToDay(run) {
  return {
    mileage: run.mileage,
    avgHeartRate: run.avgHR,
    avgPace: run.avgPace,
    elevationGain: run.elevGainFt,
    completed: true,
    fitRunId: run.id,
  }
}
