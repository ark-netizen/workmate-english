import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as api from "@/lib/api";
import { useWorkday } from "@/context/useWorkday";
import type { StatusTone } from "@/components/ui/StatusBadge";
import type { PeriodRange, PeriodReportResponse } from "@/types/api";
import type { Correction, GoodExpression, KeyExpression, WorkdayReport } from "@/types/domain";
import type { WorkHoursDay } from "@/lib/workHours";
import { STANDARD_WORKDAY_MINUTES } from "@/lib/workHours";
import { formatHoursMinutes } from "@/lib/format";
import { WorkHoursChart } from "@/components/hours/WorkHoursChart";

const REGISTER_ROLE_LABEL: Record<"colleague" | "manager" | "client", string> = {
  colleague: "동료",
  manager: "상사",
  client: "거래처",
};

const SECTION_ACCENT: Record<StatusTone, string> = {
  success: "text-emerald-700 border-emerald-200",
  pending: "text-blue-700 border-blue-200",
  warning: "text-orange-700 border-orange-200",
  error: "text-red-700 border-red-200",
  neutral: "text-foreground/70 border-border",
};

const LIST_MARKER_CLASSES: Record<StatusTone, string> = {
  success: "text-emerald-600",
  pending: "text-blue-600",
  warning: "text-orange-600",
  error: "text-red-600",
  neutral: "text-foreground/40",
};

function ReportSection({
  index,
  title,
  tone,
  children,
}: {
  index: string;
  title: string;
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className={`flex items-baseline gap-2 border-b pb-2 text-sm font-semibold ${SECTION_ACCENT[tone]}`}>
        <span className="font-mono text-xs text-foreground/30">{index}</span>
        {title}
      </h2>
      <div className="pt-3">{children}</div>
    </section>
  );
}

