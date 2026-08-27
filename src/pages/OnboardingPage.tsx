import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useWorkday } from "@/context/useWorkday";
import { useBusinessMode } from "@/context/useBusinessMode";
import { industries } from "@/lib/industries";
import { subscribePush } from "@/lib/push";
import { isAnonymousSession, endGuestTrial } from "@/lib/session";
import { useAvatarPhoto } from "@/hooks/useAvatarPhoto";
import { EmployeeIdCard } from "@/components/profile/EmployeeIdCard";
import { TrialOnboardingReveal } from "@/components/onboarding/TrialOnboardingReveal";
import type { EnglishLevel, ProfileResponse } from "@/types/api";

// "1분 체험하기" 게스트는 직접 입력하지 않아도 바로 다음으로 넘어갈 수 있도록 미리 채워두는 값.
// 체험은 LLM 없이 고정 대화(server/trialContent.js — 거래처 DVD 배송 건 최종 검토)를 쓰므로,
// 여기 값도 그 대화와 같은 업무여야 한다. 예전엔 IT/서비스 기획자로 채워져 있어서, 온보딩에서
// "이렇게 선택했다"고 보여준 직무와 실제로 도착하는 대화가 서로 다른 일이었다.
const TRIAL_DEFAULTS = {
  displayName: "체험 사용자",
  industry: "무역/유통·이커머스",
  jobRole: "유통/납품 담당자",
  mainTasks: "납품 일정 관리, 거래처 배송 커뮤니케이션",
  contacts: "동료, 팀장, 거래처 담당자",
};

