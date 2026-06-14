import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Page error</p>
          <pre style={{ fontSize: 12, background: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 8, textAlign: 'left', overflowX: 'auto', color: '#fca5a5', marginBottom: 16 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
