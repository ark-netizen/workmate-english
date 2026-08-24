import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import * as api from "@/lib/api";
import { useWorkday } from "@/context/useWorkday";
import { industries } from "@/lib/industries";
import { subscribePush } from "@/lib/push";
import { isAnonymousSession, endGuestTrial } from "@/lib/session";
import { useAvatarPhoto } from "@/hooks/useAvatarPhoto";
import { EmployeeIdCard } from "@/components/profile/EmployeeIdCard";
import { TrialActionBar } from "@/components/trial/TrialActionBar";
import type { EnglishLevel, ProfileResponse } from "@/types/api";

// "1분 체험하기" 게스트는 직접 입력하지 않아도 바로 다음으로 넘어갈 수 있도록 미리 채워두는 값
const TRIAL_DEFAULTS = {
  displayName: "체험 사용자",
  industry: "IT/소프트웨어",
  jobRole: "서비스 기획자",
  mainTasks: "신규 기능 기획, 유관부서 커뮤니케이션",
  contacts: "동료, 팀장, 거래처 담당자",
};

const englishLevels: { value: EnglishLevel; label: string }[] = [
  { value: "beginner", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
];

const dailyCountOptions = [3, 4, 5, 6];

// "1분 체험하기"에서 실제 온보딩 폼(업종/직무/근무시간 등을 직접 설정)이 어떻게 생겼는지 그대로
// 보여주는 축소 미리보기 — 필드 구성·문구·강조 스타일까지 실제 폼과 동일하게 맞추되, 클릭은 막아둔다
function TrialOnboardingPreview() {
  return (
    <div className="mx-auto w-full max-w-xs overflow-visible rounded-xl border border-dashed border-foreground/30">
      <div className="pointer-events-none grayscale select-none space-y-4 bg-surface p-4 text-left opacity-60">
        <label className="block space-y-1">
          <span className="text-xs font-medium">이름</span>
          <input
            readOnly
            tabIndex={-1}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none"
            value={TRIAL_DEFAULTS.displayName}
          />
        </label>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">업종</p>
          <div className="flex flex-wrap gap-1.5">
            {industries.map((item) => (
              <span
                key={item}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  item === TRIAL_DEFAULTS.industry
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70"
                }`}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium">직무</span>
          <input
            readOnly
            tabIndex={-1}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none"
            value={TRIAL_DEFAULTS.jobRole}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">주요 업무</span>
          <textarea
            readOnly
            tabIndex={-1}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none"
            value={TRIAL_DEFAULTS.mainTasks}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">자주 소통하는 대상</span>
          <input
            readOnly
            tabIndex={-1}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none"
            value={TRIAL_DEFAULTS.contacts}
          />
        </label>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">영어 난이도</p>
          <div className="flex gap-1.5">
            {englishLevels.map((level) => (
              <span
                key={level.value}
                className={`rounded-md border px-2.5 py-1 text-[11px] ${
                  level.value === "intermediate"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70"
                }`}
              >
                {level.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium">예상 출근시간</span>
            <input
              readOnly
              tabIndex={-1}
              type="time"
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none"
              value="09:00"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">예상 퇴근시간</span>
            <input
              readOnly
              tabIndex={-1}
              type="time"
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none"
              value="18:00"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">하루 알림 횟수</p>
          <div className="flex gap-1.5">
            {dailyCountOptions.map((n) => (
              <span
                key={n}
                className={`rounded-md border px-2.5 py-1 text-[11px] ${
                  n === 3 ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/70"
                }`}
              >
                {n}회
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const { refresh } = useWorkday();
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
  // 체험판 온보딩 2단계: "card"(사원증만) → "detail"(사원증 위로 + 실제 폼 미리보기 아래)
  const [trialStep, setTrialStep] = useState<"card" | "detail">("card");
  const [advancing, setAdvancing] = useState(false);
  const { photoUrl } = useAvatarPhoto();
  // 사원증이 뚝 하고 갑자기 나타나는 느낌을 줄이려고, 체험판 화면임이 확정된 다음 프레임에
  // 살짝 위로 밀려 올라오며 페이드인 되게 함
  const [trialEntered, setTrialEntered] = useState(false);

  useEffect(() => {
    isAnonymousSession().then((isTrial) => {
      if (isTrial) setIsTrialSession(true);
    });
  }, []);

  useEffect(() => {
    if (!isTrialSession) return;
    const raf = requestAnimationFrame(() => setTrialEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [isTrialSession]);

  const resolvedIndustry = industry === "기타" ? customIndustry.trim() : industry;
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
      const payload: ProfileResponse = {
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
      await api.postProfile(payload);
      // "시작하기" 클릭이라는 사용자 제스처 안에서 바로 요청해야 브라우저가 알림 권한 팝업을 띄워줌
      // (페이지 로드 시 자동 호출은 대부분 브라우저에서 무시/차단됨)
      subscribePush().catch(() => {});
      // 오늘 시나리오는 LLM으로 생성돼서 몇 초 걸리는데, "시작하기"를 누른 뒤에야 시작하면 그 시간이
      // 고스란히 로딩으로 느껴진다 — 사원증 화면을 보는(어차피 몇 초 머무는) 동안 미리 백그라운드로
      // 생성을 시작해둔다. WorkdayContext.refresh()를 쓰면 needsOnboarding이 바로 꺼져 사원증
      // 화면을 건너뛰게 되므로, 컨텍스트를 안 거치는 직접 호출로 서버에서만 미리 만들어두고 결과는 버림.
      api.getTodayWorkday().catch(() => {});
      // refresh()는 사원증 리빌 화면에서 "시작하기"를 눌렀을 때 호출 — 그 전엔 온보딩 화면에 머물러야 함
      setCompletedProfile(payload);
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

  // 체험판은 폼을 직접 채우게 하지 않고, 미리 정해진 프로필로 바로 사원증을 보여준 뒤
  // (실제 온보딩 폼은 축소 미리보기로만 보여줌) 한 번에 저장+진입까지 처리한다
  const handleTrialContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: ProfileResponse = {
        display_name: TRIAL_DEFAULTS.displayName,
        industry: TRIAL_DEFAULTS.industry,
        job_role: TRIAL_DEFAULTS.jobRole,
        main_tasks: TRIAL_DEFAULTS.mainTasks,
        contacts: TRIAL_DEFAULTS.contacts,
        english_level: "intermediate",
        start_time: "09:00",
        end_time: "18:00",
        daily_count: 3,
      };
      await api.postProfile(payload);
      subscribePush().catch(() => {});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "화면을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isTrialSession) {
    const trialPreviewProfile: ProfileResponse = {
      display_name: TRIAL_DEFAULTS.displayName,
      industry: TRIAL_DEFAULTS.industry,
      job_role: TRIAL_DEFAULTS.jobRole,
    };
    const isDetailStep = trialStep === "detail";
    return (
      <div className="flex min-h-dvh flex-col">
        <div
          className={`flex flex-1 flex-col items-center px-4 pb-10 text-center transition-all duration-500 ease-out ${
            isDetailStep ? "justify-start gap-6 pt-8" : "justify-center gap-6"
          } ${trialEntered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
        >
          <h1 className="break-keep text-lg font-semibold">🎉 1분 무료체험을 위한 사원증 발급 완료!</h1>
          {/* 화살표+미리보기 칸을 항상 DOM에 두고 max-width/opacity만 트랜지션해서, "다음"을 눌렀을 때
              사원증이 순간이동하듯 옮겨가지 않고 자연스럽게 옆으로 밀리듯 보이게 함. max-h는 실제
              캡션 텍스트가 여러 줄로 접힐 때도 잘리지 않도록 넉넉하게 잡는다 */}
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <EmployeeIdCard profile={trialPreviewProfile} photoUrl={photoUrl} hideAvatarPicker />
            <div
              className={`flex flex-col items-center gap-1.5 overflow-hidden text-foreground/40 transition-all duration-500 ease-out sm:px-2 ${
                isDetailStep ? "max-h-56 opacity-100 sm:max-w-[10rem]" : "max-h-0 opacity-0 sm:max-w-0"
              }`}
            >
              <ArrowDown className="size-5 shrink-0 sm:hidden" />
              <ArrowRight className="hidden size-5 shrink-0 sm:block" />
              <p className="max-w-[10rem] break-keep text-[11px] leading-snug text-foreground/50">
                실제 서비스에서는 업종과 직무를 직접 설정할 수 있어요. 출퇴근 시간까지 반영해 나만의 사원증을 만들어요.
              </p>
            </div>
            <div
              className={`w-full overflow-hidden transition-all duration-500 ease-out sm:w-auto ${
                isDetailStep ? "max-h-[40rem] opacity-100 sm:max-w-xs" : "max-h-0 opacity-0 sm:max-w-0"
              }`}
            >
              <TrialOnboardingPreview />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <TrialActionBar
          message={isDetailStep ? "이 프로필로 오늘 하루를 체험해요" : "1분 무료체험용 사원증이 발급됐어요"}
          primaryLabel={submitting ? "불러오는 중..." : "다음"}
          primaryDisabled={submitting}
          onPrimary={isDetailStep ? handleTrialContinue : () => setTrialStep("detail")}
          onEnd={handleEndTrial}
        />
      </div>
    );
  }

  if (completedProfile) {
    return (
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
      </div>
    </div>
  );

  return <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center">{form}</div>;
}
