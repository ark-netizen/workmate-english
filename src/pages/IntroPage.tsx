// 서비스 소개(랜딩) 페이지 — 링글/말해보카류 구조 참고: 상단 네비 + 히어로(헤드라인+미리보기) + 컬러풀한 기능 카드 + 하단 CTA.
// 실제 사진 대신 우리 서비스 실제 UI를 축소한 미리보기 카드를 히어로에 배치.
// 디자인·카피는 초안 — 비주얼(폰트/애니메이션/실제 이미지)은 추후 다듬을 예정.
import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Sparkles, Building2, Bell, FileText, HeartHandshake, Star, Gamepad2, Briefcase, type LucideIcon } from "lucide-react";
import { AccountModal } from "@/components/shell/AccountModal";
import { RankAvatar } from "@/components/promotion/RankAvatar";
import { Logo } from "@/components/ui/Logo";
import { useBusinessMode } from "@/context/useBusinessMode";
import { setStoredBusinessMode } from "@/lib/businessModePref";
import * as api from "@/lib/api";
import type { PublicReview } from "@/types/api";

// 소개 페이지 하단 "실제 후기" 롤링 노출 — 관리자가 노출하기를 켠 경우에만 후기가 있으면 보여줌
function ReviewsSection() {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api.getPublicReviews().then((res) => setReviews(res.reviews)).catch(() => setReviews([]));
  }, []);

  useEffect(() => {
    if (!reviews || reviews.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % reviews.length), 4000);
    return () => clearInterval(timer);
  }, [reviews]);

  if (!reviews || reviews.length === 0) return null;
  const review = reviews[index];

  return (
    <section id="reviews" className="intro-reviews border-t border-border bg-surface px-4 py-16 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">실제 후기를 공개합니다</h2>
        <div className="intro-review-card mt-8 overflow-hidden rounded-2xl border border-border bg-background p-8">
          <div key={index} className="animate-reviewslide">
            <div className="flex justify-center text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-5" fill={i < review.rating ? "currentColor" : "none"} strokeWidth={1.5} />
              ))}
            </div>
            <p className="mt-4 text-base leading-relaxed text-foreground/80">&ldquo;{review.review}&rdquo;</p>
            <p className="mt-4 text-sm font-medium text-foreground/50">
              — {review.displayName} · {new Date(review.createdAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </div>
        {reviews.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5">
            {reviews.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`후기 ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-accent" : "w-1.5 bg-foreground/20"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// 카드마다 배경색을 다르게 칠하던 5색 팔레트가 "색이 너무 많다"는 피드백을 받아서,
// 카드 배경/테두리는 중립 톤으로 통일하고 아이콘 배지만 브랜드 컬러(accent/accent-2)로
// 절제해서 포인트를 준다.
const colorClasses = {
  accent: { bg: "bg-surface", border: "border-border", icon: "text-accent", iconBg: "bg-accent/10" },
  "accent-2": { bg: "bg-surface", border: "border-border", icon: "text-accent-2", iconBg: "bg-accent-2/10" },
  neutral: { bg: "bg-surface", border: "border-border", icon: "text-foreground/70", iconBg: "bg-foreground/10" },
};

// 기능 #1(차별점) 시각자료 — 실제 메신저 말풍선 스타일 그대로, 같은 상황을 세 가지 톤으로
function ToneExample() {
  const rows = [
    { name: "Jake", tag: "동료 · 캐주얼", line: "Can you check this by 3? 🙏" },
    { name: "Ellen", tag: "상사 · 격식", line: "Could you please review this by 3pm?" },
    { name: "Liam Carter", tag: "거래처 · 보수적", line: "We would kindly request your review by 3:00 PM." },
  ];
  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      {rows.map((r) => (
        <div key={r.name}>
          <p className="mb-1 text-xs font-medium text-foreground/40">
            {r.name} <span className="text-purple-600">· {r.tag}</span>
          </p>
          <div className="inline-block max-w-full rounded-2xl bg-black/[.04] px-4 py-2.5 text-sm text-foreground/80">
            {r.line}
          </div>
        </div>
      ))}
    </div>
  );
}

// 기능 #2 시각자료 — 온보딩 입력 → 홈 화면(오늘의 연락) 자동 생성
function ScenarioExample() {
  const contacts = [
    { initial: "J", name: "Jake", role: "동료", line: "The new feature build is ready for QA 👀" },
    { initial: "E", name: "Ellen", role: "상사", line: "Can we sync on the roadmap today?" },
    { initial: "LC", name: "Liam", role: "거래처", line: "Please confirm the integration timeline." },
  ];
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="mb-3 text-xs font-medium text-foreground/40">온보딩 입력</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
          IT/소프트웨어
        </span>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
          서비스 기획자
        </span>
      </div>
      <div className="flex items-center gap-2 text-blue-300">
        <span className="h-px flex-1 bg-blue-100" />
        <span className="text-xs">자동 생성</span>
        <span className="h-px flex-1 bg-blue-100" />
      </div>
      <p className="mt-4 mb-2 text-xs font-medium text-foreground/40">오늘의 연락 (3)</p>
      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.name} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {c.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {c.name} <span className="font-normal text-foreground/40">· {c.role}</span>
              </p>
              <p className="truncate text-xs text-foreground/50">{c.line}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 기능 #3 시각자료 — 실제 브라우저 알림처럼
function NotificationExample() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-lg">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ellen · 상사</p>
          <p className="mt-0.5 text-sm text-foreground/60">Could you please review this by 3pm today?</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2 border-t border-border pt-4">
        <span className="flex-1 rounded-full bg-pink-600 px-3 py-2 text-center text-sm font-medium text-white">
          메시지 작성하기
        </span>
        <span className="flex-1 rounded-full bg-pink-50 px-3 py-2 text-center text-sm font-medium text-pink-700">
          외근 중 · 30분 후
        </span>
      </div>
    </div>
  );
}

// 기능 #4 시각자료 — 실제 리포트 화면 스탯 카드
function ReportExample() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="mb-3 text-xs font-medium text-foreground/40">이번 주 업무일지</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "잘한 점", value: "3건" },
          { label: "교정 내용", value: "2건" },
          { label: "필수 암기", value: "4건" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-indigo-50 p-3 text-center">
            <p className="text-xs text-indigo-600/70">{s.label}</p>
            <p className="mt-1 text-lg font-bold text-indigo-700">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-foreground/60">
        "이번 주는 이메일 격식 표현이 눈에 띄게 자연스러워졌어요."
      </p>
    </div>
  );
}

// 기능 #5 시각자료 — "고함항아리": 유저가 먼저 말 걸고, 동료가 위로+표현을 함께 건네는 캐주얼 채팅
function VentExample() {
  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground/40">
        🫙 고함항아리 <span className="text-violet-600">· 업무 스트레스 풀기</span>
      </p>
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-accent px-4 py-2.5 text-sm text-white">
          Ugh, today was so busy... 오늘 진짜 바빴어
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-1 rounded-2xl bg-violet-50 px-4 py-2.5 text-sm text-foreground/80">
          <p>Same here! 😫 You've earned your rest tonight.</p>
          <p className="text-xs text-violet-600">
            (P.S. &apos;Swamped&apos; = 일에 파묻히다 — 오늘 이거 딱이네!)
          </p>
        </div>
      </div>
    </div>
  );
}

const features: {
  icon: LucideIcon;
  title: string;
  body: string;
  color: "accent" | "accent-2" | "neutral";
  Visual: ComponentType;
}[] = [
  {
    icon: Sparkles,
    color: "accent",
    title: "동료·상사·거래처, 다른 표현",
    body: "같은 상황도 상대에 따라 캐주얼·격식·보수적 톤으로 구분해 배우고, 대화가 쌓일수록 더 고도화돼요.",
    Visual: ToneExample,
  },
  {
    icon: Building2,
    color: "accent-2",
    title: "내 업종·직무 맞춤 시나리오",
    body: "업종·직무만 입력하면 나만의 동료·상사·거래처가 매일 자동으로 생겨요.",
    Visual: ScenarioExample,
  },
  {
    icon: Bell,
    color: "neutral",
    title: "놓치지 않는 웹 알림",
    body: "새 연락은 알림으로, 바쁘면 '외근 중' 버튼 하나로 미뤄요.",
    Visual: NotificationExample,
  },
  {
    icon: FileText,
    color: "accent",
    title: "하루·주간·월간 리포트",
    body: "퇴근 리포트부터 매주·매달 성장 흐름까지 정리해드려요.",
    Visual: ReportExample,
  },
  {
    icon: HeartHandshake,
    color: "accent-2",
    title: "스트레스 받을 때는, 고함항아리에 소리질러봐요!",
    body: "영어를 배우는 걸 넘어서, 영어로 솔직하게 털어놓을 수 있는 스트레스 공유 동료가 생겨요. 바쁜 하루가 감지되면 먼저 위로와 표현을 건네고, 내가 먼저 말을 걸 수도 있어요.",
    Visual: VentExample,
  },
];

// 스크롤해서 화면에 들어오면 살짝 올라오며 나타나는 효과 (IntersectionObserver)
function Reveal({ children, delayMs = 0, className }: { children: ReactNode; delayMs?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className ?? ""} ${visible ? "animate-slidein" : "opacity-0"}`}
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "backwards" }}
    >
      {children}
    </div>
  );
}

