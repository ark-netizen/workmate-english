import { Briefcase, Check, ChevronRight, Gamepad2, Lock } from "lucide-react";
import { RankAvatar } from "@/components/promotion/RankAvatar";
import { useBusinessMode } from "@/context/useBusinessMode";
import { setStoredBusinessMode } from "@/lib/businessModePref";
import { deriveEmployeeId } from "@/lib/employeeId";
import { industries } from "@/lib/industries";
import type { ProfileResponse } from "@/types/api";

const visibleIndustries = industries.filter((item) => item !== "기타").slice(0, 6);

export function TrialOnboardingReveal({
  profile,
  photoUrl,
  loading,
  error,
  onStart,
  onEnd,
}: {
  profile: ProfileResponse;
  photoUrl?: string | null;
  loading: boolean;
  error?: string | null;
  onStart: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
}) {
  const { businessMode, setBusinessMode } = useBusinessMode();
  // IntroPage와 동일하게 현재 코드에서는 businessMode(true)가 게임 화면을 뜻한다.
  const gameMode = businessMode;
  const employeeId = deriveEmployeeId(profile.email || profile.display_name || "");
  const rank = profile.job_rank?.trim() || "사원";
  const englishLevel = profile.english_level === "beginner" ? "초급" : profile.english_level === "advanced" ? "고급" : "중급";

  const panelClass = gameMode
    ? "border-2 border-[#28352f] bg-[#fffdf7] shadow-[4px_4px_0_rgba(40,53,47,.18)]"
    : "rounded-xl border border-[#dfe5ef] bg-white shadow-[0_10px_28px_rgba(71,98,142,.08)]";
  const fieldClass = gameMode
    ? "cursor-not-allowed border border-[#c7bfa9] bg-[#f3f0e6] text-[#4f5b55]"
    : "cursor-not-allowed border border-[#dfe5ef] bg-[#f1f4f8] text-[#64748b]";

  const selectMode = (nextGameMode: boolean) => {
    if (gameMode === nextGameMode) return;
    setBusinessMode(nextGameMode);
    setStoredBusinessMode(nextGameMode);
  };

  return (
    <div
      className={`relative min-h-dvh overflow-hidden px-4 pb-10 pt-24 md:px-8 ${
        gameMode
          ? "bg-[linear-gradient(180deg,#83cef1_0%,#cdeeff_62%,#eaf5dc_100%)]"
          : "bg-[linear-gradient(135deg,#f8fbff,#edf3ff_48%,#fff)]"
      }`}
    >
      <div className="absolute right-4 top-5 z-20 md:right-8">
        <div
          role="group"
          aria-label="모드 선택"
          className={`flex items-center gap-0.5 rounded-full border p-0.5 backdrop-blur-sm ${
            gameMode ? "border-white/50 bg-[#2f795d]/90" : "border-[#dfe5ef] bg-white/90"
          }`}
        >
          <button
            type="button"
            onClick={() => selectMode(true)}
            aria-pressed={gameMode}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              gameMode ? "bg-white text-[#2f795d]" : "text-[#64748b] hover:bg-[#f1f5f9]"
            }`}
          >
            <Gamepad2 className="size-4" strokeWidth={2} />
            <span>게임</span>
          </button>
          <button
            type="button"
            onClick={() => selectMode(false)}
            aria-pressed={!gameMode}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              !gameMode ? "bg-[#1f2328] text-white" : "text-white/75 hover:bg-white/10"
            }`}
          >
            <Briefcase className="size-4" strokeWidth={2} />
            <span>비즈니스</span>
          </button>
        </div>
      </div>

      <section
        className={`relative z-10 mx-auto w-full max-w-6xl overflow-hidden ${
          gameMode
            ? "border-[3px] border-[#28352f] bg-[#fff9e9] shadow-[9px_9px_0_rgba(40,53,47,.28)]"
            : "rounded-2xl border border-[#dfe5ef] bg-white shadow-[0_24px_60px_rgba(71,98,142,.16)]"
        }`}
      >
        <header
          className={`flex min-h-12 items-center justify-between px-4 text-xs font-black tracking-[.04em] ${
            gameMode
              ? "border-b-[3px] border-[#28352f] bg-[#2f795d] text-white"
              : "border-b border-[#e5eaf1] bg-white text-[#334155]"
          }`}
        >
          <span>WORKMATE HR · EMPLOYEE CARD ISSUED</span>
          <span
            className={`px-2 py-1 font-bold ${
              gameMode ? "border-2 border-[#28352f] bg-[#fffaf0] text-[#28352f]" : "text-[#94a3b8]"
            }`}
            aria-hidden="true"
          >
            — □ ×
          </span>
        </header>

        <div className="p-5 sm:p-7 md:p-8">
          <div
            className={`mx-auto max-w-3xl px-5 py-4 text-center ${
              gameMode
                ? "border-2 border-[#28352f] bg-[#fffaf0] shadow-[5px_5px_0_#28352f]"
                : "rounded-2xl border border-[#dbe7f6] bg-[#f8fbff] shadow-sm"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span
                className={`grid size-7 place-items-center rounded-full ${
                  gameMode ? "bg-[#2f795d] text-white" : "bg-[#e8f0ff] text-[#1a56ff]"
                }`}
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
              <h1 className={`break-keep text-lg font-black sm:text-xl ${gameMode ? "text-[#28352f]" : "text-[#11213a]"}`}>
                1분 무료체험을 위한 사원증 발급 완료!
              </h1>
            </div>
            <p className={`mt-2 text-sm ${gameMode ? "text-[#59675f]" : "text-[#657187]"}`}>
              무료체험에서는 아래 설정으로 먼저 체험해볼게요. 가입 후 온보딩에서 직접 선택할 수 있어요.
            </p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className={`p-5 ${panelClass}`}>
                <p className={`text-center text-[11px] font-black uppercase tracking-[.12em] ${gameMode ? "text-[#2f795d]" : "text-[#1a56ff]"}`}>
                  WorkMate English
                </p>
                <div className="mt-4 flex flex-col items-center text-center">
                  <div
                    className={`grid size-24 place-items-center overflow-hidden ${
                      gameMode ? "border-2 border-[#28352f] bg-[#bce5dc] shadow-[3px_3px_0_#28352f]" : "rounded-2xl bg-[#e7efff]"
                    }`}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt="체험 사용자" className="h-full w-full object-cover" />
                    ) : (
                      <RankAvatar rank={rank} className="h-full w-full" />
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <strong className={`text-xl ${gameMode ? "text-[#28352f]" : "text-[#11213a]"}`}>{profile.display_name || "체험 사용자"}</strong>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold ${
                        gameMode
                          ? "border border-[#82b9aa] bg-[#e5f5ee] text-[#2f795d]"
                          : "rounded-full bg-[#eef3ff] text-[#1a56ff]"
                      }`}
                    >
                      {rank}
                    </span>
                  </div>
                  {/* 업종·직무를 이어 붙이면 한 줄에 안 들어가는 조합이 많은데, break-keep이 없으면
                      한국어 단어 중간("담당자" → "담당"/"자")에서 끊긴다. 단어 경계에서만 줄바꿈되게 하고,
                      길면 " · " 자리에서 자연스럽게 두 줄로 넘어가도록 둔다. */}
                  <p className={`mt-2 break-keep text-sm ${gameMode ? "text-[#45584f]" : "text-[#64748b]"}`}>
                    {[profile.industry, profile.job_role].filter(Boolean).join(" · ")}
                  </p>
                  <p className={`mt-1 text-xs ${gameMode ? "text-[#7d877f]" : "text-[#94a3b8]"}`}>사번 {employeeId}</p>
                  <div
                    className="mt-4 h-4 w-36 opacity-50"
                    aria-hidden="true"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 4px,currentColor 4px 5px,transparent 5px 8px)",
                    }}
                  />
                </div>
              </div>

              <div
                className={`px-4 py-3 ${
                  gameMode
                    ? "border-2 border-[#d9a83e] bg-[#fff2bd] text-[#4a412c] shadow-[3px_3px_0_rgba(40,53,47,.18)]"
                    : "rounded-xl border border-[#dbe7f6] bg-[#f4f8ff] text-[#475569]"
                }`}
              >
                <p className={`text-xs font-black tracking-[.08em] ${gameMode ? "text-[#6a571b]" : "text-[#1a56ff]"}`}>FREE TRIAL PRESET</p>
                <p className="mt-1.5 text-xs leading-relaxed">아래 온보딩 값은 체험을 위해 미리 선택했어요.</p>
              </div>
            </aside>

            <div className={`p-4 sm:p-5 ${panelClass}`} aria-disabled="true">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-black/10 pb-3">
                <div>
                  <p className={`text-sm font-black ${gameMode ? "text-[#28352f]" : "text-[#11213a]"}`}>실제 온보딩 미리보기</p>
                  <p className={`mt-1 text-xs ${gameMode ? "text-[#6f7a73]" : "text-[#7b8799]"}`}>
                    가입 후 직접 선택하는 화면이에요. 무료체험 중에는 아래 값이 고정돼 있어요.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black ${
                    gameMode
                      ? "border border-[#9f9783] bg-[#e9e5d9] text-[#5f675f]"
                      : "rounded-full border border-[#d7dee8] bg-[#f1f4f8] text-[#64748b]"
                  }`}
                >
                  <Lock className="size-3" strokeWidth={2.5} />
                  읽기 전용 · 변경 불가
                </span>
              </div>

              <div
                className={`mb-4 flex items-center gap-2 px-3 py-2 text-xs font-bold ${
                  gameMode
                    ? "border border-[#c7bfa9] bg-[#f3f0e6] text-[#59645e]"
                    : "rounded-lg border border-[#dde3eb] bg-[#f4f6f9] text-[#64748b]"
                }`}
              >
                <Lock className="size-3.5 shrink-0" strokeWidth={2.5} />
                <span>이 화면은 선택 가능한 항목을 보여주는 미리보기예요. 값 변경은 가입 후 온보딩에서 할 수 있어요.</span>
              </div>

              <div className="grid cursor-not-allowed gap-5 md:grid-cols-2">
                <div className="space-y-4 md:border-r md:border-black/10 md:pr-5">
                  <div>
                    <p className={`text-sm font-black ${gameMode ? "text-[#28352f]" : "text-[#334155]"}`}>1. 기본 정보를 선택해주세요</p>
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                      업종
                      <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleIndustries.map((item) => {
                        const selected = item === profile.industry;
                        return (
                          <span
                            key={item}
                            className={`cursor-not-allowed px-2.5 py-1.5 text-[11px] font-medium ${
                              selected
                                ? gameMode
                                  ? "border-2 border-[#28352f] bg-[#2f795d] text-white shadow-[2px_2px_0_#28352f]"
                                  : "rounded-full border border-[#1a56ff] bg-[#eef3ff] text-[#1a56ff]"
                                : gameMode
                                  ? "border border-[#c7bfa9] bg-[#f3f0e6] text-[#7a817c] opacity-65"
                                  : "rounded-full border border-[#dfe5ef] bg-[#f1f4f8] text-[#94a3b8] opacity-70"
                            }`}
                          >
                            {item}
                          </span>
                        );
                      })}
                      <span className={`cursor-not-allowed px-2.5 py-1.5 text-[11px] ${gameMode ? "border border-[#c7bfa9] bg-[#f3f0e6] text-[#8a8f8b] opacity-65" : "rounded-full border border-[#dfe5ef] bg-[#f1f4f8] text-[#a0aaba] opacity-70"}`}>
                        +{Math.max(0, industries.length - visibleIndustries.length)}개 더
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                      직무
                      <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                    </p>
                    <div className={`px-3 py-2 text-sm ${fieldClass}`}>{profile.job_role || "유통/납품 담당자"}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className={`text-sm font-black ${gameMode ? "text-[#28352f]" : "text-[#334155]"}`}>2. 업무 및 환경을 설정해주세요</p>

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                      주요 업무
                      <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                    </p>
                    <div className={`min-h-12 px-3 py-2 text-xs leading-relaxed ${fieldClass}`}>{profile.main_tasks}</div>
                  </div>

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                      자주 소통하는 대상
                      <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                    </p>
                    <div className={`px-3 py-2 text-xs ${fieldClass}`}>{profile.contacts}</div>
                  </div>

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                      영어 난이도
                      <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                    </p>
                    <div className="flex gap-1.5">
                      {["초급", "중급", "고급"].map((level) => {
                        const selected = level === englishLevel;
                        return (
                          <span
                            key={level}
                            className={`flex-1 cursor-not-allowed px-2 py-1.5 text-center text-[11px] font-bold ${
                              selected
                                ? gameMode
                                  ? "border-2 border-[#28352f] bg-[#2f795d] text-white"
                                  : "rounded-md border border-[#1a56ff] bg-[#eef3ff] text-[#1a56ff]"
                                : gameMode
                                  ? "border border-[#c7bfa9] bg-[#f3f0e6] text-[#858b87] opacity-65"
                                  : "rounded-md border border-[#dfe5ef] bg-[#f1f4f8] text-[#94a3b8] opacity-70"
                            }`}
                          >
                            {level}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                        근무시간
                        <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                      </p>
                      <div className={`px-2.5 py-2 text-xs ${fieldClass}`}>
                        {profile.start_time || "09:00"}–{profile.end_time || "18:00"}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                        하루 알림 횟수
                        <Lock className="size-3 opacity-45" strokeWidth={2.5} />
                      </p>
                      <div className={`px-2.5 py-2 text-xs ${fieldClass}`}>{profile.daily_count || 3}회</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

          <div className={`mt-6 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end ${gameMode ? "border-[#d8cba9]" : "border-[#e5eaf1]"}`}>
            <button
              type="button"
              onClick={onEnd}
              disabled={loading}
              className={`px-6 py-3 text-sm font-black disabled:opacity-50 ${
                gameMode
                  ? "border-2 border-[#28352f] bg-[#fffaf0] text-[#28352f] shadow-[3px_3px_0_#28352f]"
                  : "rounded-full border border-[#d9e0eb] bg-white text-[#475569]"
              }`}
            >
              체험 종료
            </button>
            <button
              type="button"
              onClick={onStart}
              disabled={loading}
              className={`flex items-center justify-center gap-2 px-7 py-3 text-sm font-black disabled:opacity-50 ${
                gameMode
                  ? "border-2 border-[#28352f] bg-[#2f795d] text-white shadow-[4px_4px_0_#28352f]"
                  : "rounded-full bg-[#1a56ff] text-white shadow-[0_10px_26px_rgba(26,86,255,.2)]"
              }`}
            >
              {loading ? "불러오는 중..." : "이 설정으로 출근하기"}
              {!loading && <ChevronRight className="size-4" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
