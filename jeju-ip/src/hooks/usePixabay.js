import { useEffect, useState } from 'react'

// Pixabay 약관: API 결과는 24시간 캐싱해야 합니다. (서버 CDN 캐시 + 브라우저 localStorage 캐시)
const TTL = 24 * 60 * 60 * 1000

// 같은 검색어를 여러 컴포넌트가 동시에 요청해도 네트워크 호출은 한 번만 (실패도 1분간 재사용)
const inflight = new Map()

function fetchQuery(q, perPage) {
  const key = `pixabay:${q}:${perPage}`
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null')
    if (cached && Date.now() - cached.t < TTL) return Promise.resolve(cached.hits)
  } catch { /* 캐시를 못 읽어도 무시 */ }

  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    const res = await fetch(`/api/pixabay?q=${encodeURIComponent(q)}&per_page=${perPage}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `이미지 서버 오류 (${res.status})`)
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), hits: data.hits })) } catch { /* 용량 초과 등 무시 */ }
    return data.hits
  })()
  inflight.set(key, p)
  p.then(() => inflight.delete(key), () => setTimeout(() => inflight.delete(key), 60000))
  return p
}

/**
 * queries: 검색어 문자열 또는 [주 검색어, 대체 검색어...]
 * 결과가 min 장 미만이면 다음 검색어로 이어서 채웁니다.
 */
export function usePixabay(queries, perPage = 12, min = 3) {
  const list = Array.isArray(queries) ? queries : [queries]
  const dep = list.join('|') + '#' + perPage + '#' + min
  const [state, setState] = useState({ hits: [], loading: true, error: null })

  useEffect(() => {
    let off = false
    ;(async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        let all = []
        for (const q of list) {
          const hits = await fetchQuery(q, perPage)
          all = [...all, ...hits.filter((h) => !all.some((a) => a.id === h.id))]
          if (all.length >= min) break
        }
        if (!off) setState({ hits: all.slice(0, perPage), loading: false, error: null })
      } catch (e) {
        if (!off) setState({ hits: [], loading: false, error: e.message })
      }
    })()
    return () => { off = true }
  }, [dep])

  return state
}