const englishLevels: { value: EnglishLevel; label: string }[] = [
  { value: "beginner", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
];

export function OnboardingPage() {
  const { refresh } = useWorkday();
  // businessMode=true가 실제로는 "게임 모드"다(game-mode-workspace.css 주석 참고).
  // 게임 모드에선 인트로·체험 온보딩과 같은 민트로 끝나는 배경을 쓴다 — 실계정 온보딩만 게임 모드를
  // 몰라서 흰 배경으로 떨어져 있었다. 비즈니스 모드는 기존 배경(bg-background) 그대로 둔다.
  const { businessMode: gameMode } = useBusinessMode();
  const pageBgClass = gameMode ? "bg-[linear-gradient(180deg,#83cef1_0%,#cdeeff_62%,#eaf5dc_100%)]" : "";
  const [displayName, setDisplayName] = useState("");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [mainTasks, setMainTasks] = useState("");
  const [contacts, setContacts] = useState("");
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>("intermediate");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [dailyCount, setDailyCount] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedProfile, setCompletedProfile] = useState<ProfileResponse | null>(null);
  const [isTrialSession, setIsTrialSession] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const { photoUrl } = useAvatarPhoto();

  useEffect(() => {
    isAnonymousSession().then((isTrial) => {
      if (!isTrial) return;
      setDisplayName(TRIAL_DEFAULTS.displayName);
      setIndustry(TRIAL_DEFAULTS.industry);
      setJobRole(TRIAL_DEFAULTS.jobRole);
      setMainTasks(TRIAL_DEFAULTS.mainTasks);
      setContacts(TRIAL_DEFAULTS.contacts);
      setEnglishLevel("intermediate");
      setStartTime("09:00");
      setEndTime("18:00");
      setDailyCount(3);
      setIsTrialSession(true);
    });
  }, []);

  const resolvedIndustry = industry === "기타" ? customIndustry.trim() : industry;
  const draftProfile: ProfileResponse = {
    display_name: displayName.trim(),
    industry: resolvedIndustry,
    job_role: jobRole.trim(),
    main_tasks: mainTasks.trim(),
    contacts: contacts.trim(),
    english_level: englishLevel,
    start_time: startTime,
    end_time: endTime,
    daily_count: dailyCount,
  };

  const canSubmit =
    displayName.trim().length > 0 &&
    resolvedIndustry.length > 0 &&
    jobRole.trim().length > 0 &&
    mainTasks.trim().length > 0 &&
    contacts.trim().length > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const savedProfile = await api.postProfile(draftProfile);
      // "시작하기" 클릭이라는 사용자 제스처 안에서 바로 요청해야 브라우저가 알림 권한 팝업을 띄워줌
      // (페이지 로드 시 자동 호출은 대부분 브라우저에서 무시/차단됨)
      subscribePush().catch(() => {});
      // 오늘 시나리오는 LLM으로 생성돼서 몇 초 걸리는데, "시작하기"를 누른 뒤에야 시작하면 그 시간이
      // 고스란히 로딩으로 느껴진다 — 사원증 화면을 보는(어차피 몇 초 머무는) 동안 미리 백그라운드로
      // 생성을 시작해둔다. WorkdayContext.refresh()를 쓰면 needsOnboarding이 바로 꺼져 사원증
      // 화면을 건너뛰게 되므로, 컨텍스트를 안 거치는 직접 호출로 서버에서만 미리 만들어두고 결과는 버림.
      api.getTodayWorkday().catch(() => {});
      // refresh()는 사원증 리빌 화면에서 "시작하기"를 눌렀을 때 호출 — 그 전엔 온보딩 화면에 머물러야 함
      setCompletedProfile(savedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndTrial = async () => {
    await endGuestTrial();
    window.location.href = "/";
  };

  const handleEnterApp = async () => {
    if (advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "화면을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setAdvancing(false);
    }
  };

  // 체험판은 실제 폼을 직접 채우게 하지 않고, 무료체험용 preset과 실제 온보딩 선택 구조를
  // 한 화면에서 함께 보여준 뒤 시작한다. 가입 후에는 같은 항목을 사용자가 직접 고를 수 있다.
  const handleTrialContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.postProfile(draftProfile);
      subscribePush().catch(() => {});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "화면을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isTrialSession) {
    return (
      <TrialOnboardingReveal
        profile={draftProfile}
        photoUrl={photoUrl}
        loading={submitting}
        error={error}
        onStart={handleTrialContinue}
        onEnd={handleEndTrial}
      />
    );
  }

  if (completedProfile) {
    return (
      <div className={`min-h-screen w-full ${pageBgClass}`}>
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        <div>
          <h1 className="text-lg font-semibold">사원증이 발급됐어요</h1>
          <p className="mt-1 text-sm text-foreground/60">
            승급할수록 아바타 캐릭터도 늘어나요.
            <br />
            상단의 프로필을 눌러 언제든 다시 볼 수 있어요.
          </p>
        </div>
        <EmployeeIdCard profile={completedProfile} photoUrl={photoUrl} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleEnterApp}
          disabled={advancing}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {advancing ? "불러오는 중..." : "시작하기"}
        </button>
      </div>
      </div>
    );
  }

  const form = (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div>
        <h1 className="text-lg font-semibold">시작하기 전에</h1>
        <p className="mt-1 text-sm text-foreground/60">
          입력하신 정보로 오늘 하루의 업무 연락 시나리오가 만들어집니다.
        </p>
      </div>

      <div className="mt-5 space-y-5 rounded-xl border border-border bg-surface p-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium">이름</span>
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70"
            placeholder="예: 홍길동"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <span className="block text-xs text-foreground/40">거래처 이메일 등에서 이 이름으로 불려요.</span>
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">업종</p>
          <div className="flex flex-wrap gap-2">
            {industries.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setIndustry(item)}
                className={`rounded-full border px-3 py-1.5 text-sm disabled:cursor-default ${
                  industry === item
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70 hover:bg-black/[.03] disabled:hover:bg-transparent"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {industry === "기타" && (
            <input
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="업종을 입력해주세요"
              value={customIndustry}
              onChange={(e) => setCustomIndustry(e.target.value)}
            />
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">직무</span>
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70"
            placeholder="예: 서비스 기획자"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">주요 업무</span>
          <textarea
            className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70"
            rows={3}
            placeholder="예: 신규 기능 기획, 유관부서 커뮤니케이션"
            value={mainTasks}
            onChange={(e) => setMainTasks(e.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">자주 소통하는 대상</span>
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70"
            placeholder="예: 개발팀 동료, 팀장, 해외 파트너사 담당자"
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">영어 난이도</p>
          <div className="flex gap-2">
            {englishLevels.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setEnglishLevel(level.value)}
                className={`rounded-md border px-3 py-1.5 text-sm disabled:cursor-default ${
                  englishLevel === level.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70 hover:bg-black/[.03] disabled:hover:bg-transparent"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">예상 출근시간</span>
            <input
              type="time"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">예상 퇴근시간</span>
            <input
              type="time"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">하루 알림 횟수</p>
          <p className="text-xs text-foreground/50">
            기본 3회(동료·상사·거래처 각 1회)이며, 그 이상은 매일 무작위로 추가 배정돼요.
          </p>
          <div className="flex gap-2">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDailyCount(n)}
                className={`rounded-md border px-3 py-1.5 text-sm disabled:cursor-default ${
                  dailyCount === n
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70 hover:bg-black/[.03] disabled:hover:bg-transparent"
                }`}
              >
                {n}회
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          시작하기
        </button>

        {/* 온보딩은 프로필이 없으면 반드시 거치는 화면이라 나갈 문이 없다 — 여기서 막힌 것처럼
            보이지 않게, 지금 채운 값을 나중에 바꿀 수 있다는 걸 알려서 빠르게 통과하게 한다 */}
        <p className="text-center text-xs text-foreground/45">
          지금 입력한 내용은 나중에 <span className="font-medium text-foreground/60">설정</span>에서 언제든 바꿀 수 있어요.
        </p>
      </div>
    </div>
  );

  // 배경은 화면 전체를 덮어야 하므로, 가운데 정렬된 컬럼(max-w-xl)을 바깥 래퍼로 한 겹 감싼다
  return (
    <div className={`min-h-screen w-full ${pageBgClass}`}>
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center">{form}</div>
    </div>
  );
}
