import { addDays, format, startOfWeek, nextMonday } from 'date-fns'

const DAY_NAMES = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_INDEX = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 }

// Detect workout type from day notes + mileage.
// IMPORTANT: strides, hill sprints and drills are easy-run ADD-ONS, not workouts.
// They're stripped out before we look for real workout structure, so a day like
// "easy + 6 hill sprints" or "8 + drills + 5 strides" stays an Easy Run.
// A real workout needs rep structure (e.g. "6x3min", "8x400"), hill *repeats*,
// a tempo/threshold effort, or fartlek.
function inferWorkoutType(dayName, mileage, notes, workoutDesc) {
  const allText = `${notes} ${workoutDesc}`.toLowerCase()
  if (mileage === 0) return 'Rest'

  // Remove easy-run add-ons (strides / hill sprints / drills) first.
  const core = allText
    .replace(/\d+\s*(?:x|×)\s*\d+\s*m?\s*(?:strides?|hill\s*sprints?)/g, ' ') // "6x100m strides"
    .replace(/\d+\s*(?:x|×)?\s*strides?/g, ' ')                              // "5 strides", "5x strides"
    .replace(/\d+\s*hill\s*sprints?/g, ' ')                                  // "6 hill sprints"
    .replace(/\bstrides?\b/g, ' ')
    .replace(/\bhill\s*sprints?\b/g, ' ')
    .replace(/\bdrills?\b/g, ' ')

  // Real interval / rep workout: "6x3min", "8 x 400", "5x1000m", hill repeats, fartlek
  if (/\d+\s*(?:x|×)\s*\d+/.test(core) ||
      core.includes('hill repeat') || core.includes('fartlek') ||
      core.includes('interval') || /\brepeats?\b/.test(core))
    return 'Intervals'

  // Tempo / threshold / sustained effort at a target pace
  if (core.includes('tempo') || core.includes('threshold') || core.includes('cruise') ||
      /@\s*\d+:\d+/.test(core) || core.includes('race pace') || core.includes('goal pace'))
    return 'Tempo'

  if (dayName === 'sunday' && mileage >= 12) return 'Long Run'
  if (mileage <= 5) return 'Shakeout'
  return 'Easy Run'
}

// Parse planned pace target from lines like "Level 6  5:30-5:20"
function parsePaceTarget(text) {
  const match = text.match(/(\d+:\d+)(?:\s*[-–]\s*(\d+:\d+))?/)
  if (match) return match[2] || match[1]  // return the faster end
  return null
}

// Generate a deterministic week ID from the Monday date
function weekId(mondayStr) {
  const d = new Date(mondayStr)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Parse the pasted plan text format into a week object.
 *
 * Expected format (loosely):
 *   Monday - 8 + Drills + 5 Strides
 *   Tuesday - 10 + Core
 *   ...
 *   Your weekly miles should be around 65 miles.
 *   Your Tuesday workout: Hill repeats: ...
 *   Your Friday workout: ...
 *   Weight Routine
 *   Level 6  5:30-5:20
 *
 * @param {string} text - raw pasted text
 * @param {string} weekStartDate - ISO date string for the Monday of this week (yyyy-MM-dd)
 * @returns {{ week: object, errors: string[] }}
 */
export function parsePastedPlan(text, weekStartDate) {
  const errors = []
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)

  // ── 1. Parse day mileage lines ──────────────────────────────────────────
  const dayData = {}  // { monday: { mileage, extras } }

  for (const line of lines) {
    // Match: "Monday - 8 + Drills + 5 Strides"  or  "Monday - 8"
    const m = line.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[-–:]\s*(\d+(?:\.\d+)?)(.*)?$/i)
    if (m) {
      const day = m[1].toLowerCase()
      const mileage = parseFloat(m[2])
      const extras = (m[3] || '').trim()
      dayData[day] = { mileage, extras }
    }
  }

  if (Object.keys(dayData).length === 0) {
    errors.push('Could not find any day lines (e.g. "Monday - 8 + Drills").')
    return { week: null, errors }
  }

  // ── 2. Parse "Your X workout:" blocks ───────────────────────────────────
  const workoutDescs = {}
  const workoutRegex = /your\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+workout[:\s]+([\s\S]+?)(?=your\s+\w+\s+workout|weight routine|level\s+\d|$)/gi
  let wm
  while ((wm = workoutRegex.exec(text)) !== null) {
    const day = wm[1].toLowerCase()
    workoutDescs[day] = wm[2].replace(/\s+/g, ' ').trim()
  }

  // ── 3. Parse pace target from "Level N  X:XX-X:XX" ─────────────────────
  let paceTarget = null
  for (const line of lines) {
    if (/^level\s+\d/i.test(line)) {
      paceTarget = parsePaceTarget(line)
      break
    }
  }

  // ── 4. Parse total mileage from "Your weekly miles should be around N" ──
  let totalPlanned = 0
  const totalMatch = text.match(/around\s+(\d+)\s+miles?/i) || text.match(/(\d+)\s+miles?\s+(?:per\s+week|weekly)/i)
  if (totalMatch) totalPlanned = parseInt(totalMatch[1])

  // ── 5. Build week object ─────────────────────────────────────────────────
  const monday = new Date(weekStartDate + 'T00:00:00')
  const id = weekId(weekStartDate)

  const days = DAY_NAMES.map((dayName, i) => {
    const date = format(addDays(monday, i), 'yyyy-MM-dd')
    const info = dayData[dayName] || { mileage: 0, extras: '' }
    const workoutDesc = workoutDescs[dayName] || ''
    const type = inferWorkoutType(dayName, info.mileage, info.extras, workoutDesc)

    // Build a clean notes string from extras
    const noteParts = []
    if (info.extras) noteParts.push(info.extras)
    if (workoutDesc) noteParts.push(workoutDesc)

    // Assign pace target to interval/tempo days
    const assignedPace = (type === 'Intervals' || type === 'Tempo') && paceTarget ? paceTarget : null

    return {
      date,
      workoutType: type,
      plannedMileage: info.mileage,
      plannedPace: assignedPace || '',
      notes: noteParts.join(' | '),
      mileage: null,
      avgHeartRate: null,
      avgPace: null,
      elevationGain: null,
      completed: false,
    }
  })

  const actualTotalPlanned = days.reduce((s, d) => s + d.plannedMileage, 0)
  if (totalPlanned === 0) totalPlanned = actualTotalPlanned

  const week = {
    id,
    startDate: weekStartDate,
    plannedMileage: +actualTotalPlanned.toFixed(1),
    targetMileage: totalPlanned,
    actualMileage: 0,
    notes: paceTarget ? `Level pace target: ${paceTarget}/mi` : '',
    days,
  }

  return { week, errors }
}

// Get the ISO date of the upcoming (or current) Monday
export function getUpcomingMonday() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 1 ? 0 : (8 - day) % 7 || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() + (day === 1 ? 0 : diff))
  monday.setHours(0, 0, 0, 0)
  return format(monday, 'yyyy-MM-dd')
}

export function getCurrentMonday() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return format(monday, 'yyyy-MM-dd')
}
