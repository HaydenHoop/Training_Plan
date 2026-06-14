import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      {
        name: 'strava-token-exchange',
        configureServer(server) {
          server.middlewares.use('/api/strava/token', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
            let body = ''
            req.on('data', c => { body += c })
            req.on('end', async () => {
              try {
                const p = JSON.parse(body)
                const isRefresh = p.grant_type === 'refresh_token'
                const payload = isRefresh
                  ? { client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, refresh_token: p.refresh_token, grant_type: 'refresh_token' }
                  : { client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, code: p.code, grant_type: 'authorization_code' }
                const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                const data = await r.json()
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = r.status
                res.end(JSON.stringify(data))
              } catch (err) { res.statusCode = 500; res.end(JSON.stringify({ error: err.message })) }
            })
          })
        },
      },
    ],
    define: { __STRAVA_CLIENT_ID__: JSON.stringify(env.STRAVA_CLIENT_ID || '') },
    server: { port: 5173 },
  }
})
