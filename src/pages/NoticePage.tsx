import { useState } from "react";
import type { ReactNode } from "react";
import { TrialLockedPage } from "@/components/trial/TrialLockedPage";
import { useWorkday } from "@/context/useWorkday";

// 공지사항 — 승급/연차 규정. 실제 사규 형식(조항 구성)으로 안내한다.
const RANKS = ["사원", "주임", "대리", "과장", "차장", "부장", "이사"];
const PROMOTION_STEPS = [
  { from: "사원", to: "주임", days: 30 },
  { from: "주임", to: "대리", days: 60 },
  { from: "대리", to: "과장", days: 90 },
  { from: "과장", to: "차장", days: 120 },
  { from: "차장", to: "부장", days: 150 },
  { from: "부장", to: "이사", days: 180 },
];
const RANK_LEAVE: Record<string, number> = { 사원: 2, 주임: 3, 대리: 4, 과장: 5, 차장: 6, 부장: 7, 이사: 8 };

interface RegulationSection {
  id: string;
  number: string;
  title: string;
  keywords: string;
  render: () => ReactNode;
}

const REGULATION_SECTIONS: RegulationSection[] = [
  {
    id: "notice-ranks",
    number: "제1조",
    title: "직급 체계",
    keywords: "직급 체계 사원 주임 대리 과장 차장 부장 이사",
    render: () => (
      <>
        <p>
          직급은 사원, 주임, 대리, 과장, 차장, 부장, 이사의 7단계로 구성한다. 이사는 최고 직급으로 하며, 이사에
          도달한 이후에는 별도의 승급을 진행하지 아니한다.
        </p>
        <p className="text-foreground/60">{RANKS.join(" → ")}</p>
      </>
    ),
  },
  {
    id: "notice-promotion",
    number: "제2조",
    title: "승급 요건",
    keywords: "승급 요건 조건 연속 출근일수 30 60 90 120 150 180",
    render: () => (
      <>
        <p>
          승급은 연속 출근일수를 기준으로 한다. 직급별 필요 연속 출근일수는 다음과 같으며, 상위 직급으로 갈수록
          30일씩 증가한다.
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-foreground/50">
                <th className="px-3 py-2 font-medium">승급 구간</th>
                <th className="px-3 py-2 text-right font-medium">필요 연속 출근일수</th>
              </tr>
            </thead>
            <tbody>
              {PROMOTION_STEPS.map((s) => (
                <tr key={s.to} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground/70">
                    {s.from} → {s.to}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{s.days}일</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>필요 연속 출근일수를 충족한 자는 제3조에 따른 인사평가에 응시할 수 있다.</p>
      </>
    ),
  },
  {
    id: "notice-evaluation",
    number: "제3조",
    title: "인사평가 절차",
    keywords: "인사평가 절차 만족도 역량평가 평가",
    render: () => (
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>대화 상대(동료·상사·거래처) 각각에 대한 만족도 평가 및 개선 제안(선택)을 제출한다.</li>
        <li>그간의 이용 수준에 맞추어 산출된 역량평가 문항 3개에 응답한다.</li>
        <li>
          위 절차를 완료하여 제출하면 다음 직급으로 승급한다. 본 평가는 합격·불합격을 가리는 시험이 아니라 성장
          기록을 위한 절차임을 명시한다.
        </li>
      </ol>
    ),
  },
  {
    id: "notice-leave",
    number: "제4조",
    title: "연차의 구분",
    keywords: "연차 직급 연차 적립 연차 종류 구분",
    render: () => (
      <>
        <p>연차는 다음 각 호와 같이 두 가지로 구분하여 관리한다.</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <span className="font-medium text-foreground">직급 연차</span> — 현재 직급을 기준으로 부여되는 연차로,
            승급 시 이전 잔여분은 소멸하고 새 직급 기준 개수로 재산정한다.
          </li>
          <li>
            <span className="font-medium text-foreground">적립 연차</span> — 연속 출근 실적에 따라 자동으로
            적립되는 연차로, 승급 이후에도 소멸하지 아니하고 계속 유지한다.
          </li>
        </ul>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-foreground/50">
                <th className="px-3 py-2 font-medium">직급</th>
                <th className="px-3 py-2 text-right font-medium">직급 연차</th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((rank) => (
                <tr key={rank} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground/70">{rank}</td>
                  <td className="px-3 py-2 text-right font-medium">{RANK_LEAVE[rank]}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "notice-absence",
    number: "제5조",
    title: "결석 처리",
    keywords: "결석 처리 평일 주말 출근",
    render: () => (
      <>
        <p>평일 출근하지 아니한 경우 다음 각 호의 순서에 따라 처리한다.</p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>보유한 연차가 있는 경우 자동으로 1개를 차감하여 결석을 갈음하며, 연속 출근일수는 유지한다.</li>
          <li>
            보유한 연차가 없는 상태에서 결석한 경우 연속 출근일수를 0으로 초기화한다. 다만 이미 적립이 완료된
            연차는 소멸하지 아니한다.
          </li>
        </ol>
        <p className="text-xs text-foreground/50">
          단서. 주말은 결석으로 처리하지 아니하며, 주말에 출근한 경우 연속 출근일수에 정상 반영한다.
        </p>
      </>
    ),
  },
];

interface Announcement {
  id: string;
  date: string;
  title: string;
  body: string;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-promotion-policy",
    date: "2026.07.28",
    title: "승급·연차 제도 개편 안내",
    body: "연속 출근일수 기반 승급 제도와 직급 연차·적립 연차 제도가 도입되었습니다. 자세한 내용은 사규 탭을 확인해주세요.",
  },
  {
    id: "ann-service-open",
    date: "2026.07.01",
    title: "부캐영어(WorkMate English) 오픈",
    body: "실전 업무 상황으로 영어를 연습하는 부캐영어 서비스가 열렸습니다. 동료·상사·거래처와의 대화로 하루를 시작해보세요.",
  },
];

function RegulationTab() {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matchedIds = query
    ? new Set(
        REGULATION_SECTIONS.filter((s) => (s.title + " " + s.keywords).toLowerCase().includes(query)).map(
          (s) => s.id,
        ),
      )
    : null;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="사규 검색 (예: 연차, 결석, 인사평가...)"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {REGULATION_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                matchedIds && !matchedIds.has(s.id)
                  ? "border-border text-foreground/30"
                  : "border-border text-foreground/70 hover:bg-black/[.03]"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border">
        {REGULATION_SECTIONS.map((s) => (
          <div
            key={s.id}
            id={s.id}
            className={`scroll-mt-4 space-y-2 py-4 first:pt-0 last:pb-0 ${
              matchedIds && !matchedIds.has(s.id) ? "opacity-30" : ""
            }`}
          >
            <h2 className="text-sm font-semibold text-foreground">
              <span className="text-foreground/40">{s.number}</span> ({s.title})
            </h2>
            <div className="space-y-2 text-sm leading-relaxed text-foreground/80">{s.render()}</div>
          </div>
        ))}
      </div>

      <p className="border-t border-border pt-3 text-xs text-foreground/40">
        본 규정에 관하여 문의사항이 있는 경우 관리자에게 별도로 문의하시기 바랍니다.
      </p>
    </div>
  );
}

function AnnouncementTab() {
  return (
    <div className="space-y-3">
      {ANNOUNCEMENTS.map((a) => (
        <div key={a.id} className="space-y-1.5 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs text-foreground/40">{a.date}</p>
          <h2 className="text-sm font-semibold text-foreground">{a.title}</h2>
          <p className="text-sm leading-relaxed text-foreground/70">{a.body}</p>
        </div>
      ))}
    </div>
  );
}

export function NoticePage() {
  const { isTrial } = useWorkday();
  const [tab, setTab] = useState<"announcement" | "regulation">("announcement");

  if (isTrial) return <TrialLockedPage title="공지사항" />;

  return (
    <div className="mx-auto max-w-[1230px] [zoom:1.1] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/40">Notice</p>
        <h1 className="mt-1 text-lg font-semibold">공지사항</h1>
      </div>

      <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("announcement")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === "announcement" ? "bg-accent text-white" : "text-foreground/60 hover:bg-black/[.03]"
          }`}
        >
          공지사항
        </button>
        <button
          type="button"
          onClick={() => setTab("regulation")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === "regulation" ? "bg-accent text-white" : "text-foreground/60 hover:bg-black/[.03]"
          }`}
        >
          사규
        </button>
      </div>

      {tab === "announcement" ? <AnnouncementTab /> : <RegulationTab />}
    </div>
  );
}
