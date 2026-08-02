-- ============================================================
-- Global Office — 몰입형 글로벌 오피스 영어
-- DB 스키마 초안 v0.1 (Supabase / PostgreSQL)
--
-- 기획서 16장 데이터 구조 + 6장 상태 정책 기반.
-- 이 파일은 "필드명 계약"의 근거입니다. 프론트 Mock/타입은 여기 컬럼명에 맞춥니다.
--
-- ⚠️ 확정 필요(수아): 아래 [CONFIRM] 표시 항목
--   - 휴가 상태 용어: 기획서=반차/연차/출근취소  vs  공동개발 가이드=외근
--     → 현재 leave_kind enum에 half_day/annual/cancel 로 정리, 외근 도입 시 field_work 추가
--   - 실제 회사명/기밀 저장 금지 정책은 앱 레벨에서 입력 제한 (DB엔 저장 안 함)
-- ============================================================

-- ---------- ENUM (상태값 계약) ----------

-- 하루 상태 (기획서 6-1)
create type day_state as enum (
  'IDLE',       -- 출근 전
  'COMMUTING',  -- 출근 후 취소 가능 유예
  'WORKING',    -- 근무 중(메시지 수신·답변)
  'HALF_DAY',   -- 반차
  'ON_LEAVE',   -- 연차
  'OFF_DUTY',   -- 퇴근(리포트 생성/확인 전)
  'DONE'        -- 리포트 확인 완료
);

-- 영어 수준
create type english_level as enum ('beginner', 'intermediate', 'advanced');

-- 상대 역할 (동료/상사/거래처/인사팀)
-- ⚠️ 'hr'은 신입사원 첫날 OJT 웰컴 이메일 전용 역할 추가 — 기존 DB엔
--   `alter type character_role add value if not exists 'hr';` 를 Supabase SQL Editor에서 직접 실행해야 함
--   (enum 값 추가는 재생성 없이 ALTER TYPE ADD VALUE로만 가능)
create type character_role as enum ('colleague', 'manager', 'client', 'hr');

-- 채널 유형
create type channel_type as enum ('messenger', 'email');

-- 메시지 발신 주체
create type message_sender as enum ('character', 'user');

-- 대화 진행 상태
create type conversation_status as enum (
  'scheduled',  -- 예약(미발송)
  'awaiting',   -- 도착·사용자 답변 대기
  'replied',    -- 사용자 답변함(후속 반응 대기)
  'done'        -- 마무리
);

-- 알림 발송 상태
create type notification_status as enum ('scheduled', 'sent', 'skipped', 'failed');

-- 휴가/취소 종류 (기획서 7장)  [CONFIRM: 외근(field_work) 도입 여부]
create type leave_kind as enum ('annual', 'half_day', 'cancel');

-- ---------- 계정/프로필 ----------

-- users: Supabase auth.users 를 기본 인증으로 사용, 앱 프로필만 별도 보관
create table app_users (
  id                   uuid primary key default gen_random_uuid(),
  auth_uid             uuid unique,                    -- supabase auth.users.id (체험계정은 null 허용)
  email                text,
  display_name         text,
  is_trial             boolean not null default false,
  privacy_consented_at timestamptz,                    -- 개인정보처리방침 동의 시각 (익명 체험 중엔 null)
  admin_role           text,                           -- 'full'(조회+삭제/변경) | 'readonly'(조회만) | null(일반 유저)
  created_at           timestamptz not null default now()
);