// 비즈니스 모드용 — 파스텔 컬러 카드로 기능을 스크롤하면서 하나씩 만나는 방식 (게임 모드의
// 레트로 창 스타일과 달리, 업무용 톤에 맞춘 평범한 카드 디자인)
function FeatureScrollList({ items }: { items: typeof features }) {
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ratiosRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    ratiosRef.current = items.map(() => 0);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = sectionRefs.current.findIndex((el) => el === e.target);
          if (idx !== -1) ratiosRef.current[idx] = e.intersectionRatio;
        });
        let maxIdx = 0;
        let maxRatio = 0;
        ratiosRef.current.forEach((r, i) => {
          if (r > maxRatio) {
            maxRatio = r;
            maxIdx = i;
          }
        });
        if (maxRatio > 0) setActive(maxIdx);
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], rootMargin: "-10% 0px -10% 0px" },
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const goTo = (i: number) => {
    sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="intro-business-features relative mx-auto max-w-4xl">
      <div className="space-y-8 md:space-y-12">
        {items.map((f, i) => {
          const Icon = f.icon;
          const Visual = f.Visual;
          const c = colorClasses[f.color];
          const reversed = i % 2 === 1;
          return (
            <div key={f.title} ref={(el) => { sectionRefs.current[i] = el; }} className="snap-center scroll-mt-24">
              <Reveal>
                <div
                  className={`intro-business-feature-card flex min-h-[340px] flex-col justify-center rounded-3xl border ${c.border} ${c.bg} p-5 shadow-sm transition-all duration-500 sm:grid sm:grid-cols-2 sm:items-center sm:gap-8 sm:p-7 ${
                    reversed ? "sm:[&>*:first-child]:order-2" : ""
                  } ${i === active ? "scale-100 opacity-100" : "scale-[0.96] opacity-50"}`}
                >
                  <div className="space-y-3">
                    <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${c.iconBg}`}>
                      <Icon className={`h-7 w-7 ${c.icon}`} strokeWidth={1.75} />
                    </span>
                    <p className="text-xl font-bold leading-snug">{f.title}</p>
                    <p className="text-sm leading-relaxed text-foreground/60">{f.body}</p>
                  </div>
                  <div className="mt-5 flex sm:mt-0">
                    <Visual />
                  </div>
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>

      <div className="fixed top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col gap-3 sm:right-5">
        {items.map((f, i) => (
          <button
            key={f.title}
            type="button"
            onClick={() => goTo(i)}
            aria-label={f.title}
            title={f.title}
            className={`h-2.5 rounded-full transition-all ${
              i === active ? "w-8 bg-accent" : "w-2.5 bg-foreground/20 hover:bg-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// 게임 모드 전용 — 기능 소개를 하늘/잔디 배경 위에 놓인 레트로 창 여러 개를 아래로 스크롤하며 보는 방식 —
// 각 창은 스크롤 스냅으로 하나씩 딱딱 멈추고, 우측 점 토글로도 이동 가능
function FeatureWindowScrollList({ items }: { items: typeof features }) {
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ratiosRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    ratiosRef.current = items.map(() => 0);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = sectionRefs.current.findIndex((el) => el === e.target);
          if (idx !== -1) ratiosRef.current[idx] = e.intersectionRatio;
        });
        let maxIdx = 0;
        let maxRatio = 0;
        ratiosRef.current.forEach((r, i) => {
          if (r > maxRatio) {
            maxRatio = r;
            maxIdx = i;
          }
        });
        if (maxRatio > 0) setActive(maxIdx);
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], rootMargin: "-10% 0px -10% 0px" },
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const goTo = (i: number) => {
    sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="intro-game-features relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#1a3fd8_0%,#3562e6_20%,#5a89ef_42%,#86adf5_62%,#c3ddf9_82%,#eef6fc_100%)] px-4 py-10 sm:px-8 sm:py-14">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[70px] border-t-4 border-[#2f7a24]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg,#4fae3a 0px,#4fae3a 7px,#3f9530 7px,#3f9530 14px)" }}
      />

      <div className="relative z-[1] mx-auto w-full max-w-3xl space-y-8 md:space-y-12">
        {items.map((f, i) => {
          const Icon = f.icon;
          const Visual = f.Visual;
          const c = colorClasses[f.color];
          return (
            <div key={f.title} ref={(el) => { sectionRefs.current[i] = el; }} className="snap-center scroll-mt-24">
              <div
                className={`intro-game-feature-window overflow-hidden rounded-2xl border-2 border-[#2b2b2b] bg-[#fbf3e6] shadow-[0_8px_0_rgba(0,0,0,0.25)] transition-all duration-500 ${
                  i === active ? "scale-100 opacity-100" : "scale-[0.97] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between border-b-2 border-[#2b2b2b] bg-[#5fb8b0] px-4 py-2.5">
                  <span className="text-[15px] font-bold text-[#1c3a37]">WorkMate</span>
                  <div className="flex gap-1.5">
                    <span className="flex h-5 w-[22px] items-center justify-center rounded border-[1.5px] border-[#2b2b2b] bg-[#eaf7f5] text-[11px] text-[#1c3a37]">
                      -
                    </span>
                    <span className="flex h-5 w-[22px] items-center justify-center rounded border-[1.5px] border-[#2b2b2b] bg-[#eaf7f5] text-[11px] text-[#1c3a37]">
                      □
                    </span>
                    <span className="flex h-5 w-[22px] items-center justify-center rounded border-[1.5px] border-[#2b2b2b] bg-[#f4a4a0] text-[11px] text-[#5c1c18]">
                      ×
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:items-center sm:gap-8 sm:p-8">
                  <div>
                    <div
                      className={`mb-4 flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#2b2b2b] shadow-[2px_2px_0_rgba(0,0,0,0.15)] ${c.iconBg}`}
                    >
                      <Icon className={`h-7 w-7 ${c.icon}`} strokeWidth={1.75} />
                    </div>
                    <p className="mb-3 text-xl leading-relaxed font-bold text-[#1c1c1c]">{f.title}</p>
                    <p className="text-[13px] leading-loose text-[#5c5c5c]">{f.body}</p>
                  </div>
                  <div className="intro-game-feature-visual rounded-2xl border-2 border-[#2b2b2b] shadow-[2px_2px_0_rgba(0,0,0,0.12)]">
                    <Visual />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 우측 점 토글 — 클릭하면 해당 기능으로 스크롤 이동, 스크롤 중인 기능이 자동으로 하이라이트 */}
      <div className="fixed top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col gap-3 sm:right-5">
        {items.map((f, i) => (
          <button
            key={f.title}
            type="button"
            onClick={() => goTo(i)}
            aria-label={f.title}
            title={f.title}
            className={`h-2.5 rounded-full transition-all ${
              i === active ? "w-8 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function IntroPage({
  onContinueWithoutLogin,
  onLoggedIn,
}: {
  onContinueWithoutLogin: () => Promise<void>;
  onLoggedIn: () => void;
}) {
  const [showLogin, setShowLogin] = useState(false);
  // 실제 서비스(체험/로그인)는 아직 모바일 화면을 지원하지 않아, 좁은 화면에서 시도하면
  // 안내만 띄우고 막는다. 소개 페이지 자체는 반응형으로 볼 수 있게 둠.
  const [showMobileNotice, setShowMobileNotice] = useState(false);
  const { businessMode, setBusinessMode } = useBusinessMode();
  // 체험 세션 생성이 끝날 때까지 클릭 반응이 없어 "먹통"처럼 보이던 문제 — 누른 즉시
  // 버튼을 비활성화하고 로딩 문구로 바꿔서 진행 중임을 알려준다
  const [startingTrial, setStartingTrial] = useState(false);

  const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 768;

  const handleTrialClick = async () => {
    if (isMobileViewport()) {
      setShowMobileNotice(true);
      return;
    }
    if (startingTrial) return;
    setStartingTrial(true);
    try {
      await onContinueWithoutLogin();
    } catch {
      setStartingTrial(false);
    }
  };

  const handleLoginClick = () => {
    if (isMobileViewport()) {
      setShowMobileNotice(true);
      return;
    }
    setShowLogin(true);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navCategories = [
    { id: "preview", label: "미리보기" },
    { id: "features", label: "기능" },
    { id: "reviews", label: "후기" },
  ];

  return (
    <div className={`intro-page min-h-screen bg-background ${businessMode ? "intro-game" : "intro-business"}`}>
      <nav
        className={`intro-nav sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur ${
          businessMode ? "business-titlebar border-b-0" : ""
        }`}
      >
        <div className="intro-nav-inner mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:block" />
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap sm:gap-4">
            <div className="hidden items-center gap-1 sm:flex">
              {navCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToSection(cat.id)}
                  className={`intro-nav-link rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/[.03] ${
                    businessMode ? "text-white/80 hover:text-white" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <span className={`hidden h-5 w-px sm:block ${businessMode ? "bg-white/30" : "bg-border"}`} aria-hidden="true" />
            <button
              type="button"
              onClick={handleLoginClick}
              className={`intro-login-btn whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                businessMode ? "text-white/80 hover:text-white" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              로그인 / 회원가입
            </button>
            <button
              type="button"
              onClick={handleTrialClick}
              disabled={startingTrial}
              className={`intro-trial-btn whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-60 sm:px-4 sm:text-sm ${
                businessMode ? "bg-white text-[#2a2620]" : "bg-accent text-white"
              }`}
            >
              {startingTrial ? "준비 중..." : "1분 체험하기"}
            </button>
            <div
              role="group"
              aria-label="모드 선택"
              className={`intro-mode-toggle flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${
                businessMode ? "border-white/40" : "border-border"
              }`}
            >
              {/* businessMode(true)는 실제로는 레트로 창 스타일(FeatureWindowScrollList)이 나가는
                  "게임 모드" 쪽이라, 라벨/활성 매핑을 그 실제 화면과 맞춘다 — 홈 화면(TopBar)과 동일한 토글 */}
              {(
                [
                  { key: "game", active: businessMode, Icon: Gamepad2, label: "게임" },
                  { key: "business", active: !businessMode, Icon: Briefcase, label: "비즈니스" },
                ] as const
              ).map(({ key, active, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (active) return;
                    const next = key === "game";
                    setBusinessMode(next);
                    setStoredBusinessMode(next); // 직접 고른 값이니 저장 — 다른 페이지·다음 방문에도 유지
                  }}
                  aria-pressed={active}
                  aria-label={`${label} 모드${active ? " (현재 선택됨)" : "로 전환"}`}
                  style={{
                    backgroundColor: active ? (businessMode ? "#ffffff" : "#1f2328") : "transparent",
                    color: active ? (businessMode ? "#5aa89a" : "#ffffff") : undefined,
                  }}
                  className={`intro-mode-option flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                    active
                      ? ""
                      : businessMode
                        ? "text-white/60 hover:bg-white/10"
                        : "text-foreground/40 hover:bg-black/[.03]"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={2} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <section id="preview" className="intro-hero hero">
        <div className="wrap">
          <Reveal className="copy">
            <span className="eyebrow">WORKMATE ENGLISH</span>
            <h1>영어를 배우는 대신,<br /><em>영어로 출근</em>해 보세요.</h1>
            <p>메신저와 이메일로 실제 업무를 처리하면, Solar가 관계별 표현과 문법을 첨삭하고 하루의 성장을 업무 리포트로 남겨요.</p>
            <div className="actions">
              <button type="button" onClick={handleTrialClick} disabled={startingTrial} className="primary">{startingTrial ? "체험 준비 중..." : "1분 가상 근무 체험하기"}</button>
              <button type="button" onClick={() => scrollToSection("features")} className="secondary">핵심 기능 보기 ↓</button>
            </div>
          </Reveal>
          <Reveal delayMs={150} className="preview">
            <div className="businesspreview">
              <div className="mailcard">
                <div className="mailhead"><b>오늘의 업무 연락</b><span className="live">SOLAR LIVE</span></div>
                {[
                  { rank:"사원", name:"Jake", role:"동료", line:"Can you check the new build by 3? 🙏", tone:"캐주얼" },
                  { rank:"과장", name:"Ellen", role:"상사", line:"Could you please review the proposal?", tone:"격식" },
                  { rank:"부장", name:"Liam", role:"거래처", line:"We would kindly request your confirmation.", tone:"보수적" },
                ].map((person) => (
                  <div className="person" key={person.name}>
                    <span className="avatar"><RankAvatar rank={person.rank} /></span>
                    <div><strong>{person.name} · {person.role}</strong><small>{person.line}</small></div>
                    <span className="tone">{person.tone}</span>
                  </div>
                ))}
              </div>
              <div className="features">
                {[
                  ["MESSENGER · EMAIL","실제 업무처럼 답장하고 메일 쓰기"],
                  ["RELATIONSHIP TONE","동료 · 상사 · 거래처별 표현"],
                  ["3-STEP HINT","단어 → 문장 뼈대 → 예시 답안"],
                  ["SOLAR FEEDBACK","문법 · 표현 · 관계별 뉘앙스 첨삭"],
                  ["AWAY MODE","외근 중이면 30분 뒤 다시 알림"],
                  ["WORK REPORT","퇴근 리포트부터 매주·매달 성장 흐름까지 정리"],
                ].map(([title, body]) => <div className="feat" key={title}><b>{title}</b><span>{body}</span></div>)}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <section id="features" className="intro-features-section border-t border-border bg-surface px-4 py-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="intro-section-title text-center text-2xl font-bold tracking-tight md:text-3xl">이런 기능들이 있어요</h2>

          <div className="mt-10">
            <Reveal>
              {businessMode ? (
                <FeatureWindowScrollList items={features} />
              ) : (
                <FeatureScrollList items={features} />
              )}
            </Reveal>
          </div>
        </div>
      </section>

      <section className="intro-trial-showcase">
        <div className="intro-trial-heading"><span>1-MINUTE FREE TRIAL</span><h2>설명 대신, 1분 동안 직접 출근해 보세요.</h2></div>
        <div className="intro-trial-frame">
          <div className="intro-trial-top"><b>DAY 01 · 09:00 AM</b><span>QUEST PROGRESS</span><i><u /></i><strong>2 / 5</strong></div>
          <div className="intro-trial-flow">
            {[["새 연락 확인","메신저·이메일 도착"],["관계 파악","동료·상사·거래처"],["힌트 활용","단어 → 뼈대 → 답안"],["답장과 첨삭","Solar 즉시 피드백"],["업무 완료","업무 리포트 확인"]].map(([title, copy], i) => <div key={title}><em>{i + 1}</em><b>{title}</b><span>{copy}</span></div>)}
          </div>
          <button type="button" onClick={handleTrialClick} disabled={startingTrial} className="intro-trial-main">{startingTrial ? "체험 준비 중..." : "무료로 1분 체험하기"}</button>
        </div>
      </section>

      <ReviewsSection />

      {/* accent(teal)→accent-2(orange)가 정반대 색이라 그라데이션 중간이 탁한 카키색으로
          섞여 보였음 — 색 섞임 없이 브랜드 컬러 하나로만 깔끔하게 */}
      <section id="start" className="intro-final-cta bg-accent px-4 py-16 text-center text-white">
        <span className="intro-final-kicker">READY FOR WORK?</span>
        <h2 className="text-2xl font-bold tracking-tight">오늘부터 영어로 출근하세요.</h2>
        <p className="intro-final-copy mt-2 text-sm text-white/80">하루 한 건의 업무가 쌓여 실무 영어가 됩니다.</p>
        <button
          type="button"
          onClick={handleLoginClick}
          className="intro-final-button mt-6 rounded-full bg-white px-8 py-3 text-sm font-semibold text-accent shadow-lg hover:opacity-90 disabled:opacity-60"
        >
          로그인 / 회원가입
        </button>
      </section>

      {showLogin && (
        <AccountModal profile={{}} onClose={() => setShowLogin(false)} onAccountChanged={onLoggedIn} />
      )}

      {showMobileNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-2xl bg-surface p-5 text-center shadow-xl">
            <p className="text-2xl">💻</p>
            <p className="mt-2 break-keep text-sm font-medium text-foreground">모바일은 아직 준비 중이에요</p>
            <p className="mt-1.5 break-keep text-xs leading-relaxed text-foreground/60">
              지금은 PC 화면에 맞춰져 있어요. PC로 접속해서 이용해주세요!
            </p>
            <button
              type="button"
              onClick={() => setShowMobileNotice(false)}
              className="mt-4 w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}




