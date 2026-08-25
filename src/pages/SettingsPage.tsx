import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import * as api from "@/lib/api";
import { useWorkday } from "@/context/useWorkday";
import { subscribePush, unsubscribePush } from "@/lib/push";
import { signOut, startKakaoNotifyConsent } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient.js";
import { industries } from "@/lib/industries";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import type { EnglishLevel, ProfileResponse } from "@/types/api";

const englishLevels: { value: EnglishLevel; label: string; description: string }[] = [
  { value: "beginner", label: "초급", description: "쉬운 어휘와 짧은 문장 위주" },
  { value: "intermediate", label: "중급", description: "실무에서 자주 쓰는 표현 위주" },
  { value: "advanced", label: "고급", description: "관용구·비즈니스 뉘앙스 포함" },
];

const dailyCountOptions = [3, 4, 5, 6];

type NotificationStatus = NotificationPermission | "unsupported";

const notificationStatusMeta: Record<NotificationStatus, { label: string; tone: StatusTone }> = {
  granted: { label: "허용됨", tone: "success" },
  denied: { label: "거부됨", tone: "error" },
  default: { label: "설정 안 함", tone: "neutral" },
  unsupported: { label: "미지원 브라우저", tone: "neutral" },
};

function getNotificationStatus(): NotificationStatus {
  return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
}

type StringProfileKey =
  | "colleague_name"
  | "colleague_personality"
  | "manager_name"
  | "manager_personality"
  | "client_name"
  | "client_personality"
  | "colleague_notify_time"
  | "manager_notify_time"
  | "client_notify_time";

interface PersonaField {
  role: "colleague" | "manager" | "client";
  label: string;
  nameField: StringProfileKey;
  personalityField: StringProfileKey;
  personalityPlaceholder: string;
  notifyTimeField: StringProfileKey;
}

// 저장 버튼이 섹션별로 나뉘어 있어, 각 저장이 그 섹션의 필드만 서버로 보내고 다른 섹션의
// (아직 저장 안 된) 편집 중인 값은 건드리지 않게 필드를 명시적으로 나눠둔다
const BASIC_FIELDS = [
  "display_name",
  "industry",
  "job_role",
  "main_tasks",
  "contacts",
  "english_level",
  "start_time",
  "end_time",
  "daily_count",
] as const satisfies readonly (keyof ProfileResponse)[];

const PERSONA_PROFILE_FIELDS = [
  "colleague_name",
  "colleague_personality",
  "colleague_notify_time",
  "manager_name",
  "manager_personality",
  "manager_notify_time",
  "client_name",
  "client_personality",
  "client_notify_time",
] as const satisfies readonly (keyof ProfileResponse)[];

function pickFields<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = obj[key];
  return out;
}

const personaFields: PersonaField[] = [
  {
    role: "colleague",
    label: "동료",
    nameField: "colleague_name",
    personalityField: "colleague_personality",
    personalityPlaceholder: "예: 차분하고 논리적",
    notifyTimeField: "colleague_notify_time",
  },
  {
    role: "manager",
    label: "상사",
    nameField: "manager_name",
    personalityField: "manager_personality",
    personalityPlaceholder: "예: 유머러스하지만 마감엔 엄격함",
    notifyTimeField: "manager_notify_time",
  },
  {
    role: "client",
    label: "거래처",
    nameField: "client_name",
    personalityField: "client_personality",
    personalityPlaceholder: "예: 격식 있고 신중함",
    notifyTimeField: "client_notify_time",
  },
];

// 섹션이 많아지면 스크롤이 길어지므로, 접었다 펼 수 있게 하고 상단 바로가기로 원하는 곳으로 바로 이동할 수 있게 함
function CollapsibleSection({
  id,
  title,
  description,
  defaultOpen = true,
  footer,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-foreground/50">{description}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
          {children}
          {/* 화면을 따라다니는 고정 저장바 대신, 각 접이식 섹션 바로 안에 저장 버튼을 둠 */}
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border pt-4">{footer}</div>}
        </div>
      )}
    </section>
  );
}

