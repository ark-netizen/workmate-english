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
      // e.status가 있으면 우리가 의도적으로 던진 유효성 검증 에러(사용자에게 그대로 보여줘도 되는 메시지).
      // 없으면 DB/LLM 등 내부 오류일 가능성이 커서, 실제 메시지는 서버 로그에만 남기고 화면에는 일반 문구만 보여준다
      console.error(e)
      const status = e.status || 500
      const message = e.status ? (e.message || 'server error') : '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
      res.status(status).json({ error: message })
    }
  }
}
