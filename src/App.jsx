import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './components/auth/AuthPage'
import AccountSettings from './components/auth/AccountSettings'
import TermsOfService from './components/legal/TermsOfService'
import PrivacyPolicy from './components/legal/PrivacyPolicy'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, TrendingUp, Upload, GitCompare, BookOpen,
  Activity, BarChart2, Zap, MapPin, Menu, X, Trophy, LogOut, Settings } from 'lucide-react'
import useTrainingStore from './store/trainingStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import Dashboard    from './components/Dashboard'
import PRsView   from './components/PRsView'
import MileageGraph from './components/MileageGraph'
import UploadPlan   from './components/UploadPlan'
import CompareView  from './components/CompareView'
import WeeklyLog    from './components/WeeklyLog'
import FitnessView  from './components/FitnessView'
import StatsView    from './components/StatsView'
import BackgroundScene from './components/BackgroundScene'
import Footer from './components/Footer'

const NAV = [
  { id:'dashboard', label:'Dashboard',  icon:LayoutDashboard },
  { id:'graph',     label:'Mileage',    icon:TrendingUp },
  { id:'log',       label:'Weekly Log', icon:BookOpen },
  { id:'upload',    label:'Upload',     icon:Upload },
  { id:'prs',       label:'PRs',        icon:Trophy },
  { id:'account',   label:'Account',    icon:Settings },
  { id:'compare',   label:'Compare',    icon:GitCompare },
  { id:'fitness',   label:'Fitness',    icon:Activity },
  { id:'stats',     label:'Stats',      icon:BarChart2 },
]

const PAGE_COMPONENTS = {
  dashboard:Dashboard, graph:MileageGraph, log:WeeklyLog,
  upload:UploadPlan, prs:PRsView, compare:CompareView, fitness:FitnessView, stats:StatsView,
}

const PAGE_META = {
  dashboard: { photo:'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b', location:'Eugene, Oregon',   tag:'Track & Field'   },
  graph:     { photo:'https://images.unsplash.com/photo-1502602898657-3e91760cbb34', location:'Paris, France',    tag:'Volume Analysis'  },
  log:       { photo:'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf', location:'Tokyo, Japan',     tag:'Weekly Training'  },
  upload:    { photo:'/hayward_img.jpg',                                              location:'Hayward Field',    tag:'Training Plan'    },
  compare:   { photo:'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad', location:'London, England',  tag:'Period Analysis'  },
  fitness:   { photo:'https://images.unsplash.com/photo-1552832230-c0197dd311b5',    location:'Rome, Italy',      tag:'Fitness Metrics'  },
  stats:     { photo:'https://images.unsplash.com/photo-1560969184-10fe8719e047',    location:'Berlin, Germany',  tag:'Lifetime Stats'   },
  prs:       { photo:'https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee',    location:'Hayward Field',    tag:'Personal Records' },
}

/* Hero only shown for non-dashboard pages */
function PageHero({ page }) {
  const meta  = PAGE_META[page] || PAGE_META.dashboard
  const label = NAV.find(n => n.id === page)?.label || page
  return (
    <div style={{ height:260, position:'relative', overflow:'hidden', flexShrink:0 }}>
      <motion.div className="absolute inset-0"
        initial={{ scale:1.1 }} animate={{ scale:1 }}
        transition={{ duration:1.6, ease:[0,0,0.2,1] }}>
        <img src={`${meta.photo}?w=1600&auto=format&fit=crop&q=80`}
             alt="" className="w-full h-full object-cover" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      {/* Grain */}
      <svg aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.05,mixBlendMode:'overlay',pointerEvents:'none'}}>
        <filter id={`g-${page}`}><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
        <rect width="100%" height="100%" filter={`url(#g-${page})`}/>
      </svg>
      <div className="absolute bottom-8 left-8 z-10">
        <motion.p initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:0.1,duration:0.5}}
          className="flex items-center gap-1.5 text-[10px] text-white/45 font-mono uppercase tracking-[0.28em] mb-2">
          <MapPin size={9}/>{meta.tag} · {meta.location}
        </motion.p>
        <motion.h1 initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2,duration:0.7,ease:[0.22,1,0.36,1]}}
          className="font-display text-[52px] font-bold text-white leading-none tracking-tight">{label}</motion.h1>
      </div>
      <motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.45,duration:0.9,ease:[0.22,1,0.36,1]}}
        style={{transformOrigin:'left'}}
        className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-cyan-400/80 via-violet-400/50 to-transparent z-10"/>
    </div>
  )
}

