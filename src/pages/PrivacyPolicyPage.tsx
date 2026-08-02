export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 text-sm leading-relaxed text-foreground/80 md:px-8">
      <h1 className="text-lg font-semibold text-foreground">개인정보처리방침 (초안)</h1>
      <p className="text-xs text-amber-600">
        ※ 이 문서는 초안입니다. 실제 서비스 공개 전 반드시 법률 검토를 거쳐주세요.
      </p>

      <section className="space-y-1">
        <h2 className="font-medium text-foreground">1. 수집하는 개인정보 항목</h2>
        <p>이메일 주소, 이름, 비밀번호(암호화 저장), 업종·직무 등 온보딩 입력 정보, 서비스 이용 중 작성한 영어 답변 및 대화 내용, 웹 푸시 구독 정보.</p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium text-foreground">2. 수집 목적</h2>
        <p>회원 식별 및 로그인, 사용자 맞춤형 업무 시나리오 생성, 서비스 이용 기록 저장 및 이어보기 제공, 웹 푸시 알림 발송.</p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium text-foreground">3. 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시 또는 법령에서 정한 보관 기간이 있는 경우 해당 기간까지 보관 후 즉시 파기합니다.</p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium text-foreground">4. 제3자 제공</h2>
        <p>이용자의 개인정보는 원칙적으로 제3자에게 제공하지 않습니다. 다만 서비스 운영에 필요한 인프라(인증·데이터베이스·AI 응답 생성)를 위해 Supabase, Upstage(SOLAR) 등 외부 처리업체에 위탁될 수 있습니다.</p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium text-foreground">5. 이용자의 권리</h2>
        <p>이용자는 언제든 자신의 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.</p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium text-foreground">6. 문의처</h2>
        <p>개인정보 관련 문의는 서비스 운영자에게 연락해주세요.</p>
      </section>
    </div>
  );
}
