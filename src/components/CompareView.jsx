import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format } from 'date-fns'
import { GitCompare, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from 'lucide-react'
import useTrainingStore from '../store/trainingStore'

// ── Config ───────────────────────────────────────────────────────────────────
const UNITS = [
  { id: 'week',  label: 'Week',  plural: 'weeks',  maxOffset: 52 },
  { id: 'month', label: 'Month', plural: 'months', maxOffset: 36 },
  { id: 'year',  label: 'Year',  plural: 'years',  maxOffset: 10 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(date, weeksBack = 0) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff - weeksBack * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function getPeriodRange(unit, offset) {
  const now = new Date()
  if (unit === 'week') {
    const start = getMonday(now, offset)
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59)
    return { start, end }
  }
  if (unit === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59)
    return { start, end }
  }
  const y = now.getFullYear() - offset
  return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) }
}

function getPeriodLabel(unit, offset) {
  const { start, end } = getPeriodRange(unit, offset)
  if (unit === 'week')  return `${format(start, 'MMM d')}–${format(end, 'MMM d, yyyy')}`
  if (unit === 'month') return format(start, 'MMMM yyyy')
  return String(start.getFullYear())
}

function getOffsetLabel(unit, offset) {
  if (offset === 0) return `This ${unit}`
  if (offset === 1) return `Last ${unit}`
  const u = UNITS.find(x => x.id === unit)
  return `${offset} ${u.plural} ago`
}

function bucketRuns(runs, unit, offset, subUnit = 'month') {
  const { start, end } = getPeriodRange(unit, offset)
  const dayMap = {}
  for (const run of runs) {
    if (!run.date || !run.mileage) continue
    const d = new Date(run.date + 'T12:00:00')
    if (d >= start && d <= end) {
      dayMap[run.date] = (dayMap[run.date] || 0) + run.mileage
    }
  }

  if (unit === 'week') {
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const key = d.toISOString().split('T')[0]
      return { label, miles: +(dayMap[key] || 0).toFixed(1) }
    })
  }

  if (unit === 'month') {
    const y = start.getFullYear(), m = start.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const numWeeks = Math.ceil(daysInMonth / 7)
    const buckets = Array.from({ length: numWeeks }, (_, i) => ({ label: `Wk ${i + 1}`, miles: 0 }))
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day)
      const key = d.toISOString().split('T')[0]
      buckets[Math.floor((day - 1) / 7)].miles += dayMap[key] || 0
    }
    return buckets.map(b => ({ ...b, miles: +b.miles.toFixed(1) }))
  }

  // Year — monthly (default) or weekly breakdown
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const y = start.getFullYear()

  if (subUnit === 'week') {
    // Build ~52 weekly buckets for the year
    const jan1 = new Date(y, 0, 1)
    const dec31 = new Date(y, 11, 31)
    const dayMap = {}
    for (const run of runs) {
      if (!run.date || !run.mileage) continue
      const d = new Date(run.date + 'T12:00:00')
      if (d.getFullYear() === y) dayMap[run.date] = (dayMap[run.date] || 0) + run.mileage
    }
    const weekBuckets = []
    let cur = new Date(jan1)
    let wNum = 1
    while (cur <= dec31) {
      const weekEnd = new Date(cur); weekEnd.setDate(cur.getDate() + 6)
      let miles = 0
      for (let d = new Date(cur); d <= weekEnd && d <= dec31; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0]
        miles += dayMap[key] || 0
      }
      weekBuckets.push({ label: `W${wNum}`, miles: +miles.toFixed(1) })
      cur.setDate(cur.getDate() + 7)
      wNum++
    }
    return weekBuckets
  }

  const buckets = months.map(label => ({ label, miles: 0 }))
  for (const run of runs) {
    if (!run.date || !run.mileage) continue
    const d = new Date(run.date + 'T12:00:00')
    if (d.getFullYear() === y) buckets[d.getMonth()].miles += run.mileage
  }
  return buckets.map(b => ({ ...b, miles: +b.miles.toFixed(1) }))
}

