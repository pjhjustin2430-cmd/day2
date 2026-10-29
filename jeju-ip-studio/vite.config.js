import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 서버(npm run dev)에서도 Vercel 서버리스 함수(/api/pixabay)와 똑같이 동작하게 해 주는 플러그인.
// PIXABAY_API_KEY 는 VITE_ 접두사가 없으므로 브라우저 번들에는 절대 들어가지 않고, 서버(Node)에서만 읽힙니다.
function pixabayDevApi(env) {
  return {
    name: 'pixabay-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/pixabay', async (req, res) => {
        try {
          // 주의: process.env 에 undefined 를 대입하면 문자열 "undefined" 가 되므로 값이 있을 때만 설정
          if (env.PIXABAY_API_KEY) process.env.PIXABAY_API_KEY = env.PIXABAY_API_KEY
          const { default: handler } = await server.ssrLoadModule('/api/pixabay.js')
          const url = new URL(req.url, 'http://localhost')
          req.query = Object.fromEntries(url.searchParams)
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)) }
          await handler(req, res)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), pixabayDevApi(env)] }
})
