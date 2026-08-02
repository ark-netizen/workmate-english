import { Lock } from "lucide-react";

// "1분 체험하기" 게스트에게는 의미가 없거나(출석 이력, 30일 승급 조건 등) 아직 보여줄 준비가 안 된
// 화면(Attendance/Evaluation/Notice) 대신 보여주는 잠금 안내 화면
export function TrialLockedPage({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5">
        <Lock className="size-5 text-foreground/40" strokeWidth={2} />
      </div>
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-foreground/50">로그인 후 사용해보세요.</p>
    </div>
  );
}