const SECTION_LINKS = [
  { id: "settings-basic", label: "기본 정보" },
  { id: "settings-personas", label: "동료·상사·거래처" },
  { id: "settings-notifications", label: "웹 브라우저 알림" },
];

export function SettingsPage() {
  const { refresh: refreshWorkday } = useWorkday();
  const [profile, setProfile] = useState<ProfileResponse>({});
  const [originalProfile, setOriginalProfile] = useState<ProfileResponse>({});
  const [loading, setLoading] = useState(true);
  // 저장 버튼이 섹션별로 나뉘어 있어(기본 정보 / 동료·상사·거래처), 한 섹션을 저장해도
  // 다른 섹션은 영향받지 않도록 진행 상태를 따로 관리한다
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicSaved, setBasicSaved] = useState(false);
  const [personasSaving, setPersonasSaving] = useState(false);
  const [personasSaved, setPersonasSaved] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(getNotificationStatus());
  const [pushRequesting, setPushRequesting] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushUnsubscribing, setPushUnsubscribing] = useState(false);
  // 카카오로 로그인한 계정에만 의미가 있는 항목이라, 지금 계정에 카카오 identity가
  // 실제로 연동돼 있는지 확인해서 이 섹션 노출 여부를 정한다
  const [kakaoLinked, setKakaoLinked] = useState(false);
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const [kakaoError, setKakaoError] = useState<string | null>(null);
  // 업종은 온보딩과 같은 칩 선택 UI — 저장된 값이 목록에 없으면 "기타"로 취급하고 원래 값을 커스텀 입력에 채운다
  const [industryChip, setIndustryChip] = useState<string>("");
  const [customIndustry, setCustomIndustry] = useState("");
  const didInitIndustry = useRef(false);
  // 이름만 바꾸고 성격은 그대로인 역할이 있을 때: "새로 시작"할지 "이름만 바꿀"지 물어보는 확인창 상태
  const [resetPrompt, setResetPrompt] = useState<{ ambiguousRoles: PersonaField[]; autoResetRoles: string[] } | null>(
    null,
  );
  // 성격 변경 등으로 "새로 시작"이 예약된 역할이 있으면, 오늘은 안 바뀌고 내일부터 반영된다는 안내를 잠깐 보여줌
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p);
      setOriginalProfile(p);
      setLoading(false);
      if (!didInitIndustry.current) {
        didInitIndustry.current = true;
        if (p.industry && industries.includes(p.industry)) {
          setIndustryChip(p.industry);
        } else if (p.industry) {
          setIndustryChip("기타");
          setCustomIndustry(p.industry);
        }
      }
    });
    supabase?.auth
      .getUser()
      .then(({ data }) => {
        setKakaoLinked((data.user?.identities || []).some((i) => i.provider === "kakao"));
      })
      .catch(() => {
        supabase?.auth.getSession().then(({ data }) => {
          setKakaoLinked((data.session?.user?.identities || []).some((i) => i.provider === "kakao"));
        });
      });
  }, []);

  const handleToggleKakaoNotify = async (next: boolean) => {
    setKakaoError(null);
    setKakaoBusy(true);
    try {
      if (next) {
        await startKakaoNotifyConsent(); // 성공 시 카카오 재동의 페이지로 이동하며 여기서 끝남(브라우저가 떠남)
      } else {
        const { profile: updated } = await api.disconnectKakaoNotify();
        setProfile(updated);
        setOriginalProfile(updated);
      }
    } catch (err) {
      setKakaoError(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
    } finally {
      setKakaoBusy(false);
    }
  };

  const updateField =
    (field: keyof ProfileResponse) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setProfile((prev) => ({ ...prev, [field]: e.target.value }));
      if ((PERSONA_PROFILE_FIELDS as readonly string[]).includes(field)) setPersonasSaved(false);
      else setBasicSaved(false);
    };

  const resolvedIndustry = industryChip === "기타" ? customIndustry.trim() : industryChip;

  const handleJump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // "기본 정보" 저장 — 이 섹션 필드만 서버로 보내고, 반영도 이 필드들만(다른 섹션에서 아직
  // 저장 안 한 편집 중인 값을 덮어쓰지 않기 위해 profile 전체가 아니라 이 필드들만 갱신)
  const finishSaveBasic = async () => {
    setBasicSaving(true);
    try {
      const savedProfile = await api.postProfile({
        display_name: profile.display_name,
        industry: resolvedIndustry || undefined,
        job_role: profile.job_role,
        main_tasks: profile.main_tasks,
        contacts: profile.contacts,
        english_level: profile.english_level,
        start_time: profile.start_time,
        end_time: profile.end_time,
        daily_count: profile.daily_count,
      });
      const patch = pickFields(savedProfile, BASIC_FIELDS);
      setProfile((prev) => ({ ...prev, ...patch }));
      setOriginalProfile((prev) => ({ ...prev, ...patch }));
      setBasicSaved(true);
      // 출퇴근시간을 바꾸면 서버가 오늘 남은 연락 시각도 같이 재계산하는데, 홈/오늘의 연락은
      // 다음 폴링(45초)이 와야 반영돼서 "저장했는데 안 바뀐다"로 보였음 — 저장 직후 바로 당겨온다
      refreshWorkday().catch(() => {});
    } finally {
      setBasicSaving(false);
    }
  };

  // "동료·상사·거래처" 저장 — 마찬가지로 이 섹션 필드만 보내고 반영한다
  const finishSavePersonas = async (resetRoles: string[]) => {
    setPersonasSaving(true);
    setPersonasError(null);
    try {
      const savedProfile = await api.postProfile({
        colleague_name: profile.colleague_name,
        colleague_personality: profile.colleague_personality,
        // 빈 값이면 undefined가 아니라 null을 보내야 "자동 계산으로 되돌리기"(커스텀 시각 해제)가 실제로 저장됨
        colleague_notify_time: profile.colleague_notify_time || null,
        manager_name: profile.manager_name,
        manager_personality: profile.manager_personality,
        manager_notify_time: profile.manager_notify_time || null,
        client_name: profile.client_name,
        client_personality: profile.client_personality,
        client_notify_time: profile.client_notify_time || null,
        persona_reset_roles: resetRoles,
      });
      const patch = pickFields(savedProfile, PERSONA_PROFILE_FIELDS);
      setProfile((prev) => ({ ...prev, ...patch }));
      setOriginalProfile((prev) => ({ ...prev, ...patch }));
      setPersonasSaved(true);
      // 성격이 바뀌었거나 "새로 시작"을 고른 역할은 오늘 이미 만들어진 사람을 그대로 두고
      // 다음 출근부터 새로운 사람으로 바뀐다 — 이름만 바꾼 경우와 달리 오늘은 반영되지 않으니 안내
      setResetNotice(
        resetRoles.length
          ? `${resetRoles
              .map((role) => personaFields.find((p) => p.role === role)?.label || role)
              .join(", ")}은(는) 오늘 대화는 그대로 두고, 내일 출근부터 새로운 사람으로 바뀌어요.`
          : null,
      );
      // 이름만 바뀐 역할은 오늘 캐릭터에도 서버에서 바로 반영해뒀는데, 홈/채팅방 쪽은 다음 폴링(45초)이나
      // 새 메시지가 와야 갱신돼서 "저장했는데 안 바뀐다"로 보였음 — 저장 직후 바로 최신 상태를 당겨온다
      refreshWorkday().catch(() => {});
    } catch (err) {
      setPersonasError(err instanceof Error ? err.message : "저장 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setPersonasSaving(false);
    }
  };

  const handleSavePersonas = async () => {
    // 성격이 바뀐 역할 — 이름 변경 여부와 무관하게 "새로운 사람"으로 자동 리셋
    const autoResetRoles = personaFields
      .filter((p) => (profile[p.personalityField] ?? "") !== (originalProfile[p.personalityField] ?? ""))
      .map((p) => p.role);
    // 이름만 바뀐(성격은 그대로인) 역할 — 새로 시작할지 이름만 바꿀지 물어봐야 함
    const ambiguousRoles = personaFields.filter(
      (p) =>
        (profile[p.nameField] ?? "") !== (originalProfile[p.nameField] ?? "") &&
        (profile[p.personalityField] ?? "") === (originalProfile[p.personalityField] ?? ""),
    );

    if (ambiguousRoles.length) {
      setResetPrompt({ ambiguousRoles, autoResetRoles });
      return;
    }
    await finishSavePersonas(autoResetRoles);
  };

  const handleEnablePush = async () => {
    setPushRequesting(true);
    setPushError(null);
    try {
      const result = await subscribePush();
      if (result !== "subscribed") {
        setPushError(
          result === "denied"
            ? "브라우저 알림 권한이 거부되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해주세요."
            : "이 브라우저에서는 웹 알림을 지원하지 않아요.",
        );
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "알림 연결 중 문제가 발생했습니다.");
    } finally {
      setNotificationStatus(getNotificationStatus());
      setPushRequesting(false);
    }
  };

  // 브라우저 권한 차단과 별개로, 서버에 저장된 구독 자체를 지워서 이 기기로는 더 이상 발송 대상이 아니게 함
  const handleDisablePush = async () => {
    setPushUnsubscribing(true);
    setPushError(null);
    try {
      await unsubscribePush();
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "구독 해제 중 문제가 발생했습니다.");
    } finally {
      setPushUnsubscribing(false);
    }
  };

  // 회원 탈퇴: 이 기기 알림 구독부터 해제 → 계정·데이터 서버에서 영구 삭제 → 로그아웃 → 소개 페이지로
  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await unsubscribePush().catch(() => {});
      await api.deleteMyAccount();
      await signOut();
      window.dispatchEvent(new Event("go:force-intro"));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "탈퇴 처리 중 문제가 발생했습니다.");
      setDeletingAccount(false);
      setDeleteConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-sm text-foreground/50 md:px-8 md:py-8">
        불러오는 중...
      </div>
    );
  }

  const basicSaveButton = (
    <>
      {basicSaved && <span className="text-xs text-foreground/50">저장됨</span>}
      <button
        type="button"
        onClick={finishSaveBasic}
        disabled={basicSaving}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {basicSaving ? "저장 중..." : "저장"}
      </button>
    </>
  );

  const personasSaveButton = (
    <>
      {personasSaved && <span className="text-xs text-foreground/50">저장됨</span>}
      <button
        type="button"
        onClick={handleSavePersonas}
        disabled={personasSaving}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {personasSaving ? "저장 중..." : "저장"}
      </button>
    </>
  );

  return (
    <div className="mx-auto max-w-[1230px] [zoom:1.1] space-y-6 px-4 py-6 pb-24 md:px-8 md:py-8">
      <div>
        <h1 className="text-lg font-semibold">설정</h1>
        <p className="mt-1 text-sm text-foreground/60">업무 환경과 알림을 관리하세요.</p>
      </div>

      {/* 상단 바로가기 — 스크롤이 길어져도 원하는 섹션으로 바로 이동 */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-border bg-black/[.015] p-3">
        {SECTION_LINKS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleJump(s.id)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground/70 hover:bg-black/[.03]"
          >
            {s.label}
          </button>
        ))}
      </div>

      <CollapsibleSection
        id="settings-basic"
        title="기본 정보"
        description="이름·직무·근무 조건을 관리해요."
        footer={basicSaveButton}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">내 이름</span>
          <input
            className="w-full max-w-xs rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
            placeholder="예: 홍길동"
            value={profile.display_name ?? ""}
            onChange={updateField("display_name")}
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
                onClick={() => {
                  setIndustryChip(item);
                  setBasicSaved(false);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  industryChip === item
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70 hover:bg-black/[.03]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {industryChip === "기타" && (
            <input
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="업종을 입력해주세요"
              value={customIndustry}
              onChange={(e) => {
                setCustomIndustry(e.target.value);
                setBasicSaved(false);
              }}
            />
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">직무</span>
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="예: 서비스 기획자"
            value={profile.job_role ?? ""}
            onChange={updateField("job_role")}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">주요 업무</span>
          <textarea
            className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
            rows={3}
            placeholder="예: 신규 기능 기획, 유관부서 커뮤니케이션"
            value={profile.main_tasks ?? ""}
            onChange={updateField("main_tasks")}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">자주 소통하는 대상</span>
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="예: 개발팀 동료, 팀장, 해외 파트너사 담당자"
            value={profile.contacts ?? ""}
            onChange={updateField("contacts")}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">영어 난이도</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {englishLevels.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => {
                  setProfile((prev) => ({ ...prev, english_level: level.value }));
                  setBasicSaved(false);
                }}
                className={`rounded-lg border px-3 py-2 text-left ${
                  profile.english_level === level.value
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-black/[.03]"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    profile.english_level === level.value ? "text-accent" : "text-foreground"
                  }`}
                >
                  {level.label}
                </p>
                <p className="mt-0.5 text-xs text-foreground/50">{level.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">예상 출근시간</span>
            <input
              type="time"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
              value={profile.start_time ?? ""}
              onChange={updateField("start_time")}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">예상 퇴근시간</span>
            <input
              type="time"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
              value={profile.end_time ?? ""}
              onChange={updateField("end_time")}
            />
          </label>
        </div>
        <p className="text-xs text-foreground/50">
          저장하면 오늘 아직 안 온 알림들은 바뀐 시간에 맞춰 자동으로 다시 계산돼요. 이미 온 알림은 그대로 유지돼요.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">하루 알림 횟수</p>
          <p className="text-xs text-foreground/50">
            기본 3회(동료·상사·거래처 각 1회)이며, 그 이상은 매일 무작위로 추가 배정돼요.
          </p>
          <div className="flex gap-2">
            {dailyCountOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setProfile((prev) => ({ ...prev, daily_count: n }));
                  setBasicSaved(false);
                }}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  profile.daily_count === n
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70 hover:bg-black/[.03]"
                }`}
              >
                {n}회
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="settings-personas"
        title="동료·상사·거래처"
        description="함께 일하는 사람들의 이름과 성격을 입력하면 더 자연스러운 대화가 생성됩니다."
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {personasError && <p className="mr-auto text-xs text-red-600">{personasError}</p>}
            {!personasError && resetNotice && <p className="mr-auto text-xs text-amber-600">{resetNotice}</p>}
            {personasSaveButton}
          </div>
        }
      >
        <div className="space-y-3">
          {personaFields.map((persona) => (
            <div key={persona.role} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Avatar name={profile[persona.nameField] || persona.label} size="sm" />
                <span className="text-xs font-medium text-foreground/50">{persona.label}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-xs text-foreground/50">
                  이름
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
                    value={profile[persona.nameField] ?? ""}
                    onChange={updateField(persona.nameField)}
                  />
                </label>
                <label className="block space-y-1 text-xs text-foreground/50">
                  성격
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
                    placeholder={persona.personalityPlaceholder}
                    value={profile[persona.personalityField] ?? ""}
                    onChange={updateField(persona.personalityField)}
                  />
                </label>
                <label className="block space-y-1 text-xs text-foreground/50">
                  알림 시각 (선택){persona.role !== "colleague" && " · 동료 이후"}
                  <input
                    type="time"
                    min={persona.role !== "colleague" ? profile.colleague_notify_time || undefined : undefined}
                    className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
                    value={profile[persona.notifyTimeField] ?? ""}
                    onChange={updateField(persona.notifyTimeField)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="settings-notifications" title="웹 브라우저 알림" description="외근 재알림 등 중요한 연락을 실시간으로 받아보세요.">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-foreground/50">현재 이 브라우저의 알림 권한 상태예요.</p>
          <StatusBadge tone={notificationStatusMeta[notificationStatus].tone}>
            {notificationStatusMeta[notificationStatus].label}
          </StatusBadge>
        </div>
        {notificationStatus !== "unsupported" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={pushRequesting}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/70 hover:bg-black/[.03] disabled:opacity-50"
            >
              {pushRequesting ? "요청 중..." : notificationStatus === "granted" ? "알림 다시 연결" : "웹 알림 켜기"}
            </button>
            <button
              type="button"
              onClick={handleDisablePush}
              disabled={pushUnsubscribing}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/50 hover:bg-black/[.03] disabled:opacity-50"
            >
              {pushUnsubscribing ? "해제 중..." : "이 기기 구독 해제"}
            </button>
          </div>
        )}
        {notificationStatus === "granted" && !pushError && (
          <p className="text-xs text-foreground/40">
            권한은 허용돼 있어도 구독이 끊겼을 수 있어요 — 알림이 안 오면 눌러서 다시 연결해보세요.
          </p>
        )}
        {pushError && <p className="text-xs text-red-600">{pushError}</p>}
        <div className="rounded-lg bg-black/[.02] p-3 text-xs leading-relaxed text-foreground/50">
          "이 기기 구독 해제"를 누르면 서버에 저장된 이 기기의 알림 등록이 실제로 삭제돼요. 브라우저
          알림 권한 자체를 막으려면, 주소창 왼쪽 자물쇠(사이트 정보) 아이콘에서 이 사이트의 "알림"을
          차단으로 바꿔주세요.
        </div>
      </CollapsibleSection>

      {kakaoLinked && (
        <CollapsibleSection
          id="settings-kakao-notify"
          title="카톡 알림"
          description="놓친 연락·리포트 완성 알림을 카카오톡 '나와의 채팅'으로도 받아요."
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-foreground/50">
              웹 알림을 못 봤을 때 놓치지 않도록 보조로 보내는 채널이에요. 야간(22시~7시)에는 발송하지 않아요.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(profile.kakao_notify_enabled)}
              disabled={kakaoBusy}
              onClick={() => handleToggleKakaoNotify(!profile.kakao_notify_enabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                profile.kakao_notify_enabled ? "bg-accent" : "bg-foreground/15"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  profile.kakao_notify_enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          {kakaoError && <p className="text-xs text-red-600">{kakaoError}</p>}
          {!profile.kakao_notify_enabled && (
            <div className="rounded-lg bg-black/[.02] p-3 text-xs leading-relaxed text-foreground/50">
              켜면 카카오 재동의 화면으로 이동해요. 동의하면 바로 알림이 시작돼요.
            </div>
          )}
        </CollapsibleSection>
      )}

      <section className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-red-700">회원 탈퇴</h2>
          <p className="mt-0.5 text-xs text-foreground/50">
            계정과 근무 기록·리포트·설정 등 모든 데이터가 영구적으로 삭제되며 되돌릴 수 없어요. 탈퇴 즉시
            서버에서 바로 삭제되고, 저희는 탈퇴한 계정의 데이터를 별도로 보관하지 않아요.
          </p>
        </div>
        {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={deletingAccount}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          {deletingAccount ? "탈퇴 처리 중..." : "회원 탈퇴하기"}
        </button>
      </section>

      <ConfirmDialog
        open={resetPrompt !== null}
        title="이름만 바꾸셨네요"
        description={`${resetPrompt?.ambiguousRoles.map((p) => p.label).join(", ")}의 이름만 바뀌고 성격은 그대로예요. 지금까지 쌓인 대화는 유지하고 이름만 바꿀까요, 아니면 새로운 사람으로 처음부터 다시 시작할까요?`}
        confirmLabel="새로 시작"
        cancelLabel="이름만 바꾸기"
        dismissLabel="취소"
        onConfirm={() => {
          const roles = [...(resetPrompt?.autoResetRoles ?? []), ...(resetPrompt?.ambiguousRoles.map((p) => p.role) ?? [])];
          setResetPrompt(null);
          finishSavePersonas(roles);
        }}
        onCancel={() => {
          const roles = resetPrompt?.autoResetRoles ?? [];
          setResetPrompt(null);
          finishSavePersonas(roles);
        }}
        onDismiss={() => setResetPrompt(null)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="정말 탈퇴하시겠어요?"
        description="탈퇴하면 계정과 근무 기록·리포트·설정 등 모든 데이터가 서버에서 즉시 영구적으로 삭제되며 되돌릴 수 없어요. 저희는 탈퇴한 계정의 데이터를 별도로 보관하지 않아요."
        confirmLabel="탈퇴하기"
        cancelLabel="취소"
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          handleDeleteAccount();
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
