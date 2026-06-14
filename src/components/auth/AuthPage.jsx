import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, User, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

function Field({ icon: Icon, type, placeholder, value, onChange, show, onToggle }) {
  const [focused, setFocused] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      background:'rgba(255,255,255,0.06)', border:`1px solid ${focused?'rgba(34,211,238,0.5)':'rgba(255,255,255,0.12)'}`,
      borderRadius:12, padding:'13px 16px', transition:'border-color 0.2s',
    }}>
      <Icon size={15} style={{ color:'rgba(255,255,255,0.35)', flexShrink:0 }}/>
      <input
        type={isPassword ? (show ? 'text' : 'password') : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={()=>setFocused(true)}
        onBlur={()=>setFocused(false)}
        style={{
          flex:1, background:'none', border:'none', outline:'none',
          color:'white', fontSize:14, fontFamily:'inherit',
        }}
      />
      {isPassword && (
        <button type="button" onClick={onToggle}
          style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', padding:0 }}>
          {show ? <EyeOff size={14}/> : <Eye size={14}/>}
        </button>
      )}
    </div>
  )
}

export default function AuthPage({ onLegal }) {
  const { signIn, signUp } = useAuth()
  const [tab,      setTab]      = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [agreed,   setAgreed]   = useState(false)
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (tab === 'signup' && !agreed) { setError('You must accept the Terms of Service and Privacy Policy.'); return }
    setBusy(true)
    try {
      if (tab === 'login') await signIn({ email, password })
      else await signUp({ email, password, name })
    } catch(err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', position:'relative', overflow:'hidden',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#060912' }}>

      {/* Background */}
      <img src="/hayward_img.jpg" alt="" style={{
        position:'absolute', inset:0, width:'100%', height:'100%',
        objectFit:'cover', opacity:0.35,
      }}/>
      <div style={{ position:'absolute', inset:0,
                    background:'linear-gradient(to bottom, rgba(6,9,18,0.6) 0%, rgba(6,9,18,0.85) 100%)' }}/>

      {/* Card */}
      <motion.div
        initial={{ opacity:0, y:24, scale:0.97 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.6, ease:[0.22,1,0.36,1] }}
        style={{
          position:'relative', zIndex:10,
          width: 420,
          background:'rgba(10,14,28,0.85)',
          backdropFilter:'blur(40px)', WebkitBackdropFilter:'blur(40px)',
          border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:24, padding:'40px 40px 36px',
          boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
        }}>

        {/* Logo / wordmark */}
        <div style={{ marginBottom:32 }}>
          <p style={{ fontSize:9, fontFamily:'monospace', color:'rgba(255,255,255,0.25)',
                      textTransform:'uppercase', letterSpacing:'0.4em', marginBottom:8 }}>
            XC Training
          </p>
          <h1 style={{ fontSize:26, fontWeight:800, color:'white', lineHeight:1,
                       fontFamily:'Space Grotesk, Inter, sans-serif' }}>
            {tab === 'login' ? 'Welcome back.' : 'Create your account.'}
          </h1>
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.05)',
                      borderRadius:12, padding:4, marginBottom:28 }}>
          {['login','signup'].map(t => (
            <button key={t} onClick={()=>{setTab(t);setError('')}}
              style={{
                flex:1, padding:'9px 0', borderRadius:9, border:'none', cursor:'pointer',
                fontSize:13, fontWeight:600, transition:'all 0.2s',
                background: tab===t ? 'rgba(34,211,238,0.15)' : 'transparent',
                color: tab===t ? '#22d3ee' : 'rgba(255,255,255,0.35)',
                boxShadow: tab===t ? '0 0 0 1px rgba(34,211,238,0.25)' : 'none',
              }}>
              {t === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <AnimatePresence>
            {tab === 'signup' && (
              <motion.div
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }}>
                <Field icon={User} type="text" placeholder="Display name"
                  value={name} onChange={e=>setName(e.target.value)}/>
              </motion.div>
            )}
          </AnimatePresence>

          <Field icon={Mail} type="email" placeholder="Email address"
            value={email} onChange={e=>setEmail(e.target.value)}/>
          <Field icon={Lock} type="password" placeholder="Password (min 8 chars)"
            value={password} onChange={e=>setPassword(e.target.value)}
            show={showPw} onToggle={()=>setShowPw(s=>!s)}/>

          {/* ToS checkbox — signup only */}
          <AnimatePresence>
            {tab === 'signup' && (
              <motion.label
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer',
                         marginTop:4, fontSize:12, color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                  style={{ marginTop:2, accentColor:'#22d3ee', width:14, height:14, flexShrink:0 }}/>
                <span>
                  I have read and agree to the{' '}
                  <button type="button" onClick={()=>onLegal('tos')}
                    style={{ background:'none', border:'none', cursor:'pointer',
                             color:'#22d3ee', fontSize:12, padding:0, textDecoration:'underline' }}>
                    Terms of Service
                  </button>{' '}and{' '}
                  <button type="button" onClick={()=>onLegal('privacy')}
                    style={{ background:'none', border:'none', cursor:'pointer',
                             color:'#22d3ee', fontSize:12, padding:0, textDecoration:'underline' }}>
                    Privacy Policy
                  </button>.
                </span>
              </motion.label>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                       background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)',
                       borderRadius:10, color:'#fca5a5', fontSize:13 }}>
              <AlertCircle size={13}/> {error}
            </motion.div>
          )}

          <motion.button type="submit" disabled={busy}
            whileHover={{ scale: busy ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
            style={{
              marginTop:8, padding:'14px', borderRadius:12, border:'none',
              background: busy ? 'rgba(34,211,238,0.3)' : 'linear-gradient(to right,#22d3ee,#818cf8)',
              color: busy ? 'rgba(255,255,255,0.5)' : 'white',
              fontSize:15, fontWeight:700, cursor: busy ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
            {busy ? 'Please wait…' : (tab === 'login' ? 'Log In' : 'Create Account')}
            {!busy && <ArrowRight size={15}/>}
          </motion.button>
        </form>

        <p style={{ marginTop:20, textAlign:'center', fontSize:11,
                    color:'rgba(255,255,255,0.2)', lineHeight:1.6 }}>
          Your training data is encrypted and stored securely.<br/>
          We never sell your data or send marketing emails.
        </p>
      </motion.div>
    </div>
  )
}