-- user_profiles: 온보딩 정보 (기획서 SCR-02/03)
create table user_profiles (
  user_id        uuid primary key references app_users(id) on delete cascade,
  industry       text,                         -- 업종
  job_role       text,                         -- 직무명
  main_tasks     text,                         -- 주요 업무
  contacts       text,                         -- 자주 소통하는 대상
  english_level  english_level not null default 'intermediate',
  start_time     time not null default '10:00',  -- 예상 출근시간(온보딩에서 입력)
  end_time       time not null default '18:00',  -- 예상 퇴근시간(온보딩에서 입력)
  lunch_time     time,
  daily_count    smallint not null default 3,  -- 하루 알림(연락) 횟수 — 기본 3(동료/상사/거래처 각 1), 3 초과분은 매일 랜덤 배정
  min_gap_min    smallint not null default 60, -- 연락 간 최소 간격(분) — 근무시간 전체에 맞춰 자동 조정되는 간격의 하한선
  use_korean_hint boolean not null default true,
  -- 캐릭터 커스터마이징(선택) — 채워지면 매일 시나리오 생성 시 이 이름/성격을 그대로 사용
  colleague_name        text,
  colleague_personality text,
  manager_name           text,
  manager_personality    text,
  client_name             text,
  client_personality      text,
  -- Settings에서 이름/성격을 바꿔 "새로운 사람"으로 리셋하기로 한 역할들(예: '["colleague"]') —
  -- 다음 출근일 시나리오 생성 시 해당 역할만 기억(memory) 연속성 없이 첫 만남으로 취급하고, 반영 후 자동으로 비움
  pending_persona_reset jsonb not null default '[]',
  -- 역할별 알림 시각 직접 지정(선택) — null이면 자동 계산 스케줄링을 따름
  colleague_notify_time time,
  manager_notify_time    time,
  client_notify_time     time,
  -- 승급/인사평가 (기존 회사 직급 체계: 사원-주임-대리-과장-차장-부장-이사)
  job_rank              text not null default '사원',
  -- 프로필 아바타로 쓸 직급 캐릭터 — job_rank 이하만 선택 가능(서버에서 검증), null이면 job_rank와 동일하게 표시
  avatar_rank            text,
  level_evaluated_at    timestamptz,              -- 마지막 승진 시각(승진 이력·표시용)
  evaluation_started_at timestamptz,               -- 인사평가 시작(문제까지 받음) 시각 — 제출 전까지 남아있으면 중도포기 신호
  -- 승급은 "연속 출근일수"가 직급별 요건(30/60/90/120/150/180일)을 채워야 함
  consecutive_days      integer not null default 0,
  -- 연차: 직급 연차(현재 직급 기준, 승급 시 새 직급 개수로 교체) + 적립 연차(연속 출근 5일마다 1개, 승급해도 유지)
  rank_leave_balance    integer not null default 2,
  earned_leave_balance  integer not null default 0,
  updated_at     timestamptz not null default now()
);

-- promotions: 승급 이력 — 인사평가 제출 시 1건씩 기록(대화상대별 만족도/개선제안 + 역량평가 문답 보관)
create table promotions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references app_users(id) on delete cascade,
  from_rank          text not null,
  to_rank            text not null,
  satisfaction       smallint,                    -- 동료/상사/거래처 만족도 평균
  persona_feedback   jsonb,                       -- [{role, name, satisfaction, suggestion}]
  test_qna           jsonb,                       -- 역량평가 3문항 + 유저 답변
  created_at         timestamptz not null default now()
);

-- ---------- 하루 / 시나리오 ----------

-- workdays: 날짜별 근무일 (기획서 16장 workdays)
create table workdays (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  work_date    date not null,
  state        day_state not null default 'IDLE',
  started_at   timestamptz,                    -- 출근 시각
  ended_at     timestamptz,                    -- 퇴근 시각
  leave_kind   leave_kind,                     -- 휴가 사용 시
  comfort_sent_at timestamptz,                 -- 오늘 스트레스 감지 위로 메시지를 이미 보냈는지(하루 1회 제한용)
  created_at   timestamptz not null default now(),
  unique (user_id, work_date)
);

-- scenarios: 당일 업무 사건 (기획서 8-1 Workday Scenario)
create table scenarios (
  id             uuid primary key default gen_random_uuid(),
  workday_id     uuid not null references workdays(id) on delete cascade,
  title          text not null,
  summary        text,
  project        text,
  goal           text,
  practice_areas text[],                       -- 연습할 표현 영역
  created_at     timestamptz not null default now()
);

-- characters: 동료·상사·거래처 설정 (기획서 14-2)
create table characters (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenarios(id) on delete cascade,
  role          character_role not null,
  channel       channel_type not null,
  name          text not null,
  title         text,                          -- 직급/소속
  register      text,                          -- 말투/격식 요약
  goal          text,                          -- 당일 업무 목표
  known_info    text,                          -- 알고 있는 정보
  unknown_info  text,                          -- 아직 모르는 정보
  color         text                           -- 표시 색상(선택)
);

-- ---------- 대화 / 메시지 ----------

