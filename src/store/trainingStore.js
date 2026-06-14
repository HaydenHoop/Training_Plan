import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

// ── Supabase sync helpers ────────────────────────────────────────────────────
async function syncRun(userId, run) {
  if (!supabase || !userId) return
  await supabase.from('runs').upsert({
    user_id: userId, id: run.id, date: run.date,
    mileage: run.mileage, duration_min: run.durationMin,
    avg_pace: run.avgPace, avg_hr: run.avgHR, max_hr: run.maxHR,
    avg_cadence: run.avgCadence, elev_gain_ft: run.elevGainFt,
    tss: run.tss, trimp: run.trimp, sport: run.sport,
    filename: run.filename, vo2max: run.vo2max,
    hr_zones: run.hrZones, laps: run.laps,
  })
}
async function syncWeek(userId, week) {
  if (!supabase || !userId) return
  await supabase.from('weeks').upsert({
    user_id: userId, id: week.id, start_date: week.startDate,
    planned_mileage: week.plannedMileage, actual_mileage: week.actualMileage,
    days: week.days,
  })
}
async function syncPR(userId, event, time, date) {
  if (!supabase || !userId) return
  await supabase.from('personal_records').upsert({
    user_id: userId, event, time_str: time, date_set: date || null,
  })
}
async function syncProfile(userId, profile) {
  if (!supabase || !userId) return
  await supabase.from('athlete_profiles').upsert({
    user_id: userId,
    vo_max: profile.voMax ? parseFloat(profile.voMax) : null,
    name: profile.name, school: profile.school, sport: profile.sport,
  })
}


// ─── CTL / ATL helpers ────────────────────────────────────────────────────────
function ewmaDecay(tau) { return Math.exp(-1 / tau) }

export function computeFitnessCurve(runs) {
  if (!runs || runs.length === 0) return []
  const dailyLoad = {}
  for (const run of runs) {
    if (!run.date) continue
    dailyLoad[run.date] = (dailyLoad[run.date] || 0) + (run.trimp || 0)
  }
  if (Object.keys(dailyLoad).length === 0) return []
  const dates = Object.keys(dailyLoad).sort()
  const start = new Date(dates[0])
  const end   = new Date()
  const ctl_k = ewmaDecay(42)
  const atl_k = ewmaDecay(7)
  let ctl = 0, atl = 0
  const curve = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const load = dailyLoad[dateStr] || 0
    ctl = ctl * ctl_k + load * (1 - ctl_k)
    atl = atl * atl_k + load * (1 - atl_k)
    curve.push({ date: dateStr, ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +(ctl - atl).toFixed(1), load })
  }
  return curve
}

