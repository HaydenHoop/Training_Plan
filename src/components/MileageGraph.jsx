import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, Legend
} from 'recharts'
import { format, parseISO, subMonths } from 'date-fns'
import useTrainingStore from '../store/trainingStore'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const PERIODS = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: 'All', months: 999 },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-xs text-slate-400 mb-2 font-mono">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold text-white">{p.value?.toFixed(1)} mi</span>
        </div>
      ))}
      {payload.length === 2 && payload[0].value && payload[1].value && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-xs text-slate-400">
            Diff: <span className={`font-bold ${payload[0].value - payload[1].value > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(payload[0].value - payload[1].value > 0 ? '+' : '')}{(payload[0].value - payload[1].value).toFixed(1)} mi
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function MetricPill({ label, value, trend }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'
  return (
    <div className="glass rounded-xl px-4 py-3 border border-white/5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <TrendIcon size={14} className={`mb-1 ${trendColor}`} />
      </div>
    </div>
  )
}

/** Return the ISO date string of the Monday for any given date string */
function toWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export default function MileageGraph() {
  const { weeks, runs } = useTrainingStore()
  const [activePeriod, setActivePeriod] = useState(1) // index into PERIODS
  const [metric, setMetric] = useState('mileage') // mileage | hr | pace

  // Aggregate FIT runs into { weekStartDate → totalMiles }
  const runWeekMap = useMemo(() => {
    const map = {}
    for (const run of runs) {
      if (!run.mileage || !run.date) continue
      const key = toWeekStart(run.date)
      map[key] = +((map[key] || 0) + run.mileage).toFixed(2)
    }
    return map
  }, [runs])

  // Merged week list: union of weeks[] and runWeekMap, filtered by period
  const filteredWeeks = useMemo(() => {
    const p = PERIODS[activePeriod]
    const cutoff = p.months === 999 ? new Date(0) : subMonths(new Date(), p.months)

    const allKeys = new Set([
      ...weeks.map(w => w.startDate),
      ...Object.keys(runWeekMap),
    ])

    return [...allKeys]
      .filter(k => new Date(k) >= cutoff)
      .sort()
      .map(key => {
        const w = weeks.find(x => x.startDate === key)
        const runMiles = runWeekMap[key] || 0
        // Prefer FIT miles as actual; fall back to manually-logged actualMileage
        const actualMileage = runMiles > 0 ? +runMiles.toFixed(1) : (w?.actualMileage || 0)
        return {
          startDate: key,
          plannedMileage: w?.plannedMileage || 0,
          actualMileage,
          days: w?.days || [],
        }
      })
  }, [weeks, runWeekMap, activePeriod])

  const chartData = useMemo(() => filteredWeeks.map(w => ({
    label: format(parseISO(w.startDate), 'MMM d'),
    fullDate: w.startDate,
    planned: w.plannedMileage || null,
    actual: w.actualMileage || null,
    hr: w.days.filter(d => d.avgHeartRate).length
      ? Math.round(w.days.filter(d => d.avgHeartRate).reduce((s, d) => s + d.avgHeartRate, 0) / w.days.filter(d => d.avgHeartRate).length)
      : null,
    elevation: w.days.reduce((s, d) => s + (d.elevationGain || 0), 0),
  })), [filteredWeeks])

  const actualWeeks = filteredWeeks.filter(w => w.actualMileage > 0)
  const avgActual = actualWeeks.length ? (actualWeeks.reduce((s, w) => s + w.actualMileage, 0) / actualWeeks.length).toFixed(0) : 0
  const avgPlanned = filteredWeeks.filter(w => w.plannedMileage > 0).length
    ? (filteredWeeks.filter(w => w.plannedMileage > 0).reduce((s, w) => s + w.plannedMileage, 0) / filteredWeeks.filter(w => w.plannedMileage > 0).length).toFixed(0)
    : 0
  const peak = filteredWeeks.reduce((m, w) => Math.max(m, w.actualMileage), 0)

  const trend = actualWeeks.length >= 2
    ? actualWeeks[actualWeeks.length - 1].actualMileage - actualWeeks[0].actualMileage
    : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">Performance</p>
        <h1 className="text-3xl font-bold text-white mb-6">
          Mileage <span className="text-gradient">Graph</span>
        </h1>
      </motion.div>

      {/* Period selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-2 mb-6"
      >
        <div className="flex gap-1 glass rounded-xl p-1 border border-white/5">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setActivePeriod(i)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePeriod === i ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {activePeriod === i && (
                <motion.div
                  layoutId="period-pill"
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-blue-600/20 rounded-lg border border-cyan-500/30"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
      >
        <MetricPill label="Avg Actual / Week" value={`${avgActual} mi`} trend={trend} />
        <MetricPill label="Avg Planned / Week" value={`${avgPlanned} mi`} trend={0} />
        <MetricPill label="Peak Week" value={`${peak} mi`} trend={1} />
        <MetricPill label="Weeks Tracked" value={filteredWeeks.length} trend={0} />
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-2xl p-5 border border-white/5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Projected vs Actual Mileage</h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-slate-500 rounded-full" style={{ borderTop: '2px dashed #64748b' }} />
              <span className="text-slate-400">Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">Actual</span>
            </div>
          </div>
        </div>

        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="planned"
                name="Planned"
                stroke="#475569"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="url(#plannedGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#94a3b8', stroke: '#1e293b', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="#22d3ee"
                strokeWidth={2.5}
                fill="url(#actualGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#22d3ee', stroke: '#0d1321', strokeWidth: 2 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Weekly breakdown table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="glass rounded-2xl border border-white/5 mt-4 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Weekly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Week', 'Planned', 'Actual', 'Δ Miles', 'vs Plan'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filteredWeeks].reverse().slice(0, 12).map((w, i) => {
                const diff = w.actualMileage - w.plannedMileage
                const pct = w.plannedMileage > 0 ? (w.actualMileage / w.plannedMileage * 100).toFixed(0) : '—'
                const hasActual = w.actualMileage > 0
                return (
                  <motion.tr
                    key={w.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-white/3 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{format(parseISO(w.startDate), 'MMM d')}</td>
                    <td className="px-5 py-3 text-slate-400">{w.plannedMileage > 0 ? `${w.plannedMileage} mi` : '—'}</td>
                    <td className={`px-5 py-3 font-medium ${hasActual ? 'text-white' : 'text-slate-600'}`}>
                      {hasActual ? `${w.actualMileage} mi` : '—'}
                    </td>
                    <td className={`px-5 py-3 font-medium ${!hasActual ? 'text-slate-600' : diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {!hasActual || w.plannedMileage === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}
                    </td>
                    <td className="px-5 py-3">
                      {hasActual && w.plannedMileage > 0 ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          Number(pct) >= 100 ? 'bg-emerald-500/15 text-emerald-400' :
                          Number(pct) >= 85  ? 'bg-cyan-500/15 text-cyan-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>{pct}%</span>
                      ) : hasActual ? (
                        <span className="text-xs text-slate-500">no plan</span>
                      ) : (
                        <span className="text-slate-600 text-xs">upcoming</span>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