-- conversations: 대화방/이메일 스레드 (기획서 16장 conversations)
create table conversations (
  id            uuid primary key default gen_random_uuid(),
  workday_id    uuid not null references workdays(id) on delete cascade,
  character_id  uuid not null references characters(id) on delete cascade,
  channel       channel_type not null,
  subject       text,                          -- 이메일 제목(메신저는 null)
  status        conversation_status not null default 'scheduled',
  scheduled_at  timestamptz,                   -- 최초 연락 예정 시각
  read_at       timestamptz,                   -- 사용자가 마지막으로 이 대화를 읽은 시각(안 읽었으면 null)
  kind          text not null default 'scenario',  -- 'scenario'(일반 업무 대화, 리포트 채점 대상) | 'vent'(마음 편하게 말 걸기 — 채점/리포트 제외) | 'review'(힌트 난이도 기반 복습 — 채점/리포트 제외) | 'checkin'(daily_count 초과분 후속 확인 — 리포트 채점 제외, 복습 대상) | 'ojt'(입사 첫날 HR 웰컴 메일 — 채점/리포트/복습 전부 제외)
  created_at    timestamptz not null default now()
);

-- messages: AI/사용자 메시지 (기획서 16장 messages)
create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender           message_sender not null,
  body             text not null,
  subject          text,                        -- 이메일 메시지 제목(선택)
  seq              integer not null,            -- 대화 내 순서
  hint_level       text,                        -- 사용자 답변 메시지에만: null(정상) | 'word' | 'sentence' — 답변 시 어디까지 힌트를 열었는지
  -- 상대(character) 메시지에만: LLM이 그 메시지와 함께 생성한 답장 힌트. 이전엔 생성만 하고 저장을 안 해서
  -- 화면에선 항상 채널 구분 없는 고정(mock) 힌트만 보여주고 있었음 — 실제로 저장해서 클라이언트에 넘긴다.
  korean_hint      text,
  reply_hints      jsonb,                       -- string[]
  word_hints       jsonb,                       -- [{ en, ko }]
  sent_at          timestamptz not null default now()
);

-- review_items: 힌트 난이도(word/sentence)로 표시된 답변에 대한 당일+익일 복습 추적
create table review_items (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references app_users(id) on delete cascade,
  workday_id               uuid not null references workdays(id) on delete cascade,  -- 어려움이 감지된 날
  contact_role             character_role not null,
  contact_name             text not null,
  hint_level               text not null,        -- 'word' | 'sentence'
  original_message         text not null,         -- 상대방의 원래 메시지
  answer_sentence          text not null,          -- 힌트로 보여줬던 정답 문장(문장 힌트)
  same_day_format          text,                    -- 'write' | 'fill_blank'
  same_day_conversation_id uuid references conversations(id) on delete set null,
  same_day_done_at         timestamptz,
  next_day_conversation_id uuid references conversations(id) on delete set null,
  next_day_done_at         timestamptz,
  created_at               timestamptz not null default now()
);

-- ---------- 알림 / 푸시 ----------

-- notification_schedules: 예약 알림 (기획서 16장 notification_schedules)
create table notification_schedules (
  id               uuid primary key default gen_random_uuid(),
  workday_id       uuid not null references workdays(id) on delete cascade,
  conversation_id  uuid references conversations(id) on delete cascade,
  scheduled_at     timestamptz not null,
  status           notification_status not null default 'scheduled',
  title            text,
  preview          text,
  route            text,                        -- 클릭 시 이동 경로 (/messenger/:id 등)
  sent_at          timestamptz
);

-- push_tokens: 웹 푸시 구독 (기획서 16장 push_tokens)
create table push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,                   -- 구독 공개키
  auth         text not null,                   -- 구독 auth secret
  user_agent   text,
  created_at   timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ---------- 리포트 / 연속성 ----------

-- daily_reports: 퇴근 리포트 (기획서 13장 스키마를 컬럼+jsonb 혼합으로)
create table daily_reports (
  id                     uuid primary key default gen_random_uuid(),
  workday_id             uuid not null unique references workdays(id) on delete cascade,
  workday_summary        text,
  good_expressions       jsonb not null default '[]',   -- [{text, note}]
  corrections            jsonb not null default '[]',   -- [{before, after, note}]
  register_feedback      jsonb not null default '{}',   -- {colleague, manager, client}
  recurring_issues       text[] not null default '{}',
  recommended_expressions jsonb not null default '[]',  -- [{en, ko, note}] (예전엔 text[]였음, 기존 DB는 별도 alter 필요)
  next_day_context       text,
  -- [{contactName, hintLevel, originalMessage, answerSentence}] — 단어/문장 힌트까지 연 "어려웠던 표현" 요약
  difficult_expressions  jsonb not null default '[]',
  created_at             timestamptz not null default now()
);