const useTrainingStore = create(
  persist(
    (set, get) => ({
      // ── Auth ─────────────────────────────────────────────────────────────
      supabaseUserId: null,
      setSupabaseUserId: (id) => set({ supabaseUserId: id }),

      // ── Planned weeks ─────────────────────────────────────────────────────
      weeks: [],

      // ── Actual runs (from FIT/GPX imports) ────────────────────────────────
      runs: [],

      // ── Personal Records ──────────────────────────────────────────────────
      prs: {
        '400m':       { time: '', date: '' },
        '1mi':        { time: '', date: '' },
        '2mi':        { time: '', date: '' },
        '5k':         { time: '', date: '' },
        '8k':         { time: '', date: '' },
        '10k':        { time: '', date: '' },
        halfMarathon: { time: '', date: '' },
      },

      // ── Athlete profile ───────────────────────────────────────────────────
      profile: { voMax: '' },

      // ── UI state ──────────────────────────────────────────────────────────
      stravaToken:   null,
      stravaAthlete: null,
      activePage:    'dashboard',

      // ── Actions ───────────────────────────────────────────────────────────
      setActivePage:  (page) => set({ activePage: page }),
      setStravaAuth:  (token, athlete) => set({ stravaToken: token, stravaAthlete: athlete }),
      clearStravaAuth: () => set({ stravaToken: null, stravaAthlete: null }),

      setPR: (event, field, val) => set(s => {
        const updated = { ...s.prs[event], [field]: val }
        if (s.supabaseUserId) syncPR(s.supabaseUserId, event, updated.time, updated.date)
        return { prs: { ...s.prs, [event]: updated } }
      }),
      setProfile: (field, val) => set(s => {
        const updated = { ...s.profile, [field]: val }
        if (s.supabaseUserId) syncProfile(s.supabaseUserId, updated)
        return { profile: updated }
      }),

      addWeek: (week, userId) => set((s) => {
        const idx = s.weeks.findIndex(w => w.id === week.id)
        if (idx >= 0) {
          const u = [...s.weeks]; u[idx] = { ...u[idx], ...week }; return { weeks: u }
        }
        const uid = userId || s.supabaseUserId
        if (uid) syncWeek(uid, week)
        return { weeks: [...s.weeks, week].sort((a, b) => a.startDate.localeCompare(b.startDate)) }
      }),

      updateDay: (weekId, dateStr, fields) => set((s) => ({
        weeks: s.weeks.map(w => {
          if (w.id !== weekId) return w
          const days = w.days.map(d => d.date === dateStr ? { ...d, ...fields } : d)
          return { ...w, days, actualMileage: +days.reduce((s, d) => s + (d.mileage || 0), 0).toFixed(1) }
        })
      })),

      addRuns: (newRuns, userId) => set((s) => {
        const existingIds = new Set(s.runs.map(r => r.id))
        const toAdd = newRuns.filter(r => r && r.id && !existingIds.has(r.id))
        if (toAdd.length === 0) return {}
        const uid = userId || s.supabaseUserId
        if (uid) toAdd.forEach(r => syncRun(uid, r))
        return { runs: [...s.runs, ...toAdd].sort((a, b) => a.date.localeCompare(b.date)) }
      }),

      deleteRun:    (runId) => set((s) => ({ runs: s.runs.filter(r => r.id !== runId) })),
      clearAllRuns: () => set({ runs: [] }),

      // ── Queries ───────────────────────────────────────────────────────────
      getWeeksInRange: (months) => {
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() - months)
        return get().weeks.filter(w => new Date(w.startDate) >= cutoff)
      },

      getCurrentWeek: () => {
        const { weeks } = get()
        const t = new Date().toISOString().split('T')[0]
        return weeks.find(w => {
          const s = new Date(w.startDate)
          const e = new Date(s); e.setDate(e.getDate() + 6)
          return new Date(t) >= s && new Date(t) <= e
        }) || null
      },

      getRunsInRange: (startDate, endDate) =>
        get().runs.filter(r => r.date >= startDate && r.date <= endDate),

      getRunByDate: (dateStr) => {
        const dayRuns = get().runs.filter(r => r.date === dateStr)
        return dayRuns[dayRuns.length - 1] || null
      },

      getRunsByDate: (dateStr) => get().runs.filter(r => r.date === dateStr),

      getFitnessCurve: () => computeFitnessCurve(get().runs),

      getLifetimeStats: () => {
        const { runs } = get()
        if (runs.length === 0) return null
        const totalMiles  = +runs.reduce((s, r) => s + (r.mileage || 0), 0).toFixed(1)
        const totalHours  = +(runs.reduce((s, r) => s + (r.durationMin || 0), 0) / 60).toFixed(1)
        const totalElevFt = runs.reduce((s, r) => s + (r.elevGainFt || 0), 0)
        const hrRuns      = runs.filter(r => r.avgHR)
        const avgHR       = hrRuns.length ? Math.round(hrRuns.reduce((s, r) => s + r.avgHR, 0) / hrRuns.length) : null
        const fastRuns    = runs.filter(r => r.avgPace && r.mileage >= 1)
        let bestPace = null
        if (fastRuns.length) {
          fastRuns.sort((a, b) => a.avgPace.localeCompare(b.avgPace))
          bestPace = fastRuns[0].avgPace
        }
        const longestRun = runs.reduce((mx, r) => r.mileage > (mx?.mileage || 0) ? r : mx, null)
        const vo2Runs    = runs.filter(r => r.vo2max)
        const latestVo2  = vo2Runs.length ? vo2Runs[vo2Runs.length - 1].vo2max : null
        return {
          totalRuns: runs.length, totalMiles, totalHours, totalElevFt,
          avgHR, bestPace, longestRun, latestVo2,
          firstRunDate: runs[0]?.date,
          lastRunDate:  runs[runs.length - 1]?.date,
        }
      },
    }),
    {
      name: 'xc-training-store',
      version: 4,
      migrate: (persisted, version) => {
        if (version < 3) return { ...persisted, runs: [], prs: {}, profile: {} }
        if (version < 4) return {
          ...persisted,
          prs: persisted.prs || {
            '400m': { time:'', date:'' }, '1mi': { time:'', date:'' },
            '2mi':  { time:'', date:'' }, '5k':  { time:'', date:'' },
            '8k':   { time:'', date:'' }, '10k': { time:'', date:'' },
            halfMarathon: { time:'', date:'' },
          },
          profile: persisted.profile || { voMax: '' },
        }
        return persisted
      },
    }
  )
)

export default useTrainingStore