function TopNav({ activePage, setActivePage }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="relative z-30 h-14 flex items-center px-6 bg-[#080c14]/90 backdrop-blur-xl border-b border-white/[0.06]">
      {/* Logo */}
      <button onClick={() => setActivePage('dashboard')}
        className="flex items-center gap-2.5 mr-8 shrink-0 group">
        <motion.div whileHover={{scale:1.08,rotate:5}} transition={{type:'spring',stiffness:400}}
          className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/30">
          <Zap size={14} className="text-white" strokeWidth={2.5}/>
        </motion.div>
        <span className="font-display font-bold text-sm text-white/90 leading-none hidden sm:block">On The Line</span>
      </button>

      {/* Desktop links */}
      <nav className="hidden md:flex items-center gap-0.5 flex-1">
        {NAV.map(item => {
          const active = activePage === item.id
          return (
            <motion.button key={item.id} onClick={() => setActivePage(item.id)}
              whileHover={{backgroundColor:'rgba(255,255,255,0.05)'}}
              className={`relative px-3 py-1.5 rounded-lg text-sm transition-colors font-medium
                ${active ? 'text-cyan-300' : 'text-slate-400 hover:text-white'}`}>
              {active && (
                <motion.span layoutId="nav-indicator"
                  className="absolute inset-0 rounded-lg bg-white/[0.07] ring-1 ring-white/10"
                  transition={{type:'spring',stiffness:380,damping:32}}/>
              )}
              <span className="relative">{item.label}</span>
            </motion.button>
          )
        })}
      </nav>

      {/* Mobile hamburger */}
      <button className="md:hidden ml-auto text-slate-400" onClick={() => setOpen(o=>!o)}>
        {open ? <X size={20}/> : <Menu size={20}/>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="absolute top-14 left-0 right-0 bg-[#080c14] border-b border-white/[0.06] p-4 space-y-1 md:hidden">
            {NAV.map(item => (
              <button key={item.id} onClick={() => { setActivePage(item.id); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${activePage===item.id ? 'bg-white/[0.08] text-cyan-300' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function AppShell() {
  const { user, loading, signOut } = useAuth()
  const { activePage, setActivePage } = useTrainingStore()
  const [legalPage, setLegalPage] = useState(null) // 'tos' | 'privacy'

  // Show legal pages (accessible from auth page before login too)
  if (legalPage === 'tos')     return <TermsOfService onBack={() => setLegalPage(null)}/>
  if (legalPage === 'privacy') return <PrivacyPolicy  onBack={() => setLegalPage(null)}/>

  // Loading
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#060912', display:'flex',
                  alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32,height:32,border:'2px solid rgba(34,211,238,0.3)',
                    borderTop:'2px solid #22d3ee',borderRadius:'50%',
                    animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // Not logged in → auth page
  if (!user) return <AuthPage onLegal={setLegalPage}/>

  // Account & legal sub-pages
  if (activePage === 'account') return (
    <AccountSettings onClose={() => setActivePage('dashboard')}
      setActivePage={page => { if (page==='tos'||page==='privacy') setLegalPage(page); else setActivePage(page) }}/>
  )
  if (activePage === 'tos')     return <TermsOfService onBack={() => setActivePage('dashboard')}/>
  if (activePage === 'privacy') return <PrivacyPolicy  onBack={() => setActivePage('dashboard')}/>

  return <MainApp/>
}

export default function App() {
  return <AuthProvider><AppShell/></AuthProvider>
}

function MainApp() {
  const { activePage, setActivePage } = useTrainingStore()
  const PageComp = PAGE_COMPONENTS[activePage] || Dashboard
  const isDash   = activePage === 'dashboard'

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1a] overflow-hidden">
      <TopNav activePage={activePage} setActivePage={setActivePage}/>
      {!isDash && <BackgroundScene page={activePage}/>}
      <main className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div key={activePage}
            initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            transition={{duration:0.3,ease:[0.22,1,0.36,1]}}
            className="min-h-full flex flex-col">
            {!isDash && <PageHero page={activePage}/>}
            <div className="flex-1"><ErrorBoundary><PageComp/></ErrorBoundary></div>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer/>
    </div>
  )
}