-- workday_memories: 다음날 전달용 요약 (기획서 15장)
create table workday_memories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_users(id) on delete cascade,
  workday_id    uuid not null references workdays(id) on delete cascade,
  summary       jsonb not null default '{}',    -- {events, promises, unfinished, agreed_terms, relationship, frequent_errors, next_events}
  created_at    timestamptz not null default now()
);

-- ---------- 근태 / 리워드 ----------

-- leave_records: 반차·연차·출근취소 (기획서 16장 leave_records)
create table leave_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  workday_id   uuid references workdays(id) on delete set null,
  kind         leave_kind not null,
  taken_at     timestamptz not null default now()
);

-- field_work_events: 외근 처리 이력 (관리자 대시보드에서 "이탈" 현황 확인용)
create table field_work_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  workday_id   uuid references workdays(id) on delete set null,
  source       text not null default 'app',  -- 'app'(인앱 버튼) | 'push'(알림 액션 버튼)
  created_at   timestamptz not null default now()
);

-- rewards: 출근 기록/배지 (기획서 16장 rewards, SCR-17)
create table rewards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  badge_key    text not null,                   -- first_commute, streak_3, first_client_email ...
  earned_at    timestamptz not null default now(),
  unique (user_id, badge_key)
);

-- ---------- CS 챗봇 / 설문조사 ----------

-- support_inquiries: 우측 하단 챗봇에서 "문의 남기기"로 접수된 CS 문의 (관리자 대시보드 CS 탭에서 확인)
create table support_inquiries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  message      text not null,
  status       text not null default 'open',   -- 'open' | 'resolved'
  created_at   timestamptz not null default now()
);

-- surveys: 만족도 조사(현재는 활성 설문 1개만 운영하는 단순 모델) — draft로 저장 후 "반영"하면 published=true(유저에게 배너 노출),
-- "노출하기"로 reviews_public=true 하면 관리자가 선택(featured)한 후기가 소개 페이지 하단에 롤링으로 공개됨
create table surveys (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default '만족도 조사',
  description    text,
  questions      jsonb not null default '[]',  -- 별점+후기 외 추가로 물어볼 자유 질문. [{text, placeholder}] —
                                                -- text: 질문 내용, placeholder: 답변란에 미리 보여줄 유도 문구(선택)
  published      boolean not null default false,
  published_at   timestamptz,
  reviews_public boolean not null default false,
  updated_at     timestamptz not null default now()
);

-- survey_responses: 유저별 응답(별점 + 후기 + 추가 질문 답변). source로 배너(1회성)/챗봇 3단계(반복 가능)를 구분 —
-- 챗봇은 이미 불만이 있는 상태에서 쓰는 경우가 많아 배너 응답과 평균을 분리해서 봐야 함
create table survey_responses (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references surveys(id) on delete cascade,
  user_id      uuid not null references app_users(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  review       text,
  answers      text[] not null default '{}',    -- surveys.questions 순서에 대응하는 자유 답변(선택)
  featured     boolean not null default false,   -- 관리자가 소개 페이지에 노출할 후기로 선택했는지
  public_review       text,                     -- 소개 페이지에 실제로 보여줄 문구(관리자가 개인정보 마스킹 등 편집한 버전, featured 확정 시 저장)
  public_display_name text,                     -- 소개 페이지에 보여줄 비식별 작성자 표기(실제 이름/이메일 노출 금지, 관리자가 지정)
  source       text not null default 'banner',  -- 'banner' | 'chat_preset' | 'chat_freeform' | 'chat_inquiry'
  occurrence   integer not null default 1,       -- 챗봇 응답은 그 유저의 몇 번째 챗봇발 응답인지(배너는 항상 1)
  created_at   timestamptz not null default now()
  -- ⚠️ 유저당 1회 제한(unique survey_id, user_id)은 없앰 — 챗봇 응답은 반복 허용.
  --   배너는 코드(getActiveSurveyForUser의 alreadyRespondedViaBanner)에서만 1회로 제한.
);

-- ---------- 인덱스 (조회 최적화) ----------
create index on workdays (user_id, work_date desc);
create index on conversations (workday_id);
create index on messages (conversation_id, seq);
create index on notification_schedules (status, scheduled_at);
create index on push_tokens (user_id);

-- ---------- RLS (Row Level Security) — 배포 전 활성화 필요 ----------
-- TODO(수아): Supabase에서 각 테이블 RLS 활성화 후
--   "auth.uid() = 해당 행의 user_id 소유자"만 select/insert/update 하도록 정책 추가.
-- alter table app_users enable row level security;  ... (이하 동일)
