import { useState } from 'react'
import { motion } from 'framer-motion'
import useTrainingStore from '../store/trainingStore'

export default function Footer() {
  const setActivePage = useTrainingStore(s => s.setActivePage)

  return (
    <motion.footer
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '18px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(6,9,18,0.6)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>

      {/* Left: brand */}
      <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.18)',
                  letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        XC Training © {new Date().getFullYear()}
      </p>

      {/* Right: links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <FooterLink onClick={() => setActivePage('tos')}>Terms of Service</FooterLink>
        <FooterLink onClick={() => setActivePage('privacy')}>Privacy Policy</FooterLink>
        <a href="mailto:haydenthooper@icloud.com"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none',
                   fontFamily: 'monospace', letterSpacing: '0.05em', transition: 'color 0.2s' }}
          onMouseEnter={e => e.target.style.color = '#22d3ee'}
          onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.28)'}>
          Contact Us
        </a>
      </div>
    </motion.footer>
  )
}

function FooterLink({ onClick, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.05em',
        color: hovered ? '#22d3ee' : 'rgba(255,255,255,0.28)',
        transition: 'color 0.2s',
      }}>
      {children}
    </button>
  )
}
