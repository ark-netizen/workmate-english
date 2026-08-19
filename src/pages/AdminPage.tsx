// 관리자 대시보드 — 가입 계정/출결/반차·연차/외근 이탈/메시지 수신 현황.
// admin_role이 'full'|'readonly'인 계정만 접근 가능(백엔드에서 검증). 로그인 상태와 무관하게 /admin으로 항상 진입 가능.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserCheck, LogOut, MessageCircle, HeartHandshake, Star, ChevronDown, Plus, Minus, Download, TrendingUp, Award, XCircle, Home, Globe, type LucideIcon } from "lucide-react";
import * as api from "@/lib/api";
import { useBusinessMode } from "@/context/useBusinessMode";
import { getStoredBusinessMode } from "@/lib/businessModePref";
import { signOut } from "@/lib/auth";
import type { AdminDashboardResponse, AdminUserRow, SurveyQuestion, SurveySource as SurveySourceKey } from "@/types/api";

function StatePill({ label, count }: { label: string; count: number }) {
  if (!count) return null;
  return (
    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-foreground/60">
      {label} {count}
    </span>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  onClick,
  active,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
      </span>
      <div className="min-w-0 text-left">
        <p className="text-xs text-foreground/50">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-3 rounded-xl border bg-surface p-4 text-left transition-colors hover:bg-black/[.03] ${
          active ? "border-accent ring-1 ring-accent" : "border-border"
        }`}
      >
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">{content}</div>;
}

// 채도 낮은 비즈니스 톤 팔레트(원색 대신 톤다운) — business-mode 테마의 크림·틸 느낌과 어울리게
const DONUT_COLORS: Record<string, string> = {
  COMMUTING: "#5a7d9a",
  WORKING: "#5aa89a",
  OFF_DUTY: "#c99a52",
  DONE: "#9a9690",
  ON_LEAVE: "#b97a94",
  HALF_DAY: "#8d7aa6",
};

function AttendanceDonut({ byState }: { byState: Record<string, number> }) {
  const entries = Object.entries(byState).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
        {total === 0
          ? null
          : entries.map(([state, value]) => {
              const fraction = value / total;
              const dash = fraction * circumference;
              const offset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <circle
                  key={state}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={DONUT_COLORS[state] || "#94a3b8"}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 50 50)"
                />
              );
            })}
        <text x="50" y="54" textAnchor="middle" className="fill-foreground text-[16px] font-bold">
          {total}
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {entries.length === 0 && <p className="text-xs text-foreground/40">데이터 없음</p>}
        {entries.map(([state, value]) => (
          <div key={state} className="flex items-center gap-1.5 text-xs text-foreground/60">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[state] || "#94a3b8" }} />
            {state} {value}
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupBarChart({ users }: { users: AdminUserRow[] }) {
  const days = useMemo(() => {
    const today = new Date();
    const buckets: { label: string; date: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      buckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, date: iso, value: 0 });
    }
    for (const u of users) {
      const day = u.created_at.slice(0, 10);
      const bucket = buckets.find((b) => b.date === day);
      if (bucket) bucket.value += 1;
    }
    return buckets;
  }, [users]);

  const max = Math.max(...days.map((d) => d.value), 1);

  return (
    <div className="flex h-32 items-end gap-3">
      {days.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-medium text-foreground/50">{d.value || ""}</span>
          <div
            className="w-full rounded-t-md bg-accent/80"
            style={{ height: `${Math.max((d.value / max) * 90, d.value > 0 ? 6 : 2)}px` }}
          />
          <span className="text-[10px] text-foreground/40">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function UserTable({
  users,
  columns,
  role,
  onDelete,
  deletingId,
}: {
  users: AdminUserRow[];
  columns: { label: string; render: (u: AdminUserRow) => React.ReactNode }[];
  role: "full" | "readonly";
  onDelete: (u: AdminUserRow) => void;
  deletingId: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-foreground/50">
            <th className="px-3 py-2 font-medium">이름 / 이메일</th>
            {columns.map((c) => (
              <th key={c.label} className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
            {role === "full" && <th className="px-3 py-2 font-medium">관리</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <p className="font-medium">{u.display_name || "(이름 없음)"}</p>
                <p className="text-xs text-foreground/40">{u.email || `체험(${u.id.slice(0, 8)})`}</p>
              </td>
              {columns.map((c) => (
                <td key={c.label} className="px-3 py-2 text-xs text-foreground/60">
                  {c.render(u)}
                </td>
              ))}
              {role === "full" && (
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDelete(u)}
                    disabled={deletingId === u.id}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === u.id ? "삭제 중..." : "삭제"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CATEGORIES = [
  { id: "account", label: "계정 · 업종/직무 · 영어수준" },
  { id: "attendance", label: "출결 · 반차/연차 · 이탈" },
  { id: "risk", label: "이탈 위험 신호" },
  { id: "promotion", label: "승급 현황" },
  { id: "policy", label: "승급·연차 정책" },
  { id: "cs", label: "CS 관련" },
  { id: "survey", label: "설문조사" },
] as const;

// 외근 반복/미응답 누적으로 "고함항아리" 위로 메시지가 뜬 횟수를 이탈 위험 신호로 간주
function riskTier(stressPingCount: number): { label: string; className: string } {
  if (stressPingCount >= 3) return { label: "높음", className: "bg-red-100 text-red-700" };
  if (stressPingCount >= 1) return { label: "주의", className: "bg-amber-100 text-amber-700" };
  return { label: "낮음", className: "bg-foreground/5 text-foreground/40" };
}

type CategoryId = (typeof CATEGORIES)[number]["id"];

export function AdminPage() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId>("account");
  const { setBusinessMode } = useBusinessMode();
  const navigate = useNavigate();

  // 관리자 페이지에는 모드 전환 UI가 없어, 방문 전 상태와 무관하게 항상 기본 테마(흰 배경 + 파란 포인트)를
  // 강제한다 — "비즈니스 모드"는 크림톤 배경이라 오히려 흰 대시보드 느낌과는 반대라 여기선 끈다.
  // 이건 이 페이지에서만 쓰는 임시 표시일 뿐이라 localStorage에는 저장하지 않고, 나갈 때 사용자가
  // 원래 저장해둔 취향으로 되돌려서 다른 페이지로 이동해도 그 취향이 유지되게 한다.
  useEffect(() => {
    setBusinessMode(false);
    return () => {
      setBusinessMode(getStoredBusinessMode() ?? true);
    };
  }, [setBusinessMode]);

  // 우상단 3버튼: 로그아웃(이 화면에 남아 권한 없음 상태 확인용) / 홈(학습 페이지로, 로그인 유지)
  // / 서비스 소개 페이지(로그아웃 후 게스트 랜딩으로)
  const handleAdminLogout = async () => {
    await signOut();
    window.location.reload();
  };
  const handleGoHome = () => navigate("/");
  const handleGoIntro = async () => {
    await signOut();
    navigate("/intro");
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminDashboard();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (row: AdminUserRow) => {
    if (!window.confirm(`${row.display_name || row.email || row.id} 계정을 정말 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeletingId(row.id);
    try {
      await api.deleteAdminUser(row.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 중 문제가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="font-pretendard mx-auto max-w-6xl px-4 py-10 text-sm text-foreground/50">불러오는 중...</div>;
  }
  if (error) {
    return <div className="font-pretendard mx-auto max-w-6xl px-4 py-10 text-sm text-red-600">{error}</div>;
  }
  if (!data) return null;

  const realAccounts = data.users.filter((u) => !!u.email).length;
  // "1분 체험하기"는 익명 세션만 만들 뿐 가입이 아니므로, 이메일 없는(=아직 실계정 전환 안 한) 행은 가입 수에서 분리해서 본다
  const trialOnlyVisitors = data.users.filter((u) => !u.email).length;
  const totalFieldWork = data.users.reduce((s, u) => s + u.fieldWorkCount, 0);
  const totalStressPings = data.users.reduce((s, u) => s + u.stressPingCount, 0);
  const atRiskUsers = data.users
    .filter((u) => u.stressPingCount > 0)
    .sort((a, b) => b.stressPingCount - a.stressPingCount);
  const totalMessages = data.users.reduce((s, u) => s + u.messages.total, 0);
  const combinedAttendance = data.users.reduce<Record<string, number>>((acc, u) => {
    for (const [state, count] of Object.entries(u.attendanceByState)) acc[state] = (acc[state] || 0) + count;
    return acc;
  }, {});

  return (
    <div className="font-pretendard mx-auto flex max-w-7xl gap-6 px-4 py-8">
      <div className="fixed right-3 top-3 z-40 flex gap-1.5">
        <button
          type="button"
          onClick={handleGoHome}
          title="학습하는 페이지(홈)로 이동 — 로그인 상태 유지"
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground/60 shadow-sm hover:bg-black/[.03]"
        >
          <Home className="h-3.5 w-3.5" />
          홈으로
        </button>
        <button
          type="button"
          onClick={handleGoIntro}
          title="로그아웃 후 서비스 소개(랜딩) 페이지로 이동"
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground/60 shadow-sm hover:bg-black/[.03]"
        >
          <Globe className="h-3.5 w-3.5" />
          소개 페이지로
        </button>
        <button
          type="button"
          onClick={handleAdminLogout}
          title="로그아웃 (이 화면에 남아 권한 없음 상태를 확인할 수 있어요)"
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-red-600 shadow-sm hover:bg-red-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          로그아웃
        </button>
      </div>

      <aside className="w-44 shrink-0 space-y-1">
        <h1 className="mb-3 px-2 text-sm font-semibold">관리자 대시보드</h1>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
              category === cat.id ? "bg-accent/10 font-medium text-accent" : "text-foreground/60 hover:bg-black/[.03]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground/50">
            권한: {data.role === "full" ? "조회+삭제 가능" : "조회만 가능"} · 마지막 갱신 {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03]"
          >
            새로고침
          </button>
        </div>

        {category === "account" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} iconBg="bg-accent/10" iconColor="text-accent" label="총 가입 계정" value={realAccounts} />
              <StatCard icon={UserCheck} iconBg="bg-accent/10" iconColor="text-accent" label="1분 체험 방문(미가입)" value={trialOnlyVisitors} />
              <StatCard icon={LogOut} iconBg="bg-foreground/5" iconColor="text-foreground/60" label="외근 이탈 총합" value={totalFieldWork} />
              <StatCard icon={MessageCircle} iconBg="bg-foreground/5" iconColor="text-foreground/60" label="전체 메시지 수" value={totalMessages} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="mb-4 text-sm font-medium text-foreground/70">최근 7일 가입 추이</p>
              <SignupBarChart users={data.users.filter((u) => !!u.email)} />
            </div>
            <UserTable
              users={data.users}
              role={data.role}
              deletingId={deletingId}
              onDelete={handleDelete}
              columns={[
                { label: "구분", render: (u) => (u.email ? "실계정" : "체험") },
                { label: "가입일", render: (u) => u.created_at.slice(0, 10) },
                { label: "업종", render: (u) => u.industry || "-" },
                { label: "직무", render: (u) => u.job_role || "-" },
                { label: "영어 수준", render: (u) => u.english_level || "-" },
              ]}
            />
          </>
        )}

        {category === "attendance" && (
          <>
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="mb-4 text-sm font-medium text-foreground/70">전체 출결 상태 분포</p>
              <AttendanceDonut byState={combinedAttendance} />
            </div>
            <UserTable
              users={data.users}
              role={data.role}
              deletingId={deletingId}
              onDelete={handleDelete}
              columns={[
                {
                  label: "출결",
                  render: (u) => (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(u.attendanceByState).map(([state, count]) => (
                        <StatePill key={state} label={state} count={count} />
                      ))}
                    </div>
                  ),
                },
                {
                  label: "반차·연차·취소",
                  render: (u) => `반차 ${u.leave.halfDay} · 연차 ${u.leave.annual} · 취소 ${u.leave.cancel}`,
                },
                { label: "외근 이탈 횟수", render: (u) => `${u.fieldWorkCount}회` },
                { label: "고함항아리 위로 발송", render: (u) => `${u.stressPingCount}일` },
              ]}
            />
          </>
        )}

        {category === "risk" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={LogOut}
                iconBg="bg-foreground/5"
                iconColor="text-foreground/60"
                label="외근 이탈 총합"
                value={totalFieldWork}
              />
              <StatCard
                icon={HeartHandshake}
                iconBg="bg-foreground/5"
                iconColor="text-foreground/60"
                label="고함항아리 위로 메시지 발송(스트레스 신호 감지)"
                value={totalStressPings}
              />
              <StatCard
                icon={Users}
                iconBg="bg-red-100"
                iconColor="text-red-600"
                label="위험 신호 감지된 계정 수"
                value={atRiskUsers.length}
              />
            </div>
            <p className="text-xs text-foreground/50">
              외근 미루기 행동이 반복되면(하루 2회 이상) 사용자가 바쁜 상태라고 판단해 "고함항아리" 위로 메시지를
              하루 한 번 선제 발송해요 — 스트레스/이탈 위험 신호로 볼 수 있어요. 신호 감지 횟수가 많은 순으로
              정렬됩니다. (미응답 연락 누적 기반 감지는 아직 구현 전이에요.)
            </p>
            {atRiskUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground/50">
                아직 위험 신호가 감지된 계정이 없어요.
              </div>
            ) : (
              <UserTable
                users={atRiskUsers}
                role={data.role}
                deletingId={deletingId}
                onDelete={handleDelete}
                columns={[
                  {
                    label: "위험도",
                    render: (u) => {
                      const tier = riskTier(u.stressPingCount);
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tier.className}`}>
                          {tier.label}
                        </span>
                      );
                    },
                  },
                  { label: "고함항아리 위로 발송", render: (u) => `${u.stressPingCount}일` },
                  { label: "외근 이탈 횟수", render: (u) => `${u.fieldWorkCount}회` },
                  { label: "가입일", render: (u) => u.created_at.slice(0, 10) },
                ]}
              />
            )}
          </>
        )}

        {category === "promotion" && <PromotionSection users={data.users} />}

        {category === "policy" && <PolicySection />}

        {category === "cs" && <CsSection data={data} onChanged={load} />}

        {category === "survey" && <SurveySection data={data} onChanged={load} />}
      </div>
    </div>
  );
}

// 승급 현황 — 승급한 사람 / 승급 대상(아직 안 함) / 중도 포기(평가 시작 후 미제출)
function promotionStatusBadge(p: NonNullable<AdminUserRow["promotion"]>) {
  if (p.atTop) return { label: "최고 직급", className: "bg-foreground/5 text-foreground/50" };
  if (p.inProgress) return { label: "중도 포기(진행중)", className: "bg-red-100 text-red-700" };
  if (p.eligible) return { label: "승급 대상", className: "bg-emerald-100 text-emerald-700" };
  return { label: "근무 중", className: "bg-blue-100 text-blue-700" };
}

type PromotionFilter = "all" | "promoted" | "eligible" | "dropout";

function PromotionSection({ users }: { users: AdminUserRow[] }) {
  const [filter, setFilter] = useState<PromotionFilter>("all");
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);

  const withInfo = users.filter((u) => u.promotion);
  const isPromoted = (u: AdminUserRow) => (u.promotion?.promotionCount ?? 0) > 0;
  const isEligible = (u: AdminUserRow) => !!u.promotion?.eligible && !u.promotion?.inProgress;
  const isDropout = (u: AdminUserRow) => !!u.promotion?.inProgress;

  const promoted = withInfo.filter(isPromoted).length;
  const eligibleWaiting = withInfo.filter(isEligible).length;
  const dropouts = withInfo.filter(isDropout).length;

  const filtered = withInfo.filter((u) => {
    if (filter === "promoted") return isPromoted(u);
    if (filter === "eligible") return isEligible(u);
    if (filter === "dropout") return isDropout(u);
    return true;
  });

  const toggle = (f: PromotionFilter) => setFilter((cur) => (cur === f ? "all" : f));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Award}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          label="승급한 사람(1회 이상)"
          value={promoted}
          onClick={() => toggle("promoted")}
          active={filter === "promoted"}
        />
        <StatCard
          icon={TrendingUp}
          iconBg="bg-accent/10"
          iconColor="text-accent"
          label="승급 대상(아직 안 함)"
          value={eligibleWaiting}
          onClick={() => toggle("eligible")}
          active={filter === "eligible"}
        />
        <StatCard
          icon={XCircle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          label="중도 포기(평가 미제출)"
          value={dropouts}
          onClick={() => toggle("dropout")}
          active={filter === "dropout"}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-foreground/50">
          위 항목을 누르면 해당하는 사람만 아래에 보여요. 직급별 필요 근무일은 누적 증가(사원→주임 30일, 주임→대리 60일 …),
          승급 후 0부터 다시 카운트됩니다. 계정을 누르면 그 사람이 인사평가에서 입력한 내용을 볼 수 있어요.
        </p>
        {filter !== "all" && (
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03]"
          >
            전체보기
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-foreground/50">
              <th className="px-3 py-2 font-medium">이름 / 이메일</th>
              <th className="px-3 py-2 font-medium">현재 직급</th>
              <th className="px-3 py-2 font-medium">승급 횟수</th>
              <th className="px-3 py-2 font-medium">연속출근 / 필요일</th>
              <th className="px-3 py-2 font-medium">연차(직급+적립)</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-foreground/40">
                  해당하는 사용자가 없어요.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const p = u.promotion!;
                const badge = promotionStatusBadge(p);
                return (
                  <tr
                    key={u.id}
                    onClick={() => setDetailUser(u)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-black/[.03]"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{u.display_name || "(이름 없음)"}</p>
                      <p className="text-xs text-foreground/40">{u.email || `체험(${u.id.slice(0, 8)})`}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground/70">{p.currentRank}</td>
                    <td className="px-3 py-2 text-xs text-foreground/60">{p.promotionCount}회</td>
                    <td className="px-3 py-2 text-xs text-foreground/60">
                      {p.atTop ? "-" : `${p.workdaysSincePromo} / ${p.requiredDays}일`}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground/60">
                      {p.rankLeaveBalance}+{p.earnedLeaveBalance}개
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {detailUser && <PromotionDetailModal user={detailUser} onClose={() => setDetailUser(null)} />}
    </>
  );
}

// 계정 클릭 시 — 그 사람이 인사평가에서 입력한 내용(대화상대 만족도/개선제안 + 역량평가 문답)
function PromotionDetailModal({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const evaluations = user.promotion?.evaluations ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">{user.display_name || "(이름 없음)"} · 인사평가 제출 내용</h2>
          <p className="text-xs text-foreground/40">{user.email || `체험(${user.id.slice(0, 8)})`}</p>
        </div>

        {evaluations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-foreground/50">
            아직 제출한 인사평가가 없어요.
          </p>
        ) : (
          <div className="space-y-5">
            {evaluations.map((ev, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {ev.fromRank} → <span className="text-accent">{ev.toRank}</span>
                  </p>
                  <p className="text-xs text-foreground/40">{new Date(ev.createdAt).toLocaleString("ko-KR")}</p>
                </div>

                {ev.personaFeedback.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground/50">대화 상대 평가</p>
                    {ev.personaFeedback.map((f, i) => (
                      <div key={i} className="rounded-md bg-black/[.02] p-2.5">
                        <p className="text-sm">
                          {f.name}{" "}
                          <span className="text-amber-500">
                            {"★".repeat(f.satisfaction)}
                            <span className="text-foreground/15">{"★".repeat(Math.max(0, 5 - f.satisfaction))}</span>
                          </span>
                        </p>
                        {f.suggestion && <p className="mt-1 text-xs text-foreground/70">개선 제안 · {f.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {ev.qna.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground/50">역량평가 답변</p>
                    {ev.qna.map((q, i) => (
                      <div key={i} className="rounded-md bg-black/[.02] p-2.5">
                        <p className="whitespace-pre-line text-xs text-foreground/60">Q{i + 1}. {q.prompt}</p>
                        <p className="mt-1 text-sm text-foreground/90">{q.answer || <span className="text-foreground/30">(미작성)</span>}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground/60 hover:bg-black/[.03]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

const POLICY_RANKS = ["사원", "주임", "대리", "과장", "차장", "부장", "이사"];
const POLICY_STEPS = [
  { from: "사원", to: "주임", days: 30 },
  { from: "주임", to: "대리", days: 60 },
  { from: "대리", to: "과장", days: 90 },
  { from: "과장", to: "차장", days: 120 },
  { from: "차장", to: "부장", days: 150 },
  { from: "부장", to: "이사", days: 180 },
];
const POLICY_RANK_LEAVE: Record<string, number> = { 사원: 2, 주임: 3, 대리: 4, 과장: 5, 차장: 6, 부장: 7, 이사: 8 };

interface PolicySectionData {
  id: string;
  title: string;
  keywords: string;
  render: () => React.ReactNode;
}

const POLICY_SECTIONS: PolicySectionData[] = [
  {
    id: "policy-ranks",
    title: "직급 체계",
    keywords: "직급 체계 사원 주임 대리 과장 차장 부장 이사 랭크 rank",
    render: () => <p>{POLICY_RANKS.join(" → ")} (이사가 최고 직급, 더 이상 승급 없음)</p>,
  },
  {
    id: "policy-promotion",
    title: "승급 조건",
    keywords: "승급 조건 연속 출근일수 consecutive_days 필요일 30 60 90 120 150 180",
    render: () => (
      <>
        <p>직급별로 필요한 연속 출근일수가 30일씩 증가합니다. 하루라도 커버 안 된 결석이 있으면 0으로 리셋됩니다.</p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <tbody>
              {POLICY_STEPS.map((s) => (
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
      </>
    ),
  },
  {
    id: "policy-leave",
    title: "연차",
    keywords: "연차 직급 연차 적립 연차 rank_leave_balance earned_leave_balance 게이지",
    render: () => (
      <>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <span className="font-medium text-foreground">직급 연차(rank_leave_balance)</span> — 승급 시 이전 값을
            버리고 새 직급 개수로 교체됩니다.
          </li>
          <li>
            <span className="font-medium text-foreground">적립 연차(earned_leave_balance)</span> — 연속 출근 5일마다
            자동 +1(consecutive_days % 5 === 0 시점). 승급해도 유지됩니다.
          </li>
        </ul>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <tbody>
              {POLICY_RANKS.map((rank) => (
                <tr key={rank} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground/70">{rank}</td>
                  <td className="px-3 py-2 text-right font-medium">{POLICY_RANK_LEAVE[rank]}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "policy-absence",
    title: "결석 처리",
    keywords: "결석 자동 처리 평일 주말 recordDailyAttendance startWorkday 리셋",
    render: () => (
      <>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>직급 연차(rank_leave_balance) 1개 차감 — 남아있으면 연속 출근일수 유지</li>
          <li>없으면 적립 연차(earned_leave_balance) 1개 차감 — 역시 연속 출근일수 유지</li>
          <li>
            둘 다 0이면 consecutive_days를 0으로 리셋(진행 중이던 5일 게이지도 함께 사라짐). 이미 적립 완료된
            연차는 그대로 유지됨.
          </li>
        </ol>
        <p className="text-xs text-foreground/50">
          server/promotion.js의 recordDailyAttendance에서 처리 — 출근(startWorkday) 시점에 정산됨. 평일만 해당,
          주말은 결석으로 안 침.
        </p>
      </>
    ),
  },
  {
    id: "policy-evaluation",
    title: "인사평가",
    keywords: "인사평가 만족도 역량평가 LLM 승진 무조건",
    render: () => (
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>동료/상사/거래처 각각 만족도(별점) + 개선 제안(선택) 수집</li>
        <li>유저의 교정 이력/약점 데이터 기반 LLM 역량평가 문제 3개 생성</li>
        <li>제출 시 무조건 승진(합/불 판정 없음) — 연속 출근일수 0으로, 직급 연차 새 개수로 교체</li>
      </ol>
    ),
  },
  {
    id: "policy-persona-identity",
    title: "동료·상사·거래처 정체성 고정·리셋",
    keywords: "동료 상사 거래처 이름 성격 고정 리셋 pending_persona_reset 새로운 사람 처음부터",
    render: () => (
      <>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            온보딩에서는 이름을 따로 입력받지 않는다 — 최초 출근일에 LLM이 생성한 동료/상사/거래처 이름이 그 자리에서
            프로필(colleague_name 등)에 자동 저장되어, 둘째 날부터는 같은 이름으로 고정 생성된다(설정 안 건드려도
            "매일 다른 사람" 방지).
          </li>
          <li>Settings의 동료·상사·거래처 카드에서 이름·성격을 언제든 직접 수정할 수 있다.</li>
          <li>
            <span className="font-medium text-foreground">성격을 바꾸면</span>(이름 변경 여부 무관) 다음 출근일부터
            해당 역할은 완전히 새로운 사람으로 취급 — 어제까지의 기억(workday_memories)이 그 역할에는 이어지지
            않고, 처음 만나는 것처럼 대화가 시작된다.
          </li>
          <li>
            <span className="font-medium text-foreground">이름만 바꾸고 성격은 그대로면</span> 저장 시 "새로
            시작"(성격 변경과 동일하게 리셋) / "이름만 바꾸기"(그동안 쌓인 스토리 연속성 유지, 표시 이름만 교체)
            중 선택하는 확인창이 뜬다.
          </li>
          <li>
            리셋 대상 역할은 pending_persona_reset(배열)에 쌓아뒀다가 다음 출근일 시나리오 생성 시 한 번 반영되고
            자동으로 비워진다(소진형 — 매일 리셋되는 게 아니라 딱 그 다음 하루만 "첫 만남"으로 취급).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "policy-notification",
    title: "알림·연락 스케줄링",
    keywords: "알림 연락 스케줄링 발송 시각 출퇴근시간 알림횟수 랜덤 크론 cron-job.org",
    render: () => (
      <>
        <p>
          발송은 외부 무료 크론 핑 서비스(cron-job.org 등)가 5분 간격으로{" "}
          <code className="rounded bg-black/[.04] px-1 py-0.5 text-xs">/api/cron/dispatch</code>를 호출해서 처리한다
          (Vercel Hobby 자체 크론은 하루 1회 제약이라 우회). 기존 "앱 열려있을 때 따라잡기" 로직은 안전망으로 유지.
        </p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>온보딩에서 예상 출근/퇴근시간(start_time/end_time)과 하루 알림 횟수(기본 3, 범위 3~6)를 입력받는다.</li>
          <li>
            설정(Settings)의 동료·상사·거래처 카드에서 역할별 알림 시각을 직접 지정할 수 있다. 지정 안 하면
            자동 계산: 시작 = max(접속 시각+10분, 출근시간+10분), 간격 = (퇴근시간−30분 − 시작) ÷
            (알림횟수−1), 단 최소 60분/최대 3시간으로 캡. 그래도 촉박하면 최소 5분 간격으로 붙여서라도 전부
            표시.
          </li>
          <li>
            알림횟수가 3을 초과하는 만큼은 동료/상사/거래처 중 매일 무작위로 추가 배정(오늘은 동료 2회, 내일은
            거래처 2회 식). 추가분은 새 사건이 아니라 오늘 사건에 대한 후속 체크인 메시지로 처리.
          </li>
          <li>
            Settings에서 오늘의 출근/퇴근 예상시간을 바꾸면, 아직 발송 전인 오늘의 알림들은 위 계산식을 새
            시간 기준으로 다시 돌려 시각을 즉시 재조정한다(이미 발송된 건은 그대로 유지). 역할별로 직접
            지정한 알림 시각이 있으면 그 값은 그대로 유지된다.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "policy-review",
    title: "힌트 난이도 · 복습",
    keywords: "힌트 난이도 복습 단어힌트 영작 빈칸채우기 리포트 어려웠던 표현",
    render: () => (
      <>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-foreground/50">
              <th className="px-3 py-2 font-medium">사용한 힌트</th>
              <th className="px-3 py-2 font-medium">판정</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-foreground/70">한국어 힌트까지만 (또는 없음)</td>
              <td className="px-3 py-2">정상 — 복습 대상 아님</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-foreground/70">단어 힌트까지</td>
              <td className="px-3 py-2">Tier 1 (약간 어려움)</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-foreground/70">영어 문장(영작) 힌트까지</td>
              <td className="px-3 py-2">Tier 2 (많이 어려움)</td>
            </tr>
          </tbody>
        </table>
        <p>
          복습은 당일 1회 + 익일 1회, 총 2회로 종료(망각곡선상 24시간 이내가 가장 효과적이고, 매일 새 시나리오가
          나오는 서비스 특성상 예전 문제를 계속 우려먹지 않기 위함).
        </p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Tier 1: 당일 "영작해보기"(힌트 없이) → 익일 "영작해보기"(동일 문제 재도전)</li>
          <li>Tier 2: 당일 "빈칸채우기"(정답 문장 핵심 표현 빈칸) → 익일 "영작해보기"(빈칸 없이 완전히 스스로)</li>
          <li>
            당일 복습 발송 시각: 답장 후 2시간 뒤, 단 퇴근시간−30분을 넘기면 그 시각으로 당김, 이미 지났으면
            당일 생략(익일만 진행). 하루 중 여러 건이 어려워도 당일 복습 큐는 최대 1건만.
          </li>
          <li>전달 방식 — 당일: "오늘의 연락" 목록에 항목 추가 / 익일: 홈 화면 배너</li>
          <li>완료 처리: 정답 여부와 무관하게 제출하면 완료 (채점이 아니라 재상기가 목적)</li>
          <li>데일리 리포트에 "오늘 어려웠던 표현" 섹션으로 원문 메시지·힌트 단계·정답 문장을 정리해서 보여줌</li>
        </ul>
        <p className="text-xs text-foreground/50">
          하루 알림 총량 = (유저 설정) 오늘의 연락 3~6건 + 당일 복습 최대 1건. 익일 복습은 알림이 아니라 홈 화면
          배너라 이 총량에는 안 들어감.
        </p>
      </>
    ),
  },
];

// 관리자 전용 — 승급/연차 정책 상세(내부 구현 규칙 포함, 필드명 포함). 유저용 요약은 /notice 페이지 참고.
function PolicySection() {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matchedIds = query
    ? new Set(POLICY_SECTIONS.filter((s) => (s.title + " " + s.keywords).toLowerCase().includes(query)).map((s) => s.id))
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
          placeholder="정책 내용 검색 (예: 연차, 결석, 인사평가...)"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {POLICY_SECTIONS.map((s) => (
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
        {POLICY_SECTIONS.map((s) => (
          <div
            key={s.id}
            id={s.id}
            className={`scroll-mt-4 space-y-2 py-4 first:pt-0 last:pb-0 ${
              matchedIds && !matchedIds.has(s.id) ? "opacity-30" : ""
            }`}
          >
            <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
            <div className="space-y-2 text-sm leading-relaxed text-foreground/80">{s.render()}</div>
          </div>
        ))}
      </div>

      <p className="border-t border-border pt-3 text-xs text-foreground/40">
        유저에게 보여지는 요약본은 서비스 내 좌측 네비게이션 → 공지사항(/notice) 페이지를 참고하세요.
      </p>
    </div>
  );
}

function CsSection({ data, onChanged }: { data: AdminDashboardResponse; onChanged: () => Promise<void> }) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const openCount = data.supportInquiries.filter((i) => i.status === "open").length;

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await api.adminResolveInquiry(id);
      await onChanged();
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <>
      <StatCard
        icon={MessageCircle}
        iconBg="bg-amber-100"
        iconColor="text-amber-700"
        label="처리 대기 중인 문의"
        value={openCount}
      />
      {data.supportInquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground/50">
          아직 접수된 CS 문의가 없어요. 우측 하단 챗봇 "문의 남기기"로 접수된 내용이 여기 쌓여요.
        </div>
      ) : (
        <div className="space-y-2">
          {data.supportInquiries.map((inquiry) => (
            <div key={inquiry.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-foreground/40">
                    {inquiry.display_name || inquiry.email || `체험(${inquiry.user_id.slice(0, 8)})`} ·{" "}
                    {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                  </p>
                  <p className="mt-1 text-sm text-foreground/90">{inquiry.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      inquiry.status === "open" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {inquiry.status === "open" ? "대기" : "처리완료"}
                  </span>
                  {data.role === "full" && inquiry.status === "open" && (
                    <button
                      type="button"
                      onClick={() => handleResolve(inquiry.id)}
                      disabled={resolvingId === inquiry.id}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground/60 hover:bg-black/[.03] disabled:opacity-50"
                    >
                      {resolvingId === inquiry.id ? "처리 중..." : "처리완료로"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-foreground/15">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  banner: "배너",
  chat_preset: "챗봇·예시질문",
  chat_freeform: "챗봇·자유질문",
  chat_inquiry: "챗봇·문의남기기",
};

type SortColumn = "name" | "source" | "rating" | "created_at";
type SortDir = "asc" | "desc";

function SortableTh({
  label,
  column,
  sortColumn,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDir: SortDir;
  onSort: (column: SortColumn) => void;
}) {
  const active = sortColumn === column;
  return (
    <th className="px-3 py-2 font-medium">
      <button type="button" onClick={() => onSort(column)} className="flex items-center gap-1 hover:text-foreground/80">
        {label}
        <span className={active ? "text-foreground/60" : "text-foreground/20"}>{active && sortDir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadResponsesCsv(responses: AdminDashboardResponse["responses"], questions: SurveyQuestion[]) {
  const header = ["작성자", "이메일", "출처", "회차", "별점", "후기", ...questions.map((_, i) => `추가질문${i + 1}`), "작성일시"];
  const rows = responses.map((r) => [
    r.display_name || "",
    r.email || "",
    SOURCE_LABEL[r.source] || r.source,
    String(r.occurrence),
    String(r.rating),
    r.review || "",
    ...questions.map((_, i) => r.answers?.[i] || ""),
    new Date(r.created_at).toLocaleString("ko-KR"),
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `설문응답_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SurveySection({ data, onChanged }: { data: AdminDashboardResponse; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState(data.survey?.title ?? "부캐영어 만족도 조사");
  const [description, setDescription] = useState(data.survey?.description ?? "");
  const [questions, setQuestions] = useState<SurveyQuestion[]>(data.survey?.questions ?? []);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionPlaceholder, setNewQuestionPlaceholder] = useState("");
  const [editorOpen, setEditorOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [togglingReviews, setTogglingReviews] = useState(false);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(null);
  const [featuringResponse, setFeaturingResponse] = useState<(typeof data.responses)[number] | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sourceFilter, setSourceFilter] = useState<"all" | SurveySourceKey>("all");
  const [ratingFilter, setRatingFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");

  const canSave = data.role === "full";
  const published = data.survey?.published ?? false;
  const reviewsPublic = data.survey?.reviews_public ?? false;
  const avgOf = (rows: typeof data.responses) =>
    rows.length > 0 ? (rows.reduce((sum, r) => sum + r.rating, 0) / rows.length).toFixed(1) : "-";
  const bannerResponses = data.responses.filter((r) => r.source === "banner");
  const chatResponses = data.responses.filter((r) => r.source !== "banner");
  const bannerAverage = avgOf(bannerResponses);
  const chatAverage = avgOf(chatResponses);

  const sortedResponses = useMemo(() => {
    let rows = data.responses.filter((r) => sourceFilter === "all" || r.source === sourceFilter);
    if (ratingFilter !== "all") rows = rows.filter((r) => r.rating === Number(ratingFilter));
    rows = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    const nameOf = (r: (typeof rows)[number]) => r.display_name || r.email || "";
    rows.sort((a, b) => {
      if (sortColumn === "rating") return (a.rating - b.rating) * dir;
      if (sortColumn === "name") return nameOf(a).localeCompare(nameOf(b)) * dir;
      if (sortColumn === "source") return (SOURCE_LABEL[a.source] || a.source).localeCompare(SOURCE_LABEL[b.source] || b.source) * dir;
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    });
    return rows;
  }, [data.responses, sortColumn, sortDir, sourceFilter, ratingFilter]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDir(column === "rating" || column === "created_at" ? "desc" : "asc");
    }
  };

  const surveyQuestions = data.survey?.questions ?? [];
  const featuredCount = data.responses.filter((r) => r.featured).length;

  const handleSave = async () => {
    // 질문 입력창에 텍스트를 써두고 "+"(추가)를 안 누른 채 바로 "내용 저장"을 누르는 경우가 있어서,
    // 입력창에 남아있는 텍스트가 있으면 저장 시 자동으로 질문 목록에 포함시킨다
    const pendingText = newQuestionText.trim();
    const finalQuestions = pendingText
      ? [...questions, { text: pendingText, placeholder: newQuestionPlaceholder.trim() }]
      : questions;
    setSaving(true);
    try {
      await api.adminSaveSurvey({ title, description, questions: finalQuestions });
      if (pendingText) {
        setQuestions(finalQuestions);
        setNewQuestionText("");
        setNewQuestionPlaceholder("");
      }
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장 중 문제가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // "+" 버튼은 목록에 넣기만 하고 "내용 저장"을 따로 눌러야만 반영되는 2단계 구조라 혼동을 줬음(질문을
  // 추가해도 실제 DB엔 저장 안 되는 문제) — 추가/삭제/수정 즉시 자동으로 서버에 저장하도록 변경
  const persistQuestions = async (next: SurveyQuestion[]) => {
    if (!canSave) return;
    setSaving(true);
    try {
      await api.adminSaveSurvey({ title, description, questions: next });
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "질문 저장 중 문제가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const next = [...questions, { text: newQuestionText.trim(), placeholder: newQuestionPlaceholder.trim() }];
    setQuestions(next);
    setNewQuestionText("");
    setNewQuestionPlaceholder("");
    persistQuestions(next);
  };

  const handleRemoveQuestion = (index: number) => {
    const next = questions.filter((_, i) => i !== index);
    setQuestions(next);
    persistQuestions(next);
  };

  const handlePublishToggle = async () => {
    setPublishing(true);
    try {
      await api.adminPublishSurvey(!published);
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
    } finally {
      setPublishing(false);
    }
  };

  const handleReviewsPublicToggle = async () => {
    setTogglingReviews(true);
    try {
      await api.adminSetReviewsPublic(!reviewsPublic);
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
    } finally {
      setTogglingReviews(false);
    }
  };

  // 체크(노출 켜기)는 편집 팝업에서 최종 확인해야 실제로 반영됨. 체크 해제(노출 끄기)는 바로 처리.
  const handleFeaturedToggle = async (row: (typeof data.responses)[number], checked: boolean) => {
    if (checked) {
      setFeaturingResponse(row);
      return;
    }
    setTogglingFeaturedId(row.id);
    try {
      await api.adminSetResponsePublicDisplay(row.id, { featured: false });
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
    } finally {
      setTogglingFeaturedId(null);
    }
  };

  const handleConfirmFeature = async (publicReview: string, publicDisplayName: string) => {
    if (!featuringResponse) return;
    setTogglingFeaturedId(featuringResponse.id);
    try {
      await api.adminSetResponsePublicDisplay(featuringResponse.id, { featured: true, publicReview, publicDisplayName });
      await onChanged();
      setFeaturingResponse(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
    } finally {
      setTogglingFeaturedId(null);
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={MessageCircle}
          iconBg={published ? "bg-emerald-100" : "bg-foreground/5"}
          iconColor={published ? "text-emerald-600" : "text-foreground/40"}
          label="응답 수집 상태"
          value={published ? "수집 중" : "미노출(초안)"}
        />
        <StatCard icon={Users} iconBg="bg-accent/10" iconColor="text-accent" label="누적 응답 수" value={data.responses.length} />
        <StatCard
          icon={Star}
          iconBg="bg-accent/10"
          iconColor="text-accent"
          label={`평균 별점(배너, ${bannerResponses.length}건)`}
          value={bannerAverage}
        />
        <StatCard
          icon={Star}
          iconBg="bg-foreground/5"
          iconColor="text-foreground/60"
          label={`평균 별점(챗봇, ${chatResponses.length}건)`}
          value={chatAverage}
        />
      </div>
      <p className="-mt-2 text-xs text-foreground/40">
        챗봇에서 남긴 응답은 이미 불만이 있는 상태에서 쓰는 경우가 많아, 배너 응답과 평균을 분리해서 봐요.
      </p>

      <div className="rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setEditorOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-medium text-foreground/70">설문 내용 작성 · 수정 (별점 + 한 줄 후기 고정 형식 + 추가 질문)</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${editorOpen ? "rotate-180" : ""}`} />
        </button>

        {editorOpen && (
          <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
            <label className="block space-y-1 text-xs text-foreground/50">
              제목
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
                placeholder="예: 부캐영어 만족도 조사"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canSave}
              />
            </label>
            <label className="block space-y-1 text-xs text-foreground/50">
              설명(선택)
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
                placeholder="예: 1분이면 끝나요! 소중한 의견 들려주세요."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canSave}
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs text-foreground/50">
                추가 질문(선택 · 별점/후기 외에 더 물어보고 싶은 내용) — 질문 내용과, 답변란에 미리 보여줄
                유도 문구(placeholder)를 각각 입력/수정할 수 있어요.
              </p>
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border p-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground/80 outline-none disabled:opacity-70"
                      placeholder="질문 내용"
                      value={q.text}
                      disabled={!canSave}
                      onChange={(e) =>
                        setQuestions((prev) => prev.map((existing, idx) => (idx === i ? { ...existing, text: e.target.value } : existing)))
                      }
                      onBlur={(e) => {
                        if (!e.target.value.trim()) return;
                        persistQuestions(
                          questions.map((existing, idx) => (idx === i ? { ...existing, text: e.target.value.trim() } : existing)),
                        );
                      }}
                    />
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-xs text-foreground/60 outline-none disabled:opacity-70"
                      placeholder="답변란 유도 문구(선택) — 예: 어떤 상황에서 가장 도움이 되었나요?"
                      value={q.placeholder}
                      disabled={!canSave}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((existing, idx) => (idx === i ? { ...existing, placeholder: e.target.value } : existing)),
                        )
                      }
                      onBlur={(e) =>
                        persistQuestions(
                          questions.map((existing, idx) => (idx === i ? { ...existing, placeholder: e.target.value } : existing)),
                        )
                      }
                    />
                  </div>
                  {canSave && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(i)}
                      className="flex shrink-0 items-center justify-center rounded-md border border-border p-1.5 text-foreground/60 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      aria-label="질문 삭제"
                      title="이 질문 삭제"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {canSave && (
                <div className="flex items-start gap-2 rounded-md border border-dashed border-border p-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
                      placeholder="새 질문 내용"
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-xs outline-none"
                      placeholder="답변란 유도 문구(선택) — 예: 어떤 상황에서 가장 도움이 되었나요?"
                      value={newQuestionPlaceholder}
                      onChange={(e) => setNewQuestionPlaceholder(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddQuestion();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    disabled={!newQuestionText.trim()}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03] disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    추가
                  </button>
                </div>
              )}
            </div>

            {canSave && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/70 hover:bg-black/[.03] disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "내용 저장"}
                </button>
                <button
                  type="button"
                  onClick={handlePublishToggle}
                  disabled={publishing || !data.survey}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                    published ? "bg-foreground/60 hover:opacity-90" : "bg-accent hover:opacity-90"
                  }`}
                >
                  {publishing ? "처리 중..." : published ? "응답 수집 중지" : "반영(응답 수집 시작)"}
                </button>
                <button
                  type="button"
                  onClick={handleReviewsPublicToggle}
                  disabled={togglingReviews || !data.survey || (!reviewsPublic && featuredCount === 0)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                    reviewsPublic ? "bg-foreground/60 hover:opacity-90" : "bg-violet-600 hover:opacity-90"
                  }`}
                >
                  {togglingReviews
                    ? "처리 중..."
                    : reviewsPublic
                      ? "소개 페이지 노출 중지"
                      : "노출 활성화(체크한 후기만 소개 페이지에 공개)"}
                </button>
                {!reviewsPublic && featuredCount === 0 && (
                  <span className="text-xs text-foreground/40">
                    아래 응답 목록에서 공개할 후기를 먼저 체크하면 활성화돼요.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground/70">응답 목록</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as "all" | SurveySourceKey)}
              className="rounded-md border border-border bg-transparent px-2 py-1.5 text-xs text-foreground/70 outline-none"
            >
              <option value="all">출처 전체</option>
              <option value="banner">배너</option>
              <option value="chat_preset">챗봇·예시질문</option>
              <option value="chat_freeform">챗봇·자유질문</option>
              <option value="chat_inquiry">챗봇·문의남기기</option>
            </select>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as typeof ratingFilter)}
              className="rounded-md border border-border bg-transparent px-2 py-1.5 text-xs text-foreground/70 outline-none"
            >
              <option value="all">별점 전체</option>
              <option value="5">★5</option>
              <option value="4">★4</option>
              <option value="3">★3</option>
              <option value="2">★2</option>
              <option value="1">★1</option>
            </select>
            <button
              type="button"
              onClick={() => downloadResponsesCsv(sortedResponses, surveyQuestions)}
              disabled={data.responses.length === 0}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              엑셀 다운로드
            </button>
          </div>
        </div>

        {data.responses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground/50">
            아직 응답이 없어요.
          </div>
        ) : sortedResponses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground/50">
            선택한 조건에 맞는 응답이 없어요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-foreground/50">
                  <th className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">
                    소개 페이지
                    <br />
                    노출
                  </th>
                  <SortableTh label="작성자" column="name" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="출처" column="source" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="별점" column="rating" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2 font-medium">후기</th>
                  <SortableTh label="작성일시" column="created_at" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedResponses.map((r) => (
                  <tr key={r.id} className="border-b border-border align-top last:border-0">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.featured}
                        disabled={!canSave || !r.review || togglingFeaturedId === r.id}
                        onChange={(e) => handleFeaturedToggle(r, e.target.checked)}
                        className="h-4 w-4"
                        title={!r.review ? "후기가 있어야 노출할 수 있어요" : undefined}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground/60">
                      {r.display_name || r.email || `체험(${r.user_id.slice(0, 8)})`}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.source === "banner" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {SOURCE_LABEL[r.source] || r.source}
                        {r.source !== "banner" && ` · ${r.occurrence}번째`}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StarDisplay rating={r.rating} />
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground/90">
                      <p>
                        <span className="text-xs font-medium text-foreground/40">후기 · </span>
                        {r.review || <span className="text-foreground/30">-</span>}
                      </p>
                      {r.answers && r.answers.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {r.answers.map((a, i) =>
                            a ? (
                              <p key={i} className="text-xs text-foreground/70">
                                <span className="font-medium text-foreground/40">
                                  질문{i + 1}{surveyQuestions[i]?.text ? `(${surveyQuestions[i].text})` : ""} ·{" "}
                                </span>
                                {a}
                              </p>
                            ) : null,
                          )}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground/40">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {featuringResponse && (
        <FeatureReviewModal
          response={featuringResponse}
          submitting={togglingFeaturedId === featuringResponse.id}
          onClose={() => setFeaturingResponse(null)}
          onConfirm={handleConfirmFeature}
        />
      )}
    </>
  );
}

function maskedDefaultName(displayName: string | null): string {
  if (!displayName) return "이용자";
  return `${displayName.slice(0, 1)}**`;
}

function FeatureReviewModal({
  response,
  submitting,
  onClose,
  onConfirm,
}: {
  response: AdminDashboardResponse["responses"][number];
  submitting: boolean;
  onClose: () => void;
  onConfirm: (publicReview: string, publicDisplayName: string) => void;
}) {
  const [publicReview, setPublicReview] = useState(response.public_review || response.review || "");
  const [publicDisplayName, setPublicDisplayName] = useState(
    response.public_display_name || maskedDefaultName(response.display_name),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">소개 페이지 노출 전 최종 확인</h2>
          <p className="mt-1 text-xs text-foreground/50">
            실제 이름·이메일 등 개인정보는 노출되지 않아요. 아래 작성자 표기와 후기 문구를 확인하고, 특정 가능한
            정보(회사명·이름·연락처 등)가 있다면 지우거나 마스킹한 뒤 확정해주세요.
          </p>
        </div>

        <label className="block space-y-1 text-xs text-foreground/60">
          노출될 작성자 표기(비식별)
          <input
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
            value={publicDisplayName}
            onChange={(e) => setPublicDisplayName(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-xs text-foreground/60">
          노출될 후기 문구
          <textarea
            rows={4}
            className="mt-1 w-full resize-none rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
            value={publicReview}
            onChange={(e) => setPublicReview(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:bg-black/[.03]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(publicReview.trim(), publicDisplayName.trim() || "이용자")}
            disabled={submitting || !publicReview.trim()}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "저장 중..." : "확인하고 노출"}
          </button>
        </div>
      </div>
    </div>
  );
}
