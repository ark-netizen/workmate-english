import { Navigate } from "react-router-dom";

// 신규 발신 메일은 아직 서버 저장/상대 응답 흐름이 연결되지 않았다.
// 화면에서만 '보낸 것처럼' 보이는 임시 기능을 공개하지 않고, 실제 동작하는 받은 메일 답장 흐름만 제공한다.
export function ComposeEmailPage() {
  return <Navigate to="/email" replace />;
}
