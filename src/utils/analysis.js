// ─── Training Analysis Engine ────────────────────────────────────────────────
// Uses planned weeks[] for structure + imported runs[] as source of truth for mileage.

// ── Utility ──────────────────────────────────────────────────────────────────
export function paceToSeconds(paceStr) {
  if (!paceStr) return null
  const [min, sec] = paceStr.split(':').map(Number)
  return min * 60 + sec
}
export function secondsToPace(s) {
  if (!s) return '—'
  const min = Math.floor(s / 60); const sec = Math.round(s % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}
export function avgPace(days) {
  const paces = days.filter(d => d.avgPace).map(d => paceToSeconds(d.avgPace))
  if (!paces.length) return null
  return secondsToPace(paces.reduce((a, b) => a + b, 0) / paces.length)
}

// Build week→mileage map from FIT runs (Monday-keyed)
function buildFitWeekMap(runs) {
  const map = {}
  for (const r of runs) {
    if (!r.date || !r.mileage) continue
    const d = new Date(r.date + 'T12:00:00')
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    const key = d.toISOString().split('T')[0]
    map[key] = +((map[key] || 0) + r.mileage).toFixed(2)
  }
  return map
}

export function computeStreaks(weeks, fitWeekMap = {}) {
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate))
  let temp = 0, longest = 0
  for (const w of sorted) {
    const actual = fitWeekMap[w.startDate] ?? w.actualMileage ?? 0
    if (actual >= w.plannedMileage * 0.85) { temp++; longest = Math.max(longest, temp) }
    else temp = 0
  }
  const last = sorted.slice(-1)[0]
  const lastActual = last ? (fitWeekMap[last.startDate] ?? last.actualMileage ?? 0) : 0
  const current = last && lastActual >= last.plannedMileage * 0.85 ? temp : 0
  return { current, longest }
}

