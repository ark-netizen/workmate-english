import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as api from "@/lib/api";
import { ensureSession } from "@/lib/session";
import { finalizePendingConsent, finalizePendingKakaoNotify } from "@/lib/auth";
import { isAutoAdvanceEnabled, QA_ACTIONS_CHANNEL } from "@/lib/qaAutoAdvance";
import type { TodayResponse } from "@/types/api";
import type { TodayItem } from "@/types/domain";
import { WorkdayContext, type ArrivalBanner, type WorkdayContextValue } from "./workday-context-value";

const POLL_INTERVAL_MS = 45_000;
const FIELD_WORK_RENOTIFY_MS = 30 * 60 * 1000;

function buildBannerForItem(item: TodayItem, resp: TodayResponse): ArrivalBanner | null {
  const contact = (resp.contacts ?? []).find((c) => c.id === item.contactId);

  if (item.channel === "messenger") {
    const conversation = (resp.conversations ?? []).find((c) => c.id === item.targetId);
    if (!conversation) return null;
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return {
      id: conversation.id,
      title: contact?.name ?? "새 연락",
      body: lastMessage?.body ?? item.title,
      to: `/messenger/${conversation.id}`,
    };
  }

  const thread = (resp.emailThreads ?? []).find((t) => t.id === item.targetId);
  if (!thread) return null;
  return {
    id: thread.id,
    title: contact?.name ?? "새 연락",
    body: thread.subject,
    to: `/email/${thread.id}`,
  };
}

function buildUnreadMap(resp: TodayResponse) {
  const map = new Map<string, number>();
  (resp.conversations ?? []).forEach((conversation) => map.set(conversation.id, conversation.unreadCount));
  (resp.emailThreads ?? []).forEach((thread) => map.set(thread.id, thread.unreadCount));
  return map;
}

function findArrival(
  resp: TodayResponse,
  previousUnread: Map<string, number>,
): (ArrivalBanner & { messageId: string | null }) | null {
  const candidates = [
    ...(resp.conversations ?? []).map((conversation) => {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      return {
        id: conversation.id,
        contactId: conversation.contactId,
        unread: conversation.unreadCount,
        updatedAt: conversation.updatedAt,
        to: `/messenger/${conversation.id}`,
        preview: lastMessage?.body ?? "",
        messageId: lastMessage?.id ?? null,
      };
    }),
    ...(resp.emailThreads ?? []).map((thread) => {
      const lastEmail = thread.emails[thread.emails.length - 1];
      return {
        id: thread.id,
        contactId: thread.contactId,
        unread: thread.unreadCount,
        updatedAt: thread.updatedAt,
        to: `/email/${thread.id}`,
        preview: thread.subject,
        messageId: lastEmail?.id ?? null,
      };
    }),
  ];

  const arrived = candidates
    .filter((candidate) => candidate.unread > (previousUnread.get(candidate.id) ?? 0))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const top = arrived[0];
  if (!top) return null;

  const contact = (resp.contacts ?? []).find((c) => c.id === top.contactId);
  return { id: top.id, title: contact?.name ?? "새 연락", body: top.preview, to: top.to, messageId: top.messageId };
}