function NumberedList({ items, tone }: { items: string[]; tone: StatusTone }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed">
          <span className={`shrink-0 font-mono text-xs ${LIST_MARKER_CLASSES[tone]}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-foreground/90">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function GoodExpressionList({ items }: { items: GoodExpression[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.text}-${index}`} className="flex gap-3 text-sm leading-relaxed">
          <span className={`shrink-0 font-mono text-xs ${LIST_MARKER_CLASSES.success}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="space-y-1">
            <p className="font-medium text-foreground">&ldquo;{item.text}&rdquo;</p>
            <p className="text-foreground/60">{item.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CorrectionList({ items }: { items: Correction[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.before}-${index}`} className="flex gap-3 text-sm leading-relaxed">
          <span className={`shrink-0 font-mono text-xs ${LIST_MARKER_CLASSES.warning}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="space-y-1">
            <p className="text-foreground/50 line-through decoration-foreground/30">&ldquo;{item.before}&rdquo;</p>
            <p className="font-medium text-foreground">→ &ldquo;{item.after}&rdquo;</p>
            <p className="text-foreground/60">{item.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function KeyExpressionList({ items }: { items: KeyExpression[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <div key={`${item.en}-${index}`} className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <p className="text-sm font-semibold text-blue-800">{item.en}</p>
          <p className="mt-0.5 text-xs text-blue-700/80">{item.ko}</p>
          {item.note && <p className="mt-1.5 text-xs leading-relaxed text-foreground/60">{item.note}</p>}
        </div>
      ))}
    </div>
  );
}

// 일간 리포트 상단에 "오늘 근무 시간 · 일간 평균 대비" 한 줄 요약 — Supabase에 실제 저장된 출퇴근 기록 기반
function ReportWorkHoursLine() {
  const [days, setDays] = useState<WorkHoursDay[] | null>(null);

  useEffect(() => {
    api.getWorkHoursHistory(30).then((res) => setDays(res.days));
  }, []);

  if (!days) return null;
  const worked = days.filter((d) => d.minutes > 0);
  if (worked.length === 0) return null;

  const today = worked[worked.length - 1];
  const previous = worked.slice(0, -1);

  if (previous.length === 0) {
    return (
      <p className="text-xs text-foreground/50">
        오늘 근무 시간: <span className="font-medium text-foreground">{formatHoursMinutes(today.minutes)}</span>
      </p>
    );
  }

  const avgMinutes = previous.reduce((sum, d) => sum + d.minutes, 0) / previous.length;
  const diffPct = Math.round(((today.minutes - avgMinutes) / avgMinutes) * 100);
  const comparison =
    Math.abs(diffPct) < 5
      ? "일간 평균과 비슷하게 근무했어요"
      : diffPct > 0
        ? `일간 평균보다 ${diffPct}% 더 근무했어요`
        : `일간 평균보다 ${Math.abs(diffPct)}% 적게 근무했어요`;

  return (
    <p className="text-xs text-foreground/50">
      오늘 근무 시간: <span className="font-medium text-foreground">{formatHoursMinutes(today.minutes)}</span> · {comparison}
    </p>
  );
}

// 리포트를 보러 왔을 때 클릭 없이 바로 근무 시간이 보이도록 자동 로드(기존엔 "확인하기"를 눌러야만 나왔음)
function WorkHoursSection() {
  const [days, setDays] = useState<WorkHoursDay[] | null>(null);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    api.getWorkHoursHistory(14).then((res) => setDays(res.days));
  }, []);

  const workedDays = days?.filter((d) => d.minutes > 0) ?? [];
  const totalMinutes = workedDays.reduce((sum, d) => sum + d.minutes, 0);
  const averageMinutes = workedDays.length > 0 ? Math.round(totalMinutes / workedDays.length) : 0;
  const todayMinutes = days?.[days.length - 1]?.minutes ?? 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
      <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/40">Work Hours</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">근무 시간 현황</h2>
        </div>
        {days && (
          <button
            type="button"
            onClick={() => setShowChart((v) => !v)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground/70 hover:bg-black/[.03]"
          >
            {showChart ? "그래프 숨기기" : "그래프 보기"}
          </button>
        )}
      </div>

      {days && (
        <div className="pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-foreground/50">오늘</p>
              <p className="text-sm font-semibold text-foreground">{formatHoursMinutes(todayMinutes)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-foreground/50">근무일 평균</p>
              <p className="text-sm font-semibold text-foreground">{formatHoursMinutes(averageMinutes)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-foreground/50">목표</p>
              <p className="text-sm font-semibold text-foreground">{formatHoursMinutes(STANDARD_WORKDAY_MINUTES)}</p>
            </div>
          </div>
          {showChart && (
            <div className="mt-4">
              <WorkHoursChart days={days} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// 주간·월간 누적 리포트 — 상단 탭(주간/월간)에서 선택한 range를 받아 바로 로드해서 보여준다
function PeriodReportView({ range }: { range: PeriodRange }) {
  const [data, setData] = useState<PeriodReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getPeriodReport(range));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      await api.devBackfillDay();
      await load();
    } finally {
      setBackfilling(false);
    }
  };

  const backfillButton = (
    <button
      type="button"
      onClick={handleBackfill}
      disabled={backfilling}
      className="rounded-md border border-dashed border-amber-400 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
    >
      {backfilling ? "추가 중..." : "테스트용 지난 하루 추가 (개발용)"}
    </button>
  );

  const rangeTitle = range === "week" ? "주간 리포트" : "월간 리포트";

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm md:p-10">
      <header className="flex items-start justify-between gap-4 border-b-2 border-foreground/10 pb-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/40">Cumulative Report</p>
          <h1 className="mt-1.5 text-xl font-bold text-foreground">{rangeTitle}</h1>
        </div>
      </header>

      <div className="pt-5">
        {loading && <p className="text-sm text-foreground/50">불러오는 중...</p>}

        {!loading && data && !data.available && (
          <div className="space-y-2">
            <p className="text-sm text-foreground/50">아직 {data.rangeLabel} 동안의 기록이 부족해요.</p>
            {backfillButton}
          </div>
        )}

        {!loading && data?.available && (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-foreground/40">
                {data.rangeLabel} · {data.daysCount}일치 기록 종합
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{data.headline}</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">{data.narrative}</p>
            </div>
            {!!data.strengths?.length && (
              <ReportSection index="01" title="잘한 점" tone="success">
                <NumberedList items={data.strengths} tone="success" />
              </ReportSection>
            )}
            {!!data.recurring_issues?.length && (
              <ReportSection index="02" title="반복되는 교정 포인트" tone="warning">
                <NumberedList items={data.recurring_issues} tone="warning" />
              </ReportSection>
            )}
            {!!data.recommended_focus?.length && (
              <ReportSection index="03" title="다음에 집중하면 좋을 것" tone="pending">
                <NumberedList items={data.recommended_focus} tone="pending" />
              </ReportSection>
            )}
            {backfillButton}
          </div>
        )}
      </div>
    </section>
  );
}

function dateStringDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const MAX_DAYS_BACK = 30;

// 일간 업무일지(퇴근 후 생성) — 퇴근 전이면 안내 문구. daysAgo>0이면 이미 저장된 과거 daily_reports를 조회
function DailyReportView() {
  const { report: todayReport, refresh } = useWorkday();
  const [daysAgo, setDaysAgo] = useState(0);
  const [pastReport, setPastReport] = useState<WorkdayReport | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

  // 퇴근 처리 후 "리포트 준비됨" 푸시를 눌러 들어오면, 앱이 이미 떠 있던 상태에서 받은
  // 스냅샷(아직 퇴근 전으로 캐싱된 상태)이 그대로 보여서 리포트가 안 뜨는 것처럼 보일 수 있다 —
  // 이 화면에 들어올 때마다 최신 상태를 강제로 한 번 더 받아온다
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (daysAgo === 0) return;
    let cancelled = false;
    setLoadingPast(true);
    api.getDailyReportForDate(dateStringDaysAgo(daysAgo)).then((res) => {
      if (cancelled) return;
      setPastReport(res.available && res.report ? res.report : null);
      setLoadingPast(false);
    });
    return () => {
      cancelled = true;
    };
  }, [daysAgo]);

  const report = daysAgo === 0 ? todayReport : pastReport;

  const dayNav = (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
      <button
        type="button"
        onClick={() => setDaysAgo((d) => Math.min(d + 1, MAX_DAYS_BACK))}
        className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-black/[.03]"
      >
        ◀ 이전
      </button>
      <span className="text-xs font-medium text-foreground/50">{daysAgo === 0 ? "오늘" : `${daysAgo}일 전`}</span>
      <button
        type="button"
        onClick={() => setDaysAgo((d) => Math.max(d - 1, 0))}
        disabled={daysAgo === 0}
        className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-black/[.03] disabled:opacity-30"
      >
        다음 ▶
      </button>
    </div>
  );

  if (daysAgo > 0 && loadingPast) {
    return (
      <div>
        {dayNav}
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          불러오는 중...
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div>
        {dayNav}
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          {daysAgo === 0 ? "아직 퇴근 전입니다. 퇴근하면 오늘의 업무일지가 이곳에 생성됩니다." : "이 날짜엔 기록된 리포트가 없어요."}
        </p>
      </div>
    );
  }

  const keyPhrases = report.keyPhrases ?? [];
  const difficultExpressions = report.difficultExpressions ?? [];

  const hasPage2 = !!report.registerFeedback?.length || difficultExpressions.length > 0;

  return (
    <div>
      {dayNav}
      {/* 한 장에 다 몰아넣으면 문장별 피드백이 잘 안 보인다는 피드백 반영 — 총평/상세를 두 장으로 나눠
          데스크탑에서는 나란히, 모바일에서는 위아래로 자연스럽게 쌓이게 함 */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <article className="rounded-xl border border-border bg-surface p-6 shadow-sm md:p-10">
          <header className="flex items-start justify-between gap-4 border-b-2 border-foreground/10 pb-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/40">
                Daily Performance Report
              </p>
              <h1 className="mt-1.5 text-xl font-bold text-foreground">일간 리포트 · 총평</h1>
            </div>
            <div className="shrink-0 text-right text-xs text-foreground/50">
              <p>{report.date}</p>
              <p className="mt-0.5">WorkMate English</p>
            </div>
          </header>

          {daysAgo === 0 && (
            <div className="mt-4">
              <ReportWorkHoursLine />
            </div>
          )}

          <dl className="my-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
            <div className="px-3 py-3 text-center">
              <dt className="text-xs text-foreground/50">잘한 점</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{report.goodExpressions.length}건</dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs text-foreground/50">교정 내용</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{report.improvementPoints.length}건</dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs text-foreground/50">필수 암기</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{keyPhrases.length}건</dd>
            </div>
          </dl>

          <div className="space-y-6">
            <ReportSection index="01" title="잘한 표현" tone="success">
              {report.goodExpressions.length > 0 ? (
                <GoodExpressionList items={report.goodExpressions} />
              ) : (
                <p className="text-sm text-foreground/40">오늘은 특별히 기록된 잘한 점이 없습니다.</p>
              )}
            </ReportSection>

            <ReportSection index="02" title="교정 내용" tone="warning">
              {report.improvementPoints.length > 0 ? (
                <CorrectionList items={report.improvementPoints} />
              ) : (
                <p className="text-sm text-foreground/40">오늘은 교정할 표현이 없습니다.</p>
              )}
            </ReportSection>

            <ReportSection index="03" title="필수 암기 사항" tone="pending">
              {keyPhrases.length > 0 ? (
                <KeyExpressionList items={keyPhrases} />
              ) : (
                <p className="text-sm text-foreground/40">오늘 새로 암기할 표현이 없습니다.</p>
              )}
            </ReportSection>

            <ReportSection index="04" title="총평" tone="neutral">
              <p className="text-sm leading-relaxed text-foreground/90">{report.summary}</p>
            </ReportSection>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-surface p-6 shadow-sm md:p-10">
          <header className="border-b-2 border-foreground/10 pb-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/40">
              Daily Performance Report
            </p>
            <h1 className="mt-1.5 text-xl font-bold text-foreground">일간 리포트 · 상세</h1>
          </header>

          <div className="mt-6 space-y-6">
            {!!report.registerFeedback?.length && (
              <ReportSection index="05" title="관계별 표현 비교 — 오늘 대화 다시보기" tone="neutral">
                <div className="space-y-3">
                  {report.registerFeedback.map((item) => (
                    <div key={item.role} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold text-foreground/50">{REGISTER_ROLE_LABEL[item.role]}</p>
                      <div className="mt-2 space-y-1.5">
                        <div>
                          <span className="text-xs font-medium text-foreground/40">상대 → </span>
                          <span className="text-sm text-foreground/80">&ldquo;{item.their_quote}&rdquo;</span>
                          <p className="mt-0.5 text-xs text-foreground/40">{item.their_quote_ko}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-foreground/40">나 → </span>
                          <span className="text-sm text-foreground/80">&ldquo;{item.user_quote}&rdquo;</span>
                        </div>
                      </div>
                      <p className="mt-2 border-t border-border pt-2 text-sm leading-relaxed text-foreground/90">{item.note}</p>
                    </div>
                  ))}
                </div>
              </ReportSection>
            )}

            {difficultExpressions.length > 0 && (
              <ReportSection index="06" title="오늘 어려웠던 표현" tone="warning">
                <ul className="space-y-3">
                  {difficultExpressions.map((item, index) => (
                    <li key={index} className="rounded-lg border border-border bg-black/[.02] p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground/60">{item.contactName}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item.hintLevel === "sentence"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.hintLevel === "sentence" ? "영작 힌트까지 봄" : "단어 힌트까지 봄"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-foreground/50">{item.originalMessage}</p>
                      <p className="mt-1 text-sm text-foreground/90">{item.yourReply}</p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {!hasPage2 && (
              <p className="text-sm text-foreground/40">오늘은 상세 페이지에 기록할 내용이 없습니다.</p>
            )}
          </div>

          <footer className="mt-8 rounded-lg bg-black/[.02] p-4">
            <p className="text-xs font-medium text-foreground/50">내일 이어질 내용</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{report.nextPreview}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}

type ReportView = "daily" | "week" | "month";

const REPORT_TABS: { key: ReportView; label: string }[] = [
  { key: "daily", label: "일간" },
  { key: "week", label: "주간" },
  { key: "month", label: "월간" },
];

export function ReportsPage() {
  const [view, setView] = useState<ReportView>("daily");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      {/* 제목 옆 탭 — 스크롤 없이 일간/주간/월간 리포트를 바로 전환 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">영어 업무일지</h1>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                view === tab.key ? "bg-accent text-white" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {view === "daily" && <DailyReportView />}
      {view === "week" && <PeriodReportView range="week" />}
      {view === "month" && <PeriodReportView range="month" />}

      <WorkHoursSection />
    </div>
  );
}