function getStats(data) {
  const total  = +data.reduce((s, d) => s + d.miles, 0).toFixed(1)
  const active = data.filter(d => d.miles > 0)
  const avg    = active.length ? +(total / active.length).toFixed(1) : 0
  const peak   = +Math.max(...data.map(d => d.miles), 0).toFixed(1)
  return { total, avg, peak, active: active.length }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function CompareTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-xs text-slate-400 mb-2 font-mono">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold text-white">{p.value?.toFixed(1)} mi</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, a, b, unit = '' }) {
  const diff  = a - b
  const pct   = b > 0 ? ((diff / b) * 100).toFixed(0) : null
  const Icon  = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'
  return (
    <div className="glass rounded-xl p-4 border border-white/5">
      <p className="text-xs text-slate-500 mb-3">{label}</p>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-xl font-bold text-cyan-400 tabular-nums">{a.toFixed(1)}{unit}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Period A</p>
        </div>
        <div className="flex flex-col items-center pb-5">
          <Icon size={12} className={color} />
          <span className={`text-[10px] font-bold ${color}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}{unit}</span>
          {pct !== null && <span className="text-[10px] text-slate-600">{pct}%</span>}
        </div>
        <div>
          <p className="text-xl font-bold text-violet-400 tabular-nums">{b.toFixed(1)}{unit}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Period B</p>
        </div>
      </div>
    </div>
  )
}

function OffsetControl({ offset, onChange, maxOffset }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(offset - 1)}
        disabled={offset <= 0}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-30"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="text-xs text-slate-300 font-mono w-10 text-center">{offset}</span>
      <button
        onClick={() => onChange(offset + 1)}
        disabled={offset >= maxOffset}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-30"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function CompareView() {
  const { runs } = useTrainingStore()
  const [unit, setUnit]       = useState('week')
  const [offsetA, setOffsetA] = useState(0)
  const [offsetB, setOffsetB] = useState(1)
  const [chartType, setChartType] = useState('bar')
  const [yearSubUnit, setYearSubUnit] = useState('month') // 'month' | 'week'

  const unitCfg = UNITS.find(u => u.id === unit)

  const dataA = useMemo(() => bucketRuns(runs, unit, offsetA, yearSubUnit), [runs, unit, offsetA, yearSubUnit])
  const dataB = useMemo(() => bucketRuns(runs, unit, offsetB, yearSubUnit), [runs, unit, offsetB, yearSubUnit])

  const statsA = useMemo(() => getStats(dataA), [dataA])
  const statsB = useMemo(() => getStats(dataB), [dataB])

  const labelA = getPeriodLabel(unit, offsetA)
  const labelB = getPeriodLabel(unit, offsetB)

  const chartData = dataA.map((a, i) => ({
    label: a.label,
    'Period A': a.miles || null,
    'Period B': dataB[i]?.miles || null,
  }))

  const hasAny = statsA.total > 0 || statsB.total > 0
  const bucketLabel = unit === 'week' ? 'days' : unit === 'month' ? 'weeks' : 'months'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">Analysis</p>
        <h1 className="text-3xl font-bold text-white mb-6">
          <span className="text-gradient">Compare</span> Periods
        </h1>
      </motion.div>

      {/* Unit selector */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 glass rounded-xl p-1 border border-white/5">
          {UNITS.map(u => (
            <button key={u.id} onClick={() => { setUnit(u.id); setOffsetA(0); setOffsetB(1); setYearSubUnit('month') }}
              className={`relative px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${unit === u.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
              {unit === u.id && (
                <motion.div layoutId="unit-pill"
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-violet-500/15 rounded-lg border border-cyan-500/25"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
              )}
              <span className="relative">{u.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Year sub-unit toggle — only shown when unit === year */}
      {unit === 'year' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-6">
          <span className="text-xs text-slate-500">Break down by:</span>
          <div className="flex gap-1 glass rounded-lg p-0.5 border border-white/5">
            {['month', 'week'].map(sub => (
              <button key={sub} onClick={() => setYearSubUnit(sub)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${yearSubUnit === sub ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {sub === 'month' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Period cards — both independently adjustable */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
        className="grid grid-cols-2 gap-4 mb-6">

        <div className="glass rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Period A</p>
            </div>
            <OffsetControl offset={offsetA} onChange={setOffsetA} maxOffset={unitCfg.maxOffset} />
          </div>
          <p className="text-sm font-bold text-white">{getOffsetLabel(unit, offsetA)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{labelA}</p>
          <p className="text-xs text-slate-500 mt-2">{statsA.total} mi · {statsA.active} active {bucketLabel}</p>
        </div>

        <div className="glass rounded-2xl p-4 border border-violet-500/20">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-400" />
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Period B</p>
            </div>
            <OffsetControl offset={offsetB} onChange={setOffsetB} maxOffset={unitCfg.maxOffset} />
          </div>
          <p className="text-sm font-bold text-white">{getOffsetLabel(unit, offsetB)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{labelB}</p>
          <p className="text-xs text-slate-500 mt-2">{statsB.total} mi · {statsB.active} active {bucketLabel}</p>
        </div>
      </motion.div>

      {/* Stats diff row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Mileage"    a={statsA.total} b={statsB.total} unit=" mi" />
        <StatCard label={`Avg / ${unit === 'week' ? 'Day' : unit === 'month' ? 'Week' : 'Month'}`} a={statsA.avg} b={statsB.avg} unit=" mi" />
        <StatCard label={`Peak ${unit === 'week' ? 'Day' : unit === 'month' ? 'Week' : 'Month'}`}   a={statsA.peak} b={statsB.peak} unit=" mi" />
        <StatCard label="Active Days"      a={statsA.active} b={statsB.active} />
      </motion.div>

      {/* Charts */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
        className="glass rounded-2xl p-5 border border-white/5 space-y-6">

        {/* Chart type toggle + legend */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Mileage Comparison</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-cyan-400/70" />
                <span className="text-slate-400">{labelA}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-violet-400/70" />
                <span className="text-slate-400">{labelB}</span>
              </div>
            </div>
            <div className="flex gap-1 glass rounded-lg p-0.5 border border-white/5">
              {['bar', 'line'].map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${chartType === t ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!hasAny ? (
          <div className="flex flex-col items-center justify-center h-60 text-slate-500">
            <GitCompare size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No run data for these periods yet.</p>
            <p className="text-xs mt-1">Import your Coros FIT files on the Upload page.</p>
          </div>
        ) : (
          <>
            {/* Bar chart */}
            {chartType === 'bar' && (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    barCategoryGap="25%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit=" mi" />
                    <Tooltip content={<CompareTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="Period A" name="Period A" fill="#22d3ee" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Period B" name="Period B" fill="#a78bfa" fillOpacity={0.60} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Line chart */}
            {chartType === 'line' && (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit=" mi" />
                    <Tooltip content={<CompareTooltip />} />
                    <Line
                      type="monotone" dataKey="Period A" name="Period A"
                      stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: '#22d3ee', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
                    />
                    <Line
                      type="monotone" dataKey="Period B" name="Period B"
                      stroke="#a78bfa" strokeWidth={2.5} strokeDasharray="5 3"
                      dot={{ fill: '#a78bfa', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