export function WorkdayProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TodayResponse>({ needsOnboarding: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<ArrivalBanner | null>(null);
  const [fieldWorkActiveUntil, setFieldWorkActiveUntil] = useState<number | null>(null);
  // 답장을 "누가" 트리거했는지와 무관하게(자기 화면이든 체험판 하단 안내 바든) 해당 대화의
  // "입력 중" 표시가 뜨도록, 전송 중인 conversationId를 전역으로 추적
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  // 알림센터 배너와 별개로, 화면에 보이는 메시지 말풍선 자체를 잠깐 하이라이트하기 위해 방금 도착한 메시지 id를 추적
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  // 체험판 안내 바가 "단어 힌트를 대신 눌러 보여주는" 연출을 위해 쓰는 신호 — 0이면 아직 발동 안 함,
  // 값이 바뀔 때마다(1, 2, 3...) ConversationView의 ReplyHints가 단어 힌트를 강제로 펼친다
  const [trialHintSignal, setTrialHintSignal] = useState(0);
  // 답장을 "누가" 트리거했든(본인 화면 또는 체험판 안내 바) 보낸 즉시 낙관적으로 보여줄 수 있도록,
  // sendReply 자체에서 채우고 지우는 공유 상태 — 이게 없으면 안내 바가 대신 보낸 답장은 내 메시지가
  // 화면에 반영되기도 전에 "입력 중" 표시부터 뜨는 순서 역전이 생김
  const [pendingReplies, setPendingReplies] = useState<Map<string, { id: string; body: string; timestamp: string }>>(
    new Map(),
  );
  const previousUnreadRef = useRef<Map<string, number> | null>(null);
  const dataRef = useRef(data);
  const fieldWorkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 폴링(45초)과 사용자 액션(연차 사용 등) 직후의 refresh()가 겹칠 때, 나중에 "시작한" 게 아니라
  // 나중에 "응답이 온" 게 이겨버리면 방금 반영한 최신 상태를 낡은 폴링 응답이 덮어쓸 수 있음 —
  // 그래서 가장 최근에 시작된 refresh()의 결과만 반영되도록 순번으로 막는다
  const refreshSeqRef = useRef(0);
  dataRef.current = data;

  const clearHighlightedMessage = useCallback(() => setHighlightedMessageId(null), []);
  const highlightMessage = useCallback((id: string) => setHighlightedMessageId(id), []);
  const triggerTrialHint = useCallback(() => setTrialHintSignal((n) => n + 1), []);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    setError(null);
    try {
      await ensureSession();
      // 카카오 로그인처럼 브라우저가 리다이렉트됐다 돌아온 경우, 대기 중인 동의 기록을 여기서 마저 처리
      await finalizePendingConsent().catch(() => {});
      // 카톡 알림 재동의(talk_message)도 같은 방식으로 리다이렉트됐다 돌아오므로 여기서 같이 처리 —
      // 어느 페이지로 돌아오든(리다이렉트는 항상 origin 루트) refresh()가 전역에서 불려서 놓치지 않음
      await finalizePendingKakaoNotify().catch((err) => console.error("[kakao] 재동의 처리 실패:", err));
      const next = await api.getTodayWorkday();
      if (seq !== refreshSeqRef.current) return // 그 사이 더 최신 refresh()가 시작됐으면 이 낡은 응답은 버림

      if (previousUnreadRef.current && !next.needsOnboarding) {
        const arrival = findArrival(next, previousUnreadRef.current);
        if (arrival) {
          setBanner(arrival);
          // 타이머로 무조건 끄지 않고, 실제로 그 메시지가 보인 뒤(clearHighlightedMessage 호출 시)까지 유지 —
          // 체험판처럼 도착 시점과 실제로 그 화면을 보는 시점 사이에 몇 초 이상 차이가 나도 놓치지 않게
          if (arrival.messageId) setHighlightedMessageId(arrival.messageId);
        }
      }
      previousUnreadRef.current = buildUnreadMap(next);

      setData(next);
    } catch (err) {
      if (seq !== refreshSeqRef.current) return
      setError(err instanceof Error ? err.message : "오늘의 업무 정보를 불러오지 못했습니다.");
    } finally {
      if (seq === refreshSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || error || data.needsOnboarding) return;
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loading, error, data.needsOnboarding, refresh]);

  // /qa로 따로 분리해서 띄운 QA 도구 창(예: 듀얼 모니터 시연 녹화용)에서 조작하면, 이 창은
  // 최대 45초 폴링을 기다리지 않고 바로 반영되도록 즉시 refresh() — BroadcastChannel 미지원
  // 브라우저에서는 조용히 무시되고 기존 폴링으로만 반영됨
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(QA_ACTIONS_CHANNEL);
    channel.onmessage = () => refresh();
    return () => channel.close();
  }, [refresh]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const contacts = useMemo(() => data.contacts ?? [], [data.contacts]);
  const conversations = useMemo(() => data.conversations ?? [], [data.conversations]);
  const emailThreads = useMemo(() => data.emailThreads ?? [], [data.emailThreads]);
  const todayItems = useMemo(() => data.todayItems ?? [], [data.todayItems]);

  const getContactById = useCallback(
    (id: string) => contacts.find((contact) => contact.id === id),
    [contacts],
  );
  const getConversationById = useCallback(
    (id: string) => conversations.find((conversation) => conversation.id === id),
    [conversations],
  );
  const getEmailThreadById = useCallback(
    (id: string) => emailThreads.find((thread) => thread.id === id),
    [emailThreads],
  );

  const sendReply = useCallback(
    async (
      conversationId: string,
      text: string,
      subject?: string,
      hintLevel?: "word" | "sentence" | null,
      hintSentence?: string,
    ) => {
      const pendingId = `pending-${Date.now()}`;
      // 트리거 주체와 무관하게 항상 여기서 낙관적 표시를 채워야, 실제 화면 반영 순서가 항상
      // "내 메시지 표시 → 입력 중 → 상대 답장" 순으로 지켜진다
      setPendingReplies((prev) => new Map(prev).set(conversationId, { id: pendingId, body: text, timestamp: new Date().toISOString() }));
      setSendingIds((prev) => new Set(prev).add(conversationId));
      try {
        // postReply는 캐릭터의 답장까지 이미 생성해서 저장한 뒤에 응답한다(서버가 동기로 처리) —
        // 즉 이 시점에 실제로는 "입력 중"이 아니라 이미 답장이 존재하는 상태다. 그런데 그 다음
        // refresh()로 화면에 실제 메시지가 반영되기까지도 약간의 시차가 있어서, sendingIds를
        // refresh() 이후에 지우면 "실제 답장이 이미 보이는데 입력 중 표시가 한 프레임 더 남아있다
        // 사라지는" 어색한 깜빡임이 생긴다 — 그래서 "입력 중" 표시는 답장이 실제로 존재하게 된
        // 이 시점(postReply 완료)에 바로 끄고, 화면에 보이는 내 메시지(낙관적 표시)는 진짜 데이터가
        // 들어올 때까지 유지해서(pendingReplies는 refresh 이후에 지움) 끊김 없이 이어지게 한다
        await api.postReply(conversationId, text, subject, hintLevel, hintSentence);
        setSendingIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
        await refresh();
        // 시연 영상용 QA 토글이 켜져 있거나(수동), 체험판 계정이면(자동) 다음 예정 연락도
        // 기다리지 않고 바로 발송한다 — 체험판은 동료·상사·거래처가 실제 시간차를 두고
        // 도착하도록 예약돼 있는데(화면 설명하는 동안 다 와버리지 않게), 답장을 보내면 그
        // 타이머를 기다리지 않고 바로 다음 사람이 오게 해서 시연 흐름이 끊기지 않게 한다.
        // 여기서 await하면 이 대화의 "작성 중" 표시가 다른 대화 발송이 끝날 때까지 늘어져
        // 마치 이 상대가 계속 답장 중인 것처럼 보이므로, 별도로 흘려보낸다(fire-and-forget)
        if (isAutoAdvanceEnabled() || data.isTrial) {
          api.deliverNext().then(() => refresh()).catch(() => {});
        }
      } finally {
        setSendingIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
        setPendingReplies((prev) => {
          const next = new Map(prev);
          next.delete(conversationId);
          return next;
        });
      }
    },
    [refresh, data.isTrial],
  );

  const markRead = useCallback(
    async (conversationId: string) => {
      await api.markConversationRead(conversationId);
      await refresh();
    },
    [refresh],
  );

  const sendVent = useCallback(
    async (text: string) => {
      const result = await api.sendVent(text);
      await refresh();
      // 시연 영상용 QA 토글 — 고함항아리 답장도 다음 예정 연락을 이어서 당겨오게 함
      if (isAutoAdvanceEnabled()) {
        api.deliverNext().then(() => refresh()).catch(() => {});
      }
      return { conversationId: result.conversationId };
    },
    [refresh],
  );

  const finishWorkday = useCallback(async () => {
    if (!data.workday) return;
    await api.closeWorkday(data.workday.id);
    await refresh();
  }, [data.workday, refresh]);

  useEffect(() => {
    return () => {
      if (fieldWorkTimerRef.current) clearTimeout(fieldWorkTimerRef.current);
    };
  }, []);

  const goOnFieldWork = useCallback(async () => {
    const pendingIds = (dataRef.current.todayItems ?? [])
      .filter((item) => item.status === "pending")
      .map((item) => item.id);

    const result = await api.goOnFieldWork();
    await refresh();

    if (fieldWorkTimerRef.current) {
      clearTimeout(fieldWorkTimerRef.current);
      fieldWorkTimerRef.current = null;
    }

    if (pendingIds.length > 0 && !result.skipped) {
      setFieldWorkActiveUntil(Date.now() + FIELD_WORK_RENOTIFY_MS);

      fieldWorkTimerRef.current = setTimeout(() => {
        setFieldWorkActiveUntil(null);
        const current = dataRef.current;
        const item = (current.todayItems ?? []).find(
          (candidate) => pendingIds.includes(candidate.id) && candidate.status === "pending",
        );
        if (!item) return;

        const arrival = buildBannerForItem(item, current);
        if (!arrival) return;

        // OS/Web Push는 서버의 durable notification_schedules 하나만 담당한다.
        // 앱이 계속 열려 있는 경우에는 화면 안에서만 배너를 다시 띄워, 같은 시점에
        // 로컬 Notification + 서버 Push가 두 번 울리는 중복 알림을 막는다.
        setBanner(arrival);
      }, FIELD_WORK_RENOTIFY_MS);
    }

    return result;
  }, [refresh]);

  const deliverNext = useCallback(async () => {
    const result = await api.deliverNext();
    await refresh();
    return result;
  }, [refresh]);

  const takeLeave = useCallback(
    async (kind: Parameters<typeof api.postLeave>[0]) => {
      const result = await api.postLeave(kind);
      await refresh();
      return result;
    },
    [refresh],
  );

  const value = useMemo<WorkdayContextValue>(
    () => ({
      loading,
      error,
      needsOnboarding: data.needsOnboarding,
      workStatus: data.workStatus ?? null,
      workday: data.workday ?? null,
      contacts,
      conversations,
      emailThreads,
      todayItems,
      report: data.report ?? null,
      survey: data.survey ?? null,
      isTrial: data.isTrial ?? false,
      leaveBalance: data.leaveBalance ?? null,
      pendingReviewBanner: data.pendingReviewBanner ?? null,
      workContext: data.workContext ?? null,
      banner,
      dismissBanner,
      fieldWorkActiveUntil,
      sendingIds,
      highlightedMessageId,
      clearHighlightedMessage,
      highlightMessage,
      trialHintSignal,
      triggerTrialHint,
      pendingReplies,
      getContactById,
      getConversationById,
      getEmailThreadById,
      refresh,
      sendReply,
      sendVent,
      markRead,
      finishWorkday,
      goOnFieldWork,
      takeLeave,
      deliverNext,
    }),
    [
      loading,
      error,
      data.needsOnboarding,
      data.workStatus,
      data.workday,
      data.report,
      data.survey,
      data.isTrial,
      data.leaveBalance,
      data.pendingReviewBanner,
      data.workContext,
      contacts,
      conversations,
      emailThreads,
      todayItems,
      banner,
      dismissBanner,
      fieldWorkActiveUntil,
      sendingIds,
      highlightedMessageId,
      clearHighlightedMessage,
      highlightMessage,
      trialHintSignal,
      triggerTrialHint,
      pendingReplies,
      getContactById,
      getConversationById,
      getEmailThreadById,
      refresh,
      sendReply,
      sendVent,
      markRead,
      finishWorkday,
      goOnFieldWork,
      takeLeave,
      deliverNext,
    ],
  );

  return <WorkdayContext.Provider value={value}>{children}</WorkdayContext.Provider>;
}
