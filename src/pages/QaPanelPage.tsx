// 듀얼 모니터로 시연 영상을 녹화할 때, QA 도구를 메인 화면과 분리된 별도 창(다른 모니터)에 띄워두고
// 여기서만 누르면 메인 창(녹화 중인 화면)에는 QA 패널이 안 보이면서도 즉시 반영되게 하는 전용 페이지.
// HomePage.tsx의 QaControlPanel과 같은 기능이지만, WorkdayContext 없이 api를 직접 호출하고
// notifyQaAction()으로 메인 창에 "새로고침해" 신호만 보낸다(폴링 45초를 안 기다리게).
import { useState } from "react";
import * as api from "@/lib/api";
import { notifyQaAction, isAutoAdvanceEnabled, setAutoAdvance } from "@/lib/qaAutoAdvance";
import { RANKS } from "@/components/promotion/rankArt";

// 심사 기간 등 외부에 라이브 사이트를 공개하는 동안은, 데이터를 실제로 지우거나 조작하는
// 위험한 QA 버튼(초기화/승급 게이트 채우기 등)은 숨긴다 — 실수로 눌러도 안전한 "연락 바로
// 받기" 계열만 남겨서 기능 시연은 여전히 가능하게 함. 기간이 끝나면 true로 되돌리면 됨.
const SHOW_DESTRUCTIVE_QA_TOOLS = true;

const RANK_DAYS_PER_STEP = 30;
const RANK_STEPS = RANKS.slice(0, -1).map((from, i) => ({
  from,
  to: RANKS[i + 1],
  days: RANK_DAYS_PER_STEP * (i + 1),
}));

type DeliverFilterKey = "any" | "colleague" | "manager" | "client" | "review";

const DELIVER_BUTTONS: { key: DeliverFilterKey; label: string; filter?: { role?: "colleague" | "manager" | "client"; kind?: "review" } }[] = [
  { key: "any", label: "연락 바로 받기 (다음 순서)" },
  { key: "colleague", label: "동료 연락 받기", filter: { role: "colleague" } },
  { key: "manager", label: "상사 연락 받기", filter: { role: "manager" } },
  { key: "client", label: "거래처 연락 받기", filter: { role: "client" } },
  { key: "review", label: "복습 연락 받기", filter: { kind: "review" } },
];

