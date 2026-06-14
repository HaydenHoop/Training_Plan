import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Heart, Activity, Mountain, CheckCircle } from 'lucide-react'
import useTrainingStore from '../store/trainingStore'
import { analyzeTraining } from '../utils/analysis'

const WORKOUT_COLORS = {
  'Easy Run':   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Tempo':      { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  'Intervals':  { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/20' },
  'Long Run':   { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/20' },
  'Recovery':   { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  'Shakeout':   { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/20' },
  'Rest':       { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/20' },
}

// DayCard aggregates ALL FIT runs for the day — handles multiple activities.
function DayCard({ day, isToday }) {
  const dayRuns = useTrainingStore(s => s.getRunsByDate(day.date))
  const c = WORKOUT_COLORS[day.workoutType] || WORKOUT_COLORS['Easy Run']
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayDate = new Date(day.date + 'T00:00:00')
  const isPast = dayDate < today
  const hasRun = dayRuns.length > 0

  // Aggregate across all runs for the day
  const totalMileage = +dayRuns.reduce((s, r) => s + (r.mileage || 0), 0).toFixed(1)
  const hrRuns = dayRuns.filter(r => r.avgHR > 0)
  const avgHR = hrRuns.length ? Math.round(hrRuns.reduce((s, r) => s + r.avgHR, 0) / hrRuns.length) : 0
  const totalElev = Math.round(dayRuns.reduce((s, r) => s + (r.elevGainFt || 0), 0))
  // Best pace from longest run
  const bestPaceRun = dayRuns.filter(r => r.avgPace && r.mileage > 0).sort((a, b) => b.mileage - a.mileage)[0]

  // Green = FIT run recorded; yellow = past day with plan but no run; cyan = today
  const borderClass = isToday
    ? 'border-cyan-500/30 glow-blue'
    : isPast && hasRun
      ? 'border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.08)]'
      : isPast && !hasRun && day.plannedMileage > 0
        ? 'border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.08)]'
        : 'border-white/5'

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400 }}
      className={`glass rounded-2xl p-4 border transition-colors h-full ${borderClass}`}
    >
      {/* Day header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-mono uppercase tracking-wider ${isToday ? 'text-cyan-400' : 'text-slate-500'}`}>
            {format(parseISO(day.date), 'EEE')}
          </p>
          <p className={`text-xl font-bold ${isToday ? 'text-cyan-300' : 'text-slate-200'}`}>
            {format(parseISO(day.date), 'd')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRun && <CheckCircle size={14} className="text-emerald-400" />}
          {dayRuns.length > 1 && (
            <span className="text-[10px] font-mono text-slate-500">{dayRuns.length}x</span>
          )}
          {isPast && !hasRun && day.plannedMileage > 0 && (
            <div className="w-2 h-2 rounded-full bg-amber-400/50" />
          )}
        </div>
      </div>

      {/* Workout type badge */}
      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border} mb-3`}>
        {day.workoutType}
      </span>

      {/* Stats */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Planned</span>
          <span className="text-slate-300 font-mono">{day.plannedMileage} mi</span>
        </div>
        {hasRun && (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Actual</span>
              <span className={`font-mono font-bold ${totalMileage >= day.plannedMileage * 0.9 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {totalMileage} mi
              </span>
            </div>
            {avgHR > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1"><Heart size={10} /> HR</span>
                <span className="text-rose-400 font-mono">{avgHR} bpm</span>
              </div>
            )}
            {bestPaceRun?.avgPace && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1"><Activity size={10} /> Pace</span>
                <span className="text-cyan-400 font-mono">{bestPaceRun.avgPace}/mi</span>
              </div>
            )}
            {totalElev > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1"><Mountain size={10} /> Elev</span>
                <span className="text-violet-400 font-mono">{totalElev} ft</span>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function WeeklyLog() {
  const { weeks, runs } = useTrainingStore()
  const [weekOffset, setWeekOffset] = useState(0)

  const sortedWeeks = useMemo(() => [...weeks].sort((a, b) => b.startDate.localeCompare(a.startDate)), [weeks])
  const weekIndex   = Math.max(0, Math.min(sortedWeeks.length - 1, weekOffset))
  const currentWeek = sortedWeeks[weekIndex]

  const insights     = useMemo(() => analyzeTraining(weeks, runs), [weeks, runs])
  const weekInsights = insights.slice(0, 2)

  const todayStr = new Date().toISOString().split('T')[0]

  // Actual mileage from FIT runs matching this week's dates
  const weekActual = useMemo(() => {
    if (!currentWeek) return 0
    const dates = new Set(currentWeek.days.map(d => d.date))
    return +runs
      .filter(r => dates.has(r.date))
      .reduce((s, r) => s + (r.mileage || 0), 0)
      .toFixed(1)
  }, [runs, currentWeek])

  const weekPlanned = currentWeek?.plannedMileage || 0
  const weekPct = weekPlanned > 0 ? Math.min((weekActual / weekPlanned) * 100, 100).toFixed(0) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">Log</p>
        <h1 className="text-3xl font-bold text-white">Weekly <span className="text-gradient">Training Log</span></h1>
      </motion.div>

      {/* Week navigator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between mb-6 glass rounded-2xl p-4 border border-white/5"
      >
        <button
          onClick={() => setWeekOffset(o => Math.min(o + 1, sortedWeeks.length - 1))}
          disabled={weekOffset >= sortedWeeks.length - 1}
          className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-white">
            {currentWeek
              ? `${format(parseISO(currentWeek.startDate), 'MMM d')} – ${format(parseISO(currentWeek.days[6].date), 'MMM d, yyyy')}`
              : 'No plan uploaded'}
          </p>
          <div className="flex items-center justify-center gap-4 mt-1 text-xs text-slate-400">
            <span>{weekActual} / {weekPlanned} mi</span>
            <span className={`font-semibold ${Number(weekPct) >= 100 ? 'text-emerald-400' : Number(weekPct) >= 85 ? 'text-cyan-400' : 'text-orange-400'}`}>
              {weekPct}% complete
            </span>
          </div>
        </div>

        <button
          onClick={() => setWeekOffset(o => Math.max(o - 1, 0))}
          disabled={weekOffset <= 0}
          className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </motion.div>

      {/* Day cards — read-only, data from FIT imports */}
      {currentWeek ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6"
        >
          {currentWeek.days.map((day, i) => (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <DayCard day={day} isToday={day.date === todayStr} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-10 border border-white/5 flex flex-col items-center justify-center mb-6 text-center">
          <p className="text-slate-400 text-sm font-medium mb-1">No training plan for this week</p>
          <p className="text-slate-600 text-xs">Paste a plan on the Upload page to see your schedule here.</p>
        </motion.div>
      )}

      {/* Week progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-xl p-4 border border-white/5 mb-4"
      >
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Week completion</span>
          <span className="font-mono">{weekActual} / {weekPlanned} mi</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weekPct}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            className={`h-full rounded-full ${Number(weekPct) >= 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
          />
        </div>
      </motion.div>

      {/* Insights */}
      {weekInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Training Insights</p>
          {weekInsights.map((ins, i) => {
            const colorMap = {
              warning:  'from-orange-500/10 to-red-500/5 border-orange-500/20 text-orange-300',
              positive: 'from-emerald-500/10 to-green-500/5 border-emerald-500/20 text-emerald-300',
              info:     'from-blue-500/10 to-cyan-500/5 border-blue-500/20 text-blue-300',
            }
            const cl = colorMap[ins.type] || colorMap.info
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass rounded-xl px-4 py-3 border bg-gradient-to-r ${cl}`}
              >
                <p className="text-xs font-semibold mb-0.5">{ins.title}</p>
                <p className="text-xs opacity-80">{ins.body}</p>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