// ── Main analysis ─────────────────────────────────────────────────────────────
export function analyzeTraining(weeks, runs = []) {
  const insights = []
  const fitWeekMap = buildFitWeekMap(runs)

  // ── Always-on: runs this week ─────────────────────────────────────────────
  if (runs.length > 0) {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today); monday.setDate(today.getDate() + diff); monday.setHours(0,0,0,0)
    const mondayStr = monday.toISOString().split('T')[0]
    const sundayStr = new Date(monday.getTime() + 6 * 86400000).toISOString().split('T')[0]
    const thisWeekRuns = runs.filter(r => r.date >= mondayStr && r.date <= sundayStr)
    const thisWeekMiles = +thisWeekRuns.reduce((s, r) => s + (r.mileage || 0), 0).toFixed(1)
    const totalRuns = thisWeekRuns.length

    if (totalRuns > 0) {
      const hrRuns = thisWeekRuns.filter(r => r.avgHR > 0)
      const avgHR = hrRuns.length ? Math.round(hrRuns.reduce((s, r) => s + r.avgHR, 0) / hrRuns.length) : null
      const hrStr = avgHR ? ` at avg ${avgHR} bpm` : ''
      insights.push({
        type: 'info',
        title: `${totalRuns} Run${totalRuns > 1 ? 's' : ''} This Week — ${thisWeekMiles} mi`,
        body: `You've logged ${thisWeekMiles} miles across ${totalRuns} run${totalRuns > 1 ? 's' : ''}${hrStr} so far this week.`,
        severity: 'low',
      })
    }
  }

  // ── Always-on: pace trend ─────────────────────────────────────────────────
  if (runs.length >= 6) {
    const paceRuns = runs.filter(r => r.avgPace && r.mileage >= 1).slice(-20)
    if (paceRuns.length >= 6) {
      const recent = paceRuns.slice(-3)
      const older  = paceRuns.slice(-6, -3)
      const recentSec = recent.reduce((s, r) => s + paceToSeconds(r.avgPace), 0) / recent.length
      const olderSec  = older.reduce((s, r)  => s + paceToSeconds(r.avgPace), 0) / older.length
      const deltaSec  = olderSec - recentSec  // positive = faster recently
      if (Math.abs(deltaSec) >= 8) {
        const faster = deltaSec > 0
        insights.push({
          type: faster ? 'positive' : 'info',
          title: faster ? 'Pace Trending Faster' : 'Pace Trending Slower',
          body: faster
            ? `Your last 3 runs average ${secondsToPace(recentSec)}/mi — about ${Math.round(deltaSec)}s/mi faster than the prior 3. Fitness is building.`
            : `Your last 3 runs average ${secondsToPace(recentSec)}/mi — about ${Math.round(-deltaSec)}s/mi slower than the prior 3. Could be fatigue or intentional easy work.`,
          severity: 'low',
        })
      }
    }
  }

  if (!weeks || weeks.length === 0) return insights

  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const last4  = sorted.slice(-4)
  const last   = sorted[sorted.length - 1]
  const prev   = sorted[sorted.length - 2]

  // Effective actual mileage using FIT data first
  const actual = (w) => fitWeekMap[w?.startDate] ?? w?.actualMileage ?? 0

  // ── Mileage spike ─────────────────────────────────────────────────────────
  if (prev && actual(last) > 0 && actual(prev) > 0) {
    const pct = ((actual(last) - actual(prev)) / actual(prev)) * 100
    if (pct > 15) {
      insights.push({
        type: 'warning',
        title: 'Mileage Spike Detected',
        body: `You jumped ${pct.toFixed(0)}% week-over-week (${actual(prev).toFixed(1)}→${actual(last).toFixed(1)} mi). The 10% rule keeps injury risk low — consider whether the jump was intentional.`,
        severity: pct > 25 ? 'high' : 'medium',
      })
    } else if (pct < -20) {
      insights.push({
        type: 'positive',
        title: 'Recovery Week',
        body: `Mileage dropped ${Math.abs(pct).toFixed(0)}% from last week (${actual(prev).toFixed(1)}→${actual(last).toFixed(1)} mi). Good discipline on the down week — legs will be fresher for the next build.`,
        severity: 'low',
      })
    }
  }

  // ── 3-week rolling avg vs prior block ────────────────────────────────────
  const last3  = sorted.slice(-3).filter(w => actual(w) > 0)
  const prior3 = sorted.slice(-6, -3).filter(w => actual(w) > 0)
  if (last3.length >= 2 && prior3.length > 0) {
    const avg3     = last3.reduce((s, w) => s + actual(w), 0) / last3.length
    const priorAvg = prior3.reduce((s, w) => s + actual(w), 0) / prior3.length
    if (avg3 > priorAvg * 1.12) {
      insights.push({
        type: 'warning',
        title: 'Sustained High Load',
        body: `3-week avg of ${avg3.toFixed(0)} mi/wk is ${(((avg3/priorAvg)-1)*100).toFixed(0)}% above the prior block (${priorAvg.toFixed(0)} mi/wk). A down week soon will let adaptations consolidate before your next build.`,
        severity: 'medium',
      })
    }
  }

  // ── Plan vs actual ────────────────────────────────────────────────────────
  if (last?.plannedMileage > 0 && actual(last) > 0) {
    const diff = actual(last) - last.plannedMileage
    const pct  = (diff / last.plannedMileage) * 100
    if (Math.abs(pct) > 15) {
      insights.push({
        type: pct > 0 ? 'info' : 'warning',
        title: pct > 0 ? 'Overreaching Plan' : 'Falling Short of Plan',
        body: pct > 0
          ? `Ran ${Math.abs(diff).toFixed(1)} mi more than planned (+${pct.toFixed(0)}%). Watch for compounding fatigue if this is a trend.`
          : `Ran ${Math.abs(diff).toFixed(1)} mi less than planned (${pct.toFixed(0)}%). If unintentional, check for early fatigue signs or schedule conflicts.`,
        severity: Math.abs(pct) > 30 ? 'high' : 'medium',
      })
    } else if (Math.abs(pct) <= 10 && actual(last) > 0) {
      insights.push({
        type: 'positive',
        title: 'On Track with Plan',
        body: `Last week's actual (${actual(last).toFixed(1)} mi) was within ${Math.abs(pct).toFixed(0)}% of planned (${last.plannedMileage} mi). Executing the plan accurately is a key predictor of progress.`,
        severity: 'low',
      })
    }
  }

  // ── Consistency streak ────────────────────────────────────────────────────
  const completedWeeks = last4.filter(w => actual(w) >= w.plannedMileage * 0.85)
  if (completedWeeks.length >= 3) {
    insights.push({
      type: 'positive',
      title: `${completedWeeks.length}-Week Consistency Streak`,
      body: `Hit ≥85% of planned mileage for ${completedWeeks.length} straight weeks${completedWeeks.length === 4 ? ' — a full month of consistent execution' : ''}. Consistency compounds: each completed week builds on the last.`,
      severity: 'low',
    })
  }

  // ── FIT-data insights ──────────────────────────────────────────────────────
  if (runs.length > 0) {
    const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 14)
    const cutStr   = cutoff14.toISOString().split('T')[0]
    const recentRuns = runs.filter(r => r.date >= cutStr)

    // HR zone balance
    const zoneRuns = recentRuns.filter(r => r.hrZones?.totalSecs > 0)
    if (zoneRuns.length >= 2) {
      const totalSecs = zoneRuns.reduce((s, r) => s + r.hrZones.totalSecs, 0)
      const highSecs  = zoneRuns.reduce((s, r) => s + (r.hrZones.z4 || 0) + (r.hrZones.z5 || 0), 0)
      const z2Secs    = zoneRuns.reduce((s, r) => s + (r.hrZones.z2 || 0), 0)
      const highPct   = (highSecs / totalSecs) * 100
      const z2Pct     = (z2Secs  / totalSecs) * 100
      if (highPct > 30) {
        insights.push({
          type: 'warning',
          title: 'High-Intensity Volume Too High',
          body: `${highPct.toFixed(0)}% of recent running time is Z4/Z5. Elite XC programs target 75–85% easy/aerobic work. Excess intensity raises injury risk and blunts aerobic adaptation.`,
          severity: 'medium',
        })
      } else {
        insights.push({
          type: z2Pct >= 60 ? 'positive' : 'info',
          title: `Zone Distribution: ${highPct.toFixed(0)}% High Intensity`,
          body: `${highPct.toFixed(0)}% Z4/Z5, ~${z2Pct.toFixed(0)}% Z2 in the last 2 weeks. ${z2Pct >= 60 ? 'Solid aerobic base emphasis — polarized distribution is working.' : 'Aim for 60%+ in Z2 to maximize aerobic adaptation for XC.'}`,
          severity: 'low',
        })
      }
    }

    // Cadence
    const cadRuns = recentRuns.filter(r => r.avgCadence > 100)
    if (cadRuns.length >= 2 && runs.length >= 10) {
      const recentCad = cadRuns.reduce((s, r) => s + r.avgCadence, 0) / cadRuns.length
      const baselineRuns = runs.slice(-20).filter(r => r.avgCadence > 100)
      if (baselineRuns.length >= 4) {
        const baseCad = baselineRuns.reduce((s, r) => s + r.avgCadence, 0) / baselineRuns.length
        const delta = recentCad - baseCad
        if (delta < -5) {
          insights.push({
            type: 'warning',
            title: 'Cadence Drop — Possible Fatigue',
            body: `Recent avg cadence ${Math.round(recentCad)} spm vs baseline ${Math.round(baseCad)} spm (${Math.round(delta)} spm lower). Reduced cadence often reflects neuromuscular fatigue — prioritize sleep and easy effort.`,
            severity: 'medium',
          })
        } else if (delta > 3) {
          insights.push({
            type: 'positive',
            title: 'Cadence Improving',
            body: `Recent avg cadence ${Math.round(recentCad)} spm vs baseline ${Math.round(baseCad)} spm. Higher cadence typically means better running economy and reduced ground impact.`,
            severity: 'low',
          })
        }
      }
    }

    // ATL/CTL ratio
    if (runs.length >= 10) {
      const s7  = new Date(); s7.setDate(s7.getDate() - 7);  const s7str  = s7.toISOString().split('T')[0]
      const s42 = new Date(); s42.setDate(s42.getDate() - 42); const s42str = s42.toISOString().split('T')[0]
      const atl = runs.filter(r => r.date >= s7str).reduce((s, r) => s + (r.trimp || 0), 0) / 7
      const ctl = runs.filter(r => r.date >= s42str).reduce((s, r) => s + (r.trimp || 0), 0) / 42
      if (ctl > 0) {
        const ratio = atl / ctl
        if (ratio > 1.5) {
          insights.push({
            type: 'warning',
            title: 'Acute Fatigue Spike',
            body: `7-day training load is ${(ratio * 100 - 100).toFixed(0)}% above your 42-day fitness baseline. High ATL:CTL ratio — consider a lighter day or two to prevent overreaching.`,
            severity: 'high',
          })
        } else if (ratio < 0.5 && ctl > 15) {
          insights.push({
            type: 'info',
            title: 'Load Below Baseline',
            body: `This week's load is ${(ratio * 100).toFixed(0)}% of your normal training baseline. Fine for a taper or rest week, but if unplanned, watch for accumulated fatigue.`,
            severity: 'low',
          })
        } else if (ratio >= 0.8 && ratio <= 1.2 && ctl > 10) {
          insights.push({
            type: 'positive',
            title: 'Load Well-Balanced',
            body: `Current training load is within 20% of your 42-day baseline — the sweet spot for progressive adaptation without overreaching. ATL:CTL ratio: ${ratio.toFixed(2)}.`,
            severity: 'low',
          })
        }
      }
    }

    // Longest run flag
    if (runs.length >= 3) {
      const sorted30 = runs.filter(r => {
        const cut = new Date(); cut.setDate(cut.getDate() - 30)
        return r.date >= cut.toISOString().split('T')[0]
      })
      const longest = sorted30.reduce((mx, r) => r.mileage > (mx?.mileage || 0) ? r : mx, null)
      if (longest && longest.mileage >= 8) {
        insights.push({
          type: 'info',
          title: `Longest Recent Run: ${longest.mileage.toFixed(1)} mi`,
          body: `Your longest run in the last 30 days was ${longest.mileage.toFixed(1)} miles on ${longest.date}. Long runs build the aerobic base that XC racing demands.`,
          severity: 'low',
        })
      }
    }
  }

  return insights.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
}