export function QaPanelPage() {
  const [autoAdvance, setAutoAdvanceState] = useState(() => isAutoAdvanceEnabled());
  const [deliveringKey, setDeliveringKey] = useState<DeliverFilterKey | null>(null);
  const [triggeringVent, setTriggeringVent] = useState(false);
  const [resettingToday, setResettingToday] = useState(false);
  const [backfillingDays, setBackfillingDays] = useState<number | null>(null);
  const [advancingDay, setAdvancingDay] = useState(false);
  const [resettingAccount, setResettingAccount] = useState(false);

  const handleDeliver = async (key: DeliverFilterKey, filter?: { role?: "colleague" | "manager" | "client"; kind?: "review" }) => {
    if (deliveringKey) return;
    setDeliveringKey(key);
    try {
      await api.deliverNext(filter);
      notifyQaAction();
    } finally {
      setDeliveringKey(null);
    }
  };

  // 외근 중을 2번 누르면 "바쁜 날" 감지로 고함항아리(위로 메시지)가 뜨는 정책을 그대로 재현 —
  // 실제 상대 연락 화면에서 외근중을 두 번 클릭하는 대신 QA에서 바로 트리거
  const handleTriggerVent = async () => {
    if (triggeringVent) return;
    setTriggeringVent(true);
    try {
      await api.goOnFieldWork();
      await api.goOnFieldWork();
      notifyQaAction();
    } finally {
      setTriggeringVent(false);
    }
  };

  const handleResetToday = async () => {
    if (resettingToday) return;
    if (!window.confirm("오늘 workday를 통째로 삭제하고 처음부터(출근 전 상태로) 되돌릴까요? 오늘 기록은 복구할 수 없어요.")) return;
    setResettingToday(true);
    try {
      await api.devResetToday();
      notifyQaAction();
    } finally {
      setResettingToday(false);
    }
  };

  const handleBackfillDays = async (days: number) => {
    if (backfillingDays !== null) return;
    if (!window.confirm(`[QA용] 지난 ${days}일치 더미 근무 기록을 한 번에 채웁니다. (승급 게이트 테스트용)`)) return;
    setBackfillingDays(days);
    try {
      await api.devBackfillDay(days);
      notifyQaAction();
    } finally {
      setBackfillingDays(null);
    }
  };

  const handleAdvanceDay = async () => {
    if (advancingDay) return;
    if (!window.confirm("[QA용] 오늘을 마감하고 다음 접속 시 새로운 하루로 시작합니다. (대화 연속성 테스트용)")) return;
    setAdvancingDay(true);
    try {
      await api.devAdvanceToNextDay();
      notifyQaAction();
    } finally {
      setAdvancingDay(false);
    }
  };

  const handleResetAccount = async () => {
    if (resettingAccount) return;
    if (
      !window.confirm(
        "[QA용] 이 계정의 근무 기록·연차·승급 이력·프로필을 전부 지우고 온보딩부터 다시 시작합니다. 되돌릴 수 없어요. 계속할까요?",
      )
    )
      return;
    setResettingAccount(true);
    try {
      await api.devResetAccount();
      notifyQaAction();
    } finally {
      setResettingAccount(false);
    }
  };

  return (
    <div className="min-h-screen space-y-2 bg-surface p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">QA 도구 (분리된 창)</p>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/40">
          이 창을 다른 모니터에 두고 여기서만 누르세요 — 메인 창(녹화 화면)에는 안 보여요.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = !autoAdvance;
          setAutoAdvance(next);
          setAutoAdvanceState(next);
        }}
        title="켜두면 답장을 보낼 때마다, 그 답장 하나에 대해서만 다음 연락이 바로 도착합니다(전체가 한번에 오지 않음)"
        className={`w-full rounded-md border border-dashed px-2.5 py-1.5 text-left text-xs font-medium disabled:opacity-50 ${
          autoAdvance
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-foreground/30 text-foreground/60 hover:bg-black/[.03]"
        }`}
      >
        자동 진행(시연용): {autoAdvance ? "ON" : "OFF"}
      </button>
      <div className="space-y-1 border-t border-dashed border-foreground/20 pt-1.5">
        <p className="px-0.5 text-[10px] font-medium text-foreground/40">
          역할별로 원하는 순서 그대로 개별 촬영할 때 사용
        </p>
        {DELIVER_BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => handleDeliver(b.key, b.filter)}
            disabled={deliveringKey !== null}
            title="예정 시각과 상관없이 이 조건에 맞는 연락을 바로 발송합니다"
            className="w-full rounded-md border border-dashed border-amber-400 px-2.5 py-1.5 text-left text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
          >
            {deliveringKey === b.key ? "받는 중..." : b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleTriggerVent}
          disabled={triggeringVent}
          title="외근 중을 2번 누른 것과 동일하게 처리해서 고함항아리(위로 메시지)를 바로 띄웁니다"
          className="w-full rounded-md border border-dashed border-orange-400 px-2.5 py-1.5 text-left text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
        >
          {triggeringVent ? "처리 중..." : "고함항아리 바로 받기"}
        </button>
      </div>
      {SHOW_DESTRUCTIVE_QA_TOOLS && (
        <>
          <button
            type="button"
            onClick={handleResetToday}
            disabled={resettingToday}
            title="오늘 workday를 삭제해서 출근 전 상태로 되돌립니다(같은 날 반복 테스트용)"
            className="w-full rounded-md border border-dashed border-red-300 px-2.5 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {resettingToday ? "초기화 중..." : "오늘 초기화"}
          </button>
          <div className="space-y-1 border-t border-dashed border-foreground/20 pt-1.5">
            <p className="px-0.5 text-[10px] font-medium text-foreground/40">
              직급별 승급 게이트 채우기 (현재 직급 기준으로 골라 누르기)
            </p>
            {RANK_STEPS.map((step) => (
              <button
                key={step.days}
                type="button"
                onClick={() => handleBackfillDays(step.days)}
                disabled={backfillingDays !== null}
                title={`지난 ${step.days}일치 더미 근무 기록을 채워 ${step.from}→${step.to} 승급 조건을 채웁니다`}
                className="w-full rounded-md border border-dashed border-blue-300 px-2.5 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {backfillingDays === step.days ? "채우는 중..." : `+${step.days}일 (${step.from}→${step.to})`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAdvanceDay}
            disabled={advancingDay}
            title="오늘을 마감하고 다음 접속 시 새로운 하루로 취급되게 합니다(대화 연속성 테스트용)"
            className="w-full rounded-md border border-dashed border-emerald-300 px-2.5 py-1.5 text-left text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          >
            {advancingDay ? "넘기는 중..." : "다음날로 넘기기"}
          </button>
          <button
            type="button"
            onClick={handleResetAccount}
            disabled={resettingAccount}
            title="이 계정의 근무 기록·연차·승급 이력·프로필을 전부 지우고 온보딩부터 다시 시작합니다"
            className="w-full rounded-md border border-dashed border-violet-400 px-2.5 py-1.5 text-left text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50"
          >
            {resettingAccount ? "초기화 중..." : "계정 전체 초기화"}
          </button>
        </>
      )}
    </div>
  );
}
