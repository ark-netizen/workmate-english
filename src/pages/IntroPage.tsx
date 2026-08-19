// 서비스 소개(랜딩) 페이지 — 링글/말해보카류 구조 참고: 상단 네비 + 히어로(헤드라인+미리보기) + 컬러풀한 기능 카드 + 하단 CTA.
// 실제 사진 대신 우리 서비스 실제 UI를 축소한 미리보기 카드를 히어로에 배치.
// 디자인·카피는 초안 — 비주얼(폰트/애니메이션/실제 이미지)은 추후 다듬을 예정.
import { useEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Sparkles, Building2, Bell, FileText, HeartHandshake, Star, type LucideIcon } from "lucide-react";
import { AccountModal } from "@/components/shell/AccountModal";
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
    <section id="reviews" className="border-t border-border bg-surface px-4 py-16 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">실제 후기를 공개합니다</h2>
        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-background p-8">
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

const colorClasses = {
  purple: { bg: "bg-purple-50", border: "border-purple-100", icon: "text-purple-600", iconBg: "bg-purple-100" },
  blue: { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-600", iconBg: "bg-blue-100" },
  pink: { bg: "bg-pink-50", border: "border-pink-100", icon: "text-pink-600", iconBg: "bg-pink-100" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "text-indigo-600", iconBg: "bg-indigo-100" },
  violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-600", iconBg: "bg-violet-100" },
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
  color: "purple" | "blue" | "pink" | "indigo" | "violet";
  Visual: ComponentType;
}[] = [
  {
    icon: Sparkles,
    color: "purple",
    title: "동료·상사·거래처, 다른 표현",
    body: "같은 상황도 상대에 따라 캐주얼·격식·보수적 톤으로 구분해 배우고, 대화가 쌓일수록 더 고도화돼요.",
    Visual: ToneExample,
  },
  {
    icon: Building2,
    color: "blue",
    title: "내 업종·직무 맞춤 시나리오",
    body: "업종·직무만 입력하면 나만의 동료·상사·거래처가 매일 자동으로 생겨요.",
    Visual: ScenarioExample,
  },
  {
    icon: Bell,
    color: "pink",
    title: "놓치지 않는 웹 알림",
    body: "새 연락은 알림으로, 바쁘면 '외근 중' 버튼 하나로 미뤄요.",
    Visual: NotificationExample,
  },
  {
    icon: FileText,
    color: "indigo",
    title: "하루·주간·월간 리포트",
    body: "퇴근 리포트부터 매주·매달 성장 흐름까지 정리해드려요.",
    Visual: ReportExample,
  },
  {
    icon: HeartHandshake,
    color: "violet",
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

function MockPreview() {
  const rows = [
    { initial: "J", name: "Jake", role: "동료", tone: "캐주얼", line: "Hey, can you take a look by 3? 🙏" },
    { initial: "E", name: "Ellen", role: "상사", tone: "격식", line: "Could you please review this by 3pm today?" },
    { initial: "LC", name: "Liam Carter", role: "거래처", tone: "보수적", line: "We would kindly request your review by 3:00 PM." },
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rotate-2 rounded-2xl border border-border bg-surface p-4 shadow-xl">
        <p className="mb-3 text-xs font-medium text-foreground/50">오늘의 연락 (3)</p>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                {r.initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {r.name} <span className="font-normal text-foreground/40">· {r.role}</span>
                  </p>
                  <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/40">
                    {r.tone}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-foreground/60">{r.line}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 화면 밖으로 넘치는 장식용 말풍선 — 좁은 모바일 화면에선 카드 바깥으로 잘려나가므로 sm 이상에서만 노출 */}
      <div
        className="animate-float absolute -left-6 -top-5 hidden rounded-xl border border-pink-100 bg-pink-50 px-3 py-2 text-xs font-medium text-pink-700 shadow-md sm:block"
        style={{ "--float-rotate": "-6deg", animationDelay: "0s" } as CSSProperties}
      >
        🔔 외근 중 · 30분 후 재알림
      </div>
      <div
        className="animate-float absolute -right-4 -bottom-4 hidden rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 shadow-md sm:block"
        style={{ "--float-rotate": "6deg", animationDelay: "1.5s" } as CSSProperties}
      >
        💡 힌트 3단계 지원
      </div>
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
    document.documentElement.classList.add("snap-y", "snap-proximity");
    return () => document.documentElement.classList.remove("snap-y", "snap-proximity");
  }, []);

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
    <div className="relative mx-auto max-w-4xl">
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
                  className={`flex min-h-[340px] flex-col justify-center rounded-3xl border ${c.border} ${c.bg} p-5 shadow-sm transition-all duration-500 sm:grid sm:grid-cols-2 sm:items-center sm:gap-8 sm:p-7 ${
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
    document.documentElement.classList.add("snap-y", "snap-proximity");
    return () => document.documentElement.classList.remove("snap-y", "snap-proximity");
  }, []);

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
    <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#1d3fd6_0%,#3a63e0_22%,#5f8ae8_44%,#8fb4f0_66%,#bcd6f5_82%,#bcd6f5_100%)] px-4 py-10 sm:px-8 sm:py-14">
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
                className={`overflow-hidden rounded-2xl border-2 border-[#2b2b2b] bg-[#fbf3e6] shadow-[0_8px_0_rgba(0,0,0,0.25)] transition-all duration-500 ${
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
                  <div className="rounded-2xl border-2 border-[#2b2b2b] shadow-[2px_2px_0_rgba(0,0,0,0.12)]">
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
  onContinueWithoutLogin: () => void;
  onLoggedIn: () => void;
}) {
  const [showLogin, setShowLogin] = useState(false);
  // 실제 서비스(체험/로그인)는 아직 모바일 화면을 지원하지 않아, 좁은 화면에서 시도하면
  // 안내만 띄우고 막는다. 소개 페이지 자체는 반응형으로 볼 수 있게 둠.
  const [showMobileNotice, setShowMobileNotice] = useState(false);
  const { businessMode, setBusinessMode } = useBusinessMode();

  const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 768;

  const handleTrialClick = () => {
    if (isMobileViewport()) {
      setShowMobileNotice(true);
      return;
    }
    onContinueWithoutLogin();
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
    <div className="min-h-screen bg-background">
      <nav
        className={`sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur ${
          businessMode ? "business-titlebar border-b-0" : ""
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:block" />
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap sm:gap-4">
            <div className="hidden items-center gap-1 sm:flex">
              {navCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToSection(cat.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/[.03] ${
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
              className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                businessMode ? "text-white/80 hover:text-white" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              로그인 / 회원가입
            </button>
            <button
              type="button"
              onClick={handleTrialClick}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 sm:px-4 sm:text-sm ${
                businessMode ? "bg-white text-[#2a2620]" : "bg-accent text-white"
              }`}
            >
              1분 체험하기
            </button>
            <button
              type="button"
              onClick={() =>
                setBusinessMode((v) => {
                  const next = !v;
                  setStoredBusinessMode(next); // 직접 고른 값이니 저장 — 다른 페이지·다음 방문에도 유지
                  return next;
                })
              }
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium hover:opacity-90 sm:px-4 sm:text-sm ${
                businessMode
                  ? "border-white/50 bg-transparent text-white"
                  : "border-border bg-transparent text-foreground/70 hover:bg-black/[.03]"
              }`}
            >
              {businessMode ? "비즈니스 모드" : "게임 모드"}
            </button>
          </div>
        </div>
      </nav>
      {businessMode && <div className="business-divider-strip" aria-hidden="true" />}

      <section id="preview" className="relative overflow-hidden bg-gradient-to-b from-accent/[.06] to-transparent px-4 py-14 md:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:grid-cols-2 md:px-8">
          <Reveal className="space-y-5 text-center md:text-left">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              <span className="block whitespace-nowrap">영어를 공부하지 마세요.</span>
              <span className="block whitespace-nowrap">
                <span className="text-accent">영어로 일하는 하루</span>를
              </span>
              <span className="block whitespace-nowrap">경험하세요.</span>
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-foreground/60 md:mx-0">
              하나의 상황도 캐주얼·격식체·비즈니스 메일 버전으로 배우며 톤과 뉘앙스를 몸으로 익혀요.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <button
                type="button"
                onClick={handleTrialClick}
                className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:opacity-90"
              >
                1분 가상 근무 체험하기 (로그인 불필요)
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="text-sm font-medium text-foreground/50 hover:text-foreground"
              >
                기능 살펴보기 ↓
              </button>
            </div>
          </Reveal>

          <Reveal delayMs={150}>
            <MockPreview />
          </Reveal>
        </div>
      </section>

      <section id="features" className="border-t border-border bg-surface px-4 py-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">이런 기능들이 있어요</h2>

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

      <ReviewsSection />

      <section id="start" className="bg-gradient-to-r from-accent to-accent-2 px-4 py-16 text-center text-white">
        <h2 className="text-2xl font-bold tracking-tight">오늘부터 출근해보세요</h2>
        <p className="mt-2 text-sm text-white/80">로그인 없이 1분이면 시작할 수 있어요.</p>
        <button
          type="button"
          onClick={handleTrialClick}
          className="mt-6 rounded-full bg-white px-8 py-3 text-sm font-semibold text-accent shadow-lg hover:opacity-90"
        >
          지금 바로 체험하기
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
