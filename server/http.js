// Vercel 서버리스 핸들러 공통 유틸
export function withErrors(method, fn) {
  return async (req, res) => {
    try {
      if (method && req.method !== method) {
        res.status(405).json({ error: 'Method Not Allowed' })
        return
      }
      await fn(req, res)
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'server error' })
    }
  }
}
