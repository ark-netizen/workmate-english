// LLM 생성 프롬프트 빌더 (기획서 17장 기능 단위)
// 각 함수는 { system, user, schema } 를 돌려준다 — 제공자(Claude 등)에 독립적.
// 실제 호출/JSON 파싱은 client.js 에서 담당.
//
// 설계 원칙 (기획서 14-1): 한국어를 번역하지 않고, 업무 상황+역할 정보로 영어를 직접 생성.

import { REGISTERS, REACTION_TYPES, GENERATION_GUARDRAILS } from './registers.js'

const LEVEL_HINT = {
  beginner: `Keep it very simple: short sentences (under ~10 words each), one idea per sentence.
Use common, everyday words only — no idioms, no phrasal verbs, no slang, no compressed/ellipted phrasing (e.g. avoid "Any updates you've heard?" — write "Did you hear anything new?" instead).
Prefer simple present/past tense.
Keep the WHOLE message to ONE main ask or topic — do not combine multiple separate requests, questions, or pieces of information into a single message (e.g. do not ask about the timeline AND mention a formatting detail AND ask about legal review all at once). Pick the single most important thing and say only that. The message overall should be short (roughly 2-3 short sentences for a messenger chat, a bit more for an email) — never a dense multi-part message.`,
  intermediate: 'Use natural everyday business English; some idioms are fine, but avoid rare/advanced vocabulary. Prefer one main ask per message over stacking several unrelated requests together.',
  advanced: 'Use fluent, nuanced business English with varied structures.',
}

const jsonInstruction = (schemaText) =>
  `Return ONLY valid minified JSON, no markdown, matching this shape:\n${schemaText}`

// 이메일 등 formal greeting에서 "[Name]" 같은 placeholder를 안 쓰게 실제 이름 or 대체 표현을 지정
const nameLine = (profile) =>
  profile.display_name
    ? `The user's name is "${profile.display_name}" — use it in greetings (e.g. "Dear ${profile.display_name},").`
    : `The user's name is unknown — do NOT invent or use a placeholder like "[Name]"/"[User's Name]". Use a name-free greeting instead (e.g. "Hi there," / "Hello," / "Dear Team,").`

// 사용자가 설정한 동료/상사/거래처 이름·성격(선택) + 인사평가에서 남긴 개선 제안(선택) —
// 있으면 시나리오 생성 시 그대로 고정/반영
function buildCharacterPresetLines(profile, personaFeedback) {
  const roles = [
    ['colleague', profile.colleague_name, profile.colleague_personality],
    ['manager', profile.manager_name, profile.manager_personality],
    ['client', profile.client_name, profile.client_personality],
  ].filter(([role, name, personality]) => name || personality || personaFeedback?.[role])

  if (!roles.length) return ''

  const lines = roles.map(([role, name, personality]) => {
    const parts = []
    if (name) parts.push(`MUST be named exactly "${name}"`)
    if (personality) parts.push(`personality/tone: ${personality}`)
    const feedback = personaFeedback?.[role]
    if (feedback) parts.push(`the user specifically asked for this in how ${role} writes to them, keep applying it every day: ${feedback}`)
    return `- The "${role}" character ${parts.join('; ')}. Reflect this in their "register" field.`
  })

  return `Fixed character identities (use these, don't invent new ones for these roles):\n${lines.join('\n')}\n`
}

// resetRoles에 담긴 역할은 이름/성격이 바뀌어 "새로운 사람"으로 취급 — 어제까지의 기억을 그 역할에는 안 이어붙인다
function buildPersonaResetLines(resetRoles) {
  if (!resetRoles?.length) return ''
  return `Even though a "Continue from yesterday" summary is given below, the following role(s) are brand-new people the user is meeting for the very first time today — do NOT reference any prior shared history, familiarity, or past events with them, write their part of the scenario as a first encounter: ${resetRoles.join(', ')}. Other role(s) not listed here continue their established relationship as usual.\n`
}

// ── 1. generateScenario — 하루 Workday Scenario + 세 역할 (기획서 8-1) ──
export function buildScenarioPrompt({ profile, previousMemory, resetRoles, personaFeedback }) {
  const system = `You design one coherent workday context for an immersive English-at-work service.
The user handles ONE shared business event across three relationships: colleague, manager, and client.
The event is shared; only each person's purpose, register, and channel differ.
${GENERATION_GUARDRAILS}`

  const user = `User profile:
- Industry: ${profile.industry}
- Role: ${profile.job_role}
- Main tasks: ${profile.main_tasks}
- Frequent contacts: ${profile.contacts}
- English level: ${profile.english_level}. ${LEVEL_HINT[profile.english_level] || ''}

${previousMemory ? `Previous workday memory:
${JSON.stringify(previousMemory)}
Continue the same topic when there is a meaningful next stage in next_events, unfinished work, promises, review results, or additional requests. Move the work forward rather than repeating yesterday.` : 'This is a fresh day.'}

${buildPersonaResetLines(resetRoles)}
${buildCharacterPresetLines(profile, personaFeedback)}

Create exactly ONE shared work event for today. The home context card and all three role messages must refer to this same event, deliverable, deadline, and stage.

Relationship rules:
- colleague: casual messenger check-in or coordination about the shared event
- manager: clear messenger request, progress check, decision, or deadline about the shared event
- client: polite formal email request, confirmation, feedback, or schedule coordination about the shared event
The three people do not all perform the same task. They approach the same event from their own relationship and purpose.

Topic progression rules:
- Prefer advancing the previous topic through a realistic next stage: drafting → review → revision → upload/delivery → confirmation → final approval/result sharing.
- Do not keep a topic alive when it is completed, has no meaningful next step, or would produce repetitive messages.
- In that case, switch naturally to a new event that fits the user's industry, role, and main tasks, and set topic_status to "switched".
- A topic commonly lasts about 2–5 workdays, but do not force a fixed duration.
- Preserve prior history in memory even when switching topics.

Make the event concrete: include an actual deliverable, system/tool, quantity, deadline, review point, or decision. All three roles must reference the same concrete details.
Do not put colleague, manager, or client names in the event title, summary, goal, stage, or reply guidance. Names belong only in sender identity, natural greetings, and email sign-offs.
Korean and English context fields must express exactly the same meaning.
The home card only displays "stage" and, per character, "purpose" (title/summary/goal are internal only, used for generating messages, not shown to the user as-is) — keep every displayed field SHORT and scannable, like a task-list headline, never a full sentence:
- stage_ko/stage_en: a 2-4 word status label (e.g. "최종 검토 중" / "Final review").
- Each character's purpose_ko/purpose_en: a 2-5 word label naming ONLY that person's angle on today's shared event, not the event itself and not other people's parts (e.g. colleague "진행상황 파악" / "Checking progress", manager "마감 확인" / "Confirming the deadline", client "조건 확인" / "Confirming terms"). Never include a name inside purpose_ko/purpose_en — the name is shown separately next to it.

${jsonInstruction(`{
  "title_en": string,
  "title_ko": string,
  "summary_en": string,
  "summary_ko": string,
  "goal_en": string,
  "goal_ko": string,
  "stage_en": string,
  "stage_ko": string,
  "topic_status": "active"|"completed"|"switched",
  "practice_areas": string[],
  "characters": [
    { "role": "colleague"|"manager"|"client", "channel": "messenger"|"email",
      "name": string, "title": string, "register": string,
      "goal": string, "known_info": string, "unknown_info": string,
      "purpose_en": string, "purpose_ko": string }
  ]
}`)} `

  return { system, user, schema: 'scenario' }
}

// 동료의 "첫 메시지"에만 적용 — 후속 답장(buildRoleResponsePrompt)까지 매번 적용하면 대화 중간에 계속 인사를
// 반복하게 되어 부자연스러워지므로, 하루의 첫 연락에서만 캐주얼한 도입부를 강제한다
const COLLEAGUE_OPENER_RULE = `- ALWAYS start with one short casual line before the work topic — a greeting, a callback to something earlier (weekend, a day off/vacation, lunch, a small complaint they made before), or a light joke. This is what makes a colleague feel different from a manager/client — don't skip straight to business unless the event is genuinely urgent. Rotate the opener, don't reuse the same one two days in a row.
- Right after that opener, get straight to a SPECIFIC, concrete point using today's event details (the actual deliverable/number/deadline) — never stay vague with filler like "I'll send you something later" or "let's talk about that thing." The user should immediately understand exactly what's being asked.`

// reply_hints는 화면 길이·복습량을 위해 정확히 1개만 생성한다(예전엔 2-3개). 메신저와 이메일(거래처 등)에서
// 요구되는 실제 답장 형태가 다르므로 — 메신저는 캐주얼한 한두 마디, 이메일은 인사말(Dear/Hi)+본문+맺음말을
// 갖춘 실제 이메일 한 통 분량이어야 자연스럽다. 채널 구분 없이 똑같이 짧게만 주면 이메일 힌트가 채팅 힌트와
// 다를 바 없어져서 나눔. 배열(reply_hints: string[])은 유지하되 항상 원소 1개만 담게 한다.
function replyHintsInstruction(character, profile) {
  const noNameInBody = `Do not insert the user's name, account ID, Korean nickname, or any character name into the English body unless it is genuinely required. Names may appear only in a natural email greeting or sign-off.`
  const signOffRule = profile?.display_name
    ? `If a sign-off needs a name, use the user's real display name exactly once after the closing.`
    : `If the user's name is unavailable, end after the closing and never invent a placeholder.`

  if (character.channel === 'email') {
    return `- reply_hints: an array with EXACTLY ONE string containing one concise professional email reply. Use a greeting, no more than 2-3 complete body sentences, and a closing. Politely confirm the request, state the action/progress, and give the relevant schedule when applicable. ${noNameInBody} ${signOffRule} Never output placeholders such as "[Your Name]", "{{user_name}}", an account ID, or a fake team name.`
  }
  if (character.role === 'manager') {
    return `- reply_hints: an array with EXACTLY ONE string containing 1-2 easy but complete sentences for reporting to a manager. Include the completed action, current progress, next action, or deadline as relevant. Every sentence must have an explicit subject and verb. Never use fragments such as "Text updated.", "Checking now.", or "Will submit." ${noNameInBody}`
  }
  return `- reply_hints: an array with EXACTLY ONE string containing one short, natural, complete messenger reply to a colleague. Keep it casual and use common everyday workplace English, but do not use sentence fragments. ${noNameInBody}`
}

// korean_hint는 "이 메시지가 무슨 뜻인지"만 알려주는 게 아니라, 한국어로도 뭐라고 답할지조차 막막한
// 초심자를 위해 "이렇게 답해보라"는 방향까지 한국어로 제시해야 한다. word_hints/reply_hints는 그 방향을
// 실제로 영어로 어떻게 말하는지를 보여주는 다음 단계이므로, 순서가 자연스럽게 이어지게 한다.
// (korean_hint가 제안한 방향과 reply_hints가 서로 다른 얘기를 하면 힌트 단계끼리 안 맞아 보이므로,
// 서로 짝을 맞추라고 위 replyHintsInstruction에서도 명시적으로 되짚어준다)
const KOREAN_HINT_INSTRUCTION = `- korean_hint: Write a compact Korean guide in this exact multiline structure:
요청 요약
<one Korean sentence summarizing what the sender needs>

답장에 포함할 내용
“<first thing the user should say>”
“<second thing the user should say, when needed>”
“<third thing the user should say, only when needed>”
Use 2-3 quoted reply points, each on its own line. Do not merge system explanation and reply advice into one paragraph. Do not write long meta phrases such as "이 메시지는 ~ 요청입니다" or "~라고 답변해보세요". The quoted Korean points and the single English reply_hints entry must communicate the same actions in the same order.`

// ── 2. generateRoleMessage — 역할별 최초 메시지 (기획서 8-2) ──
export function buildRoleMessagePrompt({ scenario, character, profile }) {
  const reg = REGISTERS[character.role]
  const system = `You are ${character.name}, the user's ${character.role} (${character.title}).
${reg.rules}
${character.role === 'colleague' ? COLLEAGUE_OPENER_RULE : ''}
${character.register ? `Your personal tone/personality: ${character.register}` : ''}
${GENERATION_GUARDRAILS}`

  const user = `Today's work event: ${scenario.title}
${scenario.summary}
Your goal today: ${character.goal}
You know: ${character.known_info}
You do NOT yet know: ${character.unknown_info}
User's English level: ${profile.english_level}. ${LEVEL_HINT[profile.english_level] || ''}
${nameLine(profile)}

Write your FIRST message to the user about this event, in your register.

Also help the user (a Korean English learner) reply:
${KOREAN_HINT_INSTRUCTION}
${replyHintsInstruction(character, profile)}
- word_hints: 3-5 key English words/phrases useful for replying in this register, each with a short Korean meaning.

${character.channel === 'email'
      ? jsonInstruction('{ "subject": string, "body": string, "korean_hint": string, "reply_hints": string[], "word_hints": [{ "en": string, "ko": string }] }')
      : jsonInstruction('{ "body": string, "korean_hint": string, "reply_hints": string[], "word_hints": [{ "en": string, "ko": string }] }')}`

  return { system, user, schema: character.channel === 'email' ? 'email_message' : 'message' }
}

// ── 3. generateRoleResponse — 사용자 답변 기반 후속 반응 (기획서 9-2/9-3) ──
export function buildRoleResponsePrompt({ scenario, character, history, userReply, profile, isFinalTurn }) {
  const reg = REGISTERS[character.role]
  const system = `You are ${character.name}, the user's ${character.role} (${character.title}).
${reg.rules}
${character.register ? `Your personal tone/personality: ${character.register}` : ''}
React AS THIS PERSON, not as a teacher. Do NOT correct grammar or score the reply.
If the reply is vague about dates/numbers/conditions, choose "reconfirm" or "ask_more" and ask a specific question.
Reaction types: ${REACTION_TYPES.join(', ')}.
${isFinalTurn ? `This is the LAST exchange allowed today, whether or not things are fully resolved. Wrap up naturally in character — e.g. you're stepping out (field work / a meeting / heading out) and can't keep replying, so suggest continuing tomorrow. Use "close" as the reaction_type and set needs_followup to false. Do NOT leave a new question hanging.` : ''}
${character.channel === 'email' ? nameLine(profile) : ''}
${GENERATION_GUARDRAILS}`

  const user = `Event: ${scenario.title} — ${scenario.summary}
Conversation so far:
${history.map((m) => `${m.sender === 'user' ? 'User' : character.name}: ${m.body}`).join('\n')}

User just replied: "${userReply}"

Decide how ${character.name} naturally reacts and write the reply in register.

${isFinalTurn ? 'This is the last exchange — no reply hints needed, leave korean_hint/reply_hints/word_hints empty.' : `Also help the user reply, same as before:
${KOREAN_HINT_INSTRUCTION}
${replyHintsInstruction(character, profile)}
- word_hints: 3-5 key English words/phrases useful for replying, each with a short Korean meaning.`}

${character.channel === 'email'
      ? jsonInstruction('{ "reaction_type": string, "subject": string, "body": string, "needs_followup": boolean, "korean_hint": string, "reply_hints": string[], "word_hints": [{ "en": string, "ko": string }] }')
      : jsonInstruction('{ "reaction_type": string, "body": string, "needs_followup": boolean, "korean_hint": string, "reply_hints": string[], "word_hints": [{ "en": string, "ko": string }] }')}`

  return { system, user, schema: character.channel === 'email' ? 'email_response' : 'response' }
}

// ── 4. generateDailyReport — 퇴근 리포트 (기획서 13장) ──
export function buildDailyReportPrompt({ scenario, conversations, profile, previousIssues }) {
  const system = `You are an experienced Korean business-English tutor writing a calm "workday retrospective" for a Korean learner
(NOT a scorecard, NOT a test result). Tone: supportive, never scolding. Do not highlight errors harshly.
Analyze the user's actual replies across the three relationships.

LANGUAGE RULE (very important):
- Keep actual English sentences/phrases the user wrote or should have written EXACTLY in English (the "text"/"before"/"after"/"en" fields below).
- Write EVERY explanation, comment, and summary in Korean (모든 note/summary/feedback/issue 텍스트는 한국어) — like a Korean English-teacher's comment written on a paper: explain the grammar point, nuance, or word-choice reason in plain Korean so the user immediately understands WHY, not just what changed.
${GENERATION_GUARDRAILS}`

  const transcript = conversations
    .map(
      (c) =>
        `# ${c.role} (${c.channel})\n${c.messages
          .map((m) => `${m.sender === 'user' ? 'User' : c.role}: ${m.body}${m.isHintCopy ? ' [SUGGESTED_SENTENCE_COPIED_VERBATIM]' : ''}`)
          .join('\n')}`,
    )
    .join('\n\n')

  const user = `Event: ${scenario.title}
User English level: ${profile.english_level}
${previousIssues?.length ? `Recurring weak points to watch: ${previousIssues.join(', ')}` : ''}

Transcript:
${transcript}

Write the report, following the language rule above strictly.
- A line marked "[SUGGESTED_SENTENCE_COPIED_VERBATIM]" means the user copied our own suggested sentence hint exactly, word-for-word — it is NOT something the user composed themselves. NEVER put a marked sentence in "corrections" (correcting the user for using our own suggestion is unfair and confusing). A marked sentence MAY appear in "good_expressions" if it's genuinely a good phrase to remember, but do not overuse this — prefer sentences the user actually wrote on their own when available.
- good_expressions: up to 4 sentences the user actually wrote well (fewer is fine if the user only wrote 1-2 sentences total — never list more items than the user actually wrote, and never pad with weak/borderline examples just to reach a count). "text" = the exact English sentence. "note" = 한국어로 왜 잘 썼는지(문법/뉘앙스 포인트) 설명.
- corrections: up to 4 sentences that genuinely needed fixing, drawn ONLY from sentences the user actually composed themselves (never a marked verbatim-copied line). If the user's reply was short and already natural, or every sentence was a copied suggestion, it is completely fine to return 0 corrections — do NOT invent, split, or manufacture extra corrections just to fill a quota. Never list more corrections than distinct self-written sentences the user actually wrote. "before"/"after" = exact English (what they wrote vs. the natural version). "note" = 한국어로 어떤 문법/표현 규칙 때문에 고쳐야 하는지 교사처럼 설명.
- register_feedback: 한국어로, 동료/상사/거래처 각각에게 쓴 톤이 상황에 적절했는지 코멘트.
- register_feedback.comparison: 오늘은 동료/상사/거래처 모두 같은 사건(${scenario.title})에 대해 대화했다는 점을 살려서, 유저가 실제로 쓴(또는 힌트로 제시된) 표현을 최소 2곳 이상 짧게 인용해 "같은 내용인데 상대에 따라 이렇게 표현이 달라졌다"를 한국어로 짚어주는 한 단락. 유저가 특정 관계에서 답장을 안 했으면 그 관계는 자연스럽게 생략. 대화를 실제로 안 한 관계가 2개 이상이면 이 필드는 빈 문자열로 둬도 됨.
- recurring_issues: 한국어로, 반복되는 실수 패턴.
- recommended_expressions: 오늘 대화에서 나온 것 중 다음에도 꼭 기억해두면 좋을 표현 3-5개. "en" = 실제 영어 표현, "ko" = 한국어 뜻, "note" = 한국어로 언제/어떻게 쓰는지 + 문법 포인트 한 줄.
- workday_summary / next_day_context: 한국어로.

${jsonInstruction(`{
  "workday_summary": string (한국어),
  "good_expressions": [{ "text": string (English), "note": string (한국어) }],
  "corrections": [{ "before": string (English), "after": string (English), "note": string (한국어) }],
  "register_feedback": { "colleague": string (한국어), "manager": string (한국어), "client": string (한국어) },
  "recurring_issues": string[] (한국어),
  "recommended_expressions": [{ "en": string (English), "ko": string (한국어), "note": string (한국어) }],
  "next_day_context": string (한국어)
}`)}`

  return { system, user, schema: 'daily_report' }
}

// ── 5. createWorkdayMemory — 익일 전달용 요약 (기획서 15장) ──
export function buildWorkdayMemoryPrompt({ scenario, conversations, report }) {
  const system = `Summarize today so tomorrow's scenario can continue seamlessly.
Keep it compact and factual — this is passed into tomorrow's generation, not shown to the user.`

  const user = `Event: ${scenario.title} — ${scenario.summary}
Report summary: ${report?.workday_summary || ''}
Key exchanges:
${conversations.map((c) => `${c.role}: ${c.messages.map((m) => m.body).join(' | ')}`).join('\n')}

${jsonInstruction(`{
  "events": string,
  "promises": string,
  "unfinished": string,
  "agreed_terms": string,
  "relationship": string,
  "frequent_errors": string[],
  "next_events": string
}`)}`

  return { system, user, schema: 'workday_memory' }
}

// ── 6. buildPeriodReportPrompt — 주간/월간 누적 리포트 (여러 daily_reports를 서술형으로 종합) ──
export function buildPeriodReportPrompt({ rangeLabel, days, profile }) {
  const system = `You are an English coach writing a ${rangeLabel} progress report for a business-English learner
(job: ${profile.job_role || 'unknown'}, industry: ${profile.industry || 'unknown'}, level: ${profile.english_level}).
This is a NARRATIVE summary across multiple days, not a single-day recap — read across all days and point out
patterns, trends, and recurring issues rather than just listing each day separately.
Tone: encouraging, like a mentor reviewing progress over time. Write in Korean.
${GENERATION_GUARDRAILS}`

  const daysText = days
    .map(
      (d) =>
        `# ${d.work_date}\n요약: ${d.workday_summary || '(기록 없음)'}\n잘한 표현: ${(d.good_expressions || []).map((g) => g.text).join(', ') || '없음'}\n교정: ${(d.corrections || []).map((c) => `${c.before} → ${c.after}`).join(', ') || '없음'}\n반복 이슈: ${(d.recurring_issues || []).join(', ') || '없음'}`,
    )
    .join('\n\n')

  const user = `아래는 최근 ${days.length}개 근무일의 기록입니다.

${daysText}

이 기간 전체를 종합해서 서술형 리포트를 작성해주세요. (한국어로)
${jsonInstruction(`{
  "headline": string,
  "narrative": string,
  "strengths": string[],
  "recurring_issues": string[],
  "recommended_focus": string[]
}`)}`

  return { system, user, schema: 'period_report' }
}

// ── 7. buildOjtWelcomePrompt — 입사 첫날 HR 웰컴 이메일 (OJT Week Day 1) ──
export function buildOjtWelcomePrompt({ profile }) {
  const system = `You are the HR/People team, sending a welcome email to a brand-new employee on their literal first day at the company.
${REGISTERS.hr.rules}
${GENERATION_GUARDRAILS}`

  const user = `New hire profile:
- Industry: ${profile.industry || 'unknown'}
- Role: ${profile.job_role || 'unknown'}
- English level: ${profile.english_level}. ${LEVEL_HINT[profile.english_level] || ''}
${nameLine(profile)}

Write the welcome email for their very first day at "Global Office" (this kicks off their OJT — on-the-job-training — week).
Cover briefly, in this order: (1) a warm welcome to the team, (2) their internal company mail and chat accounts are now set up and ready to use, (3) a reminder that when they finish work each day they should press the "clock out" button, (4) they can also manage their annual leave through the system, (5) end with warm encouragement (fighting spirit / good luck) and ask them to simply reply with a short greeting to confirm they've seen this email. Do NOT invent unrelated agenda items like a specific lunch meeting time, unconnected training sessions, or an obscure internal acronym — everything mentioned should be something this app actually has.
End by asking for a simple reply, not a task list.
Formatting: write natural flowing paragraphs, NOT one blank line between every single sentence. Group related points into 2-3 short paragraphs (e.g. greeting in one; the practical items together in one or two; the closing/encouragement in one) — a real email does not isolate each sentence on its own line.

Also help the user reply:
${KOREAN_HINT_INSTRUCTION}
- reply_hints: an array with EXACTLY ONE string — a short, warm greeting-style reply confirming they've seen the email, matching what was asked (a simple reply, not a detailed task report). A brief greeting (e.g. "Hi,"), 1-2 sentences that genuinely thank them and confirm they're ready to get started, and a closing + sign-off (e.g. "Best regards,"). Keep it short — this should NOT read like a task-completion report. ${profile.display_name ? `End the sign-off with the user's real name, "${profile.display_name}" — never invent a placeholder like "[Your Name]".` : `The user's name isn't set, so end with just "Best regards," and stop — never invent a placeholder name.`} Do not include a second option.
- word_hints: 3-5 key English words/phrases useful for replying, each with a short Korean meaning.

${jsonInstruction('{ "subject": string, "body": string, "korean_hint": string, "reply_hints": string[], "word_hints": [{ "en": string, "ko": string }] }')}`

  return { system, user, schema: 'email_message' }
}

// ── 9. buildVentResponsePrompt — "업무 스트레스 풀기" 캐주얼 채팅 (채점/교정 없음) ──
// isComfortPing이면 유저 메시지 없이 시스템이 먼저 안부를 묻는 메시지(외근/미응답이 잦을 때 발송).
export function buildVentResponsePrompt({ character, history, userText, profile, isComfortPing }) {
  const system = `You are ${character.name}, the user's easygoing, supportive coworker (${character.title || ''}).
This is NOT a business scenario and NOT a grading/practice exercise — it's a casual, judgment-free chat where the
user can vent about work stress in English, or just chat, without being corrected or scored.
- Respond warmly and briefly (1-3 short sentences), like a real close coworker texting — natural spoken English,
  contractions fine, a light emoji is okay (0-1).
- Validate the user's feelings first before anything else.
- NEVER correct their grammar, NEVER mention mistakes, NEVER make it feel like a lesson or a test.
- Every reply, naturally weave in ONE small extra (vary which one, don't repeat the same flavor twice in a row):
  (a) a short, well-known English proverb/quote about work, perseverance, or rest, or
  (b) a casual English phrase people actually use to vent/complain about work (e.g. "I'm swamped", "What a day",
      "I need a breather") that the user could reuse themselves.
  Either way, include its Korean meaning naturally in your reply so the user picks it up without it feeling like a lesson.
${LEVEL_HINT[profile?.english_level] || ''}
${GENERATION_GUARDRAILS}`

  const historyText = history.map((m) => `${m.sender === 'user' ? 'User' : character.name}: ${m.body}`).join('\n')

  const user = isComfortPing
    ? `The user seems to have had a rough day today (frequent "still out of office"/delayed replies) — you're
proactively checking in, not reacting to a message. Write ONE short, warm check-in: acknowledge it sounds like a
busy/tough day, ask how they're doing, and include one of the two flavors from the system prompt above (proverb OR
a casual venting phrase, with its Korean meaning). Keep it casual, not preachy.

- korean_hint: 1 short sentence in Korean explaining what you just said, so the user isn't lost.

${jsonInstruction('{ "body": string, "korean_hint": string }')}`
    : `Conversation so far:
${historyText || '(no messages yet — this is the user starting the chat)'}

User just said: "${userText}"

Reply naturally as ${character.name}, following the rules above.

- korean_hint: 1 short sentence in Korean explaining what you just said, so the user isn't lost (leave empty if your reply is very simple).

${jsonInstruction('{ "body": string, "korean_hint": string }')}`

  return { system, user, schema: 'vent_message' }
}

// 번역 톤도 관계별 격식 차이를 살려야 원문의 캐주얼/격식 대비가 번역에서 뭉개지지 않음
const TRANSLATION_REGISTER_HINT = {
  colleague: '친한 동료끼리 메신저로 대화하는 톤으로, 반말에 가까운 편한 구어체로 번역 — 어미를 "~요/~드립니다" 같은 격식체로 섞지 말고 끝까지 캐주얼하게 유지.',
  manager: '상사에게 보고하듯 정중하지만 담백한 존댓말로 번역.',
  client: '외부 거래처에 보내는 격식 있는 이메일 톤으로, 정중한 존댓말로 번역.',
  hr: '인사팀이 보내는 정중하고 따뜻한 존댓말로 번역.',
}

// ── 10. buildTranslationPrompt — 받은 메시지/이메일 "번역" 버튼 ──
export function buildTranslationPrompt({ text, role }) {
  const registerHint = TRANSLATION_REGISTER_HINT[role]
  const system = `You translate English business messages into natural, fluent Korean.
Translate meaning, not word-for-word — read like something a Korean speaker would actually write/say.
${registerHint ? `Register: ${registerHint} 문장 전체에서 이 톤을 일관되게 유지 — 한 문장은 캐주얼하고 다음 문장은 격식체로 섞이면 안 됨.` : ''}
Do not add explanations, notes, or commentary — just the translation itself.`

  const user = `Translate this into Korean:

"""
${text}
"""

${jsonInstruction('{ "translation": string }')}`

  return { system, user, schema: 'translation' }
}

// ── 11. buildSupportAnswerPrompt — 우측 하단 CS 챗봇 FAQ 자동 응답 ──
export function buildSupportAnswerPrompt({ question }) {
  const system = `You are the customer support assistant for "부캐영어(WorkMate English)", a Korean business-English
learning app. Answer in Korean, briefly and warmly (2-4 sentences).

Service facts you can use to answer:
- The app simulates a virtual workday: users get messages/emails from AI "동료(colleague)", "상사(manager)",
  "거래처(client)" characters, in a scenario auto-generated from the user's industry/job.
- Each contact message can show 3 hint levels (단어 힌트/한국어 힌트/문장 힌트), unlocked in order.
- "외근 중" button delays pending messages by 90 minutes.
- 반차/연차 (half-day/annual leave) skip the rest of today's messages.
- 퇴근하기 ends the day and generates a Korean-explained report (잘한 표현/교정/필수 암기/총평).
- "고함항아리" (in Messenger) is a casual, judgment-free chat with a colleague character to vent about work
  stress in English — separate from the graded scenario, no correction/scoring there.
- Reports page also shows weekly/monthly cumulative reports and real work-hour history with a graph.
- Received messages/emails have a "번역" button for a Korean translation.

If the question is a bug report, account/billing issue, or anything you genuinely can't resolve with the facts
above, say so plainly and suggest using the "문의 남기기" button so a real person can follow up — don't make up
an answer you're not sure about.`

  const user = `사용자 질문: "${question}"

${jsonInstruction('{ "answer": string }')}`

  return { system, user, schema: 'support_answer' }
}

// ── 12. buildEvaluationQuestionsPrompt — 인사평가 역량평가 문제 3개 (승급 심사) ──
// 그동안 쌓인 교정 데이터(약점)와 유저 프로필/영어 수준을 반영해, 이 사람이 "도전하되 풀 수 있는" 난이도의
// 비즈니스 영어 작문 과제를 3개 생성한다. (채점이 아니라 역량 확인용 — 무조건 승진)
export function buildEvaluationQuestionsPrompt({ profile, weakPoints, rank, nextRank }) {
  const system = `You are an English coach designing a short in-house "promotion competency check" (${rank} → ${nextRank})
for a Korean business-English learner. Produce exactly 3 short writing tasks.
Design principle: calibrate difficulty to the learner's level — challenging but achievable, NOT a trick test.
Each task asks the learner to WRITE one business-English sentence/short message for a realistic work situation
in their industry/role. Target the learner's known weak points so the check is meaningful.
${LEVEL_HINT[profile.english_level] || ''}
${GENERATION_GUARDRAILS}`

  const user = `Learner profile:
- Industry: ${profile.industry || 'unknown'}
- Role: ${profile.job_role || 'unknown'}
- Main tasks: ${profile.main_tasks || 'unknown'}
- English level: ${profile.english_level || 'intermediate'}
${weakPoints?.length ? `Recurring weak points / things they got corrected on before:\n- ${weakPoints.slice(0, 8).join('\n- ')}` : 'No specific weak-point history yet.'}

Write exactly 3 tasks.
- "prompt": the task itself, phrased in Korean (what situation to write about + what to convey), so the learner clearly understands what to write. Do NOT include the English answer.
- "korean_hint": 1 short Korean line hinting at a key expression or point to watch (grammar/register), without giving the full answer.

${jsonInstruction('{ "questions": [{ "prompt": string (한국어), "korean_hint": string (한국어) }] }')}`

  return { system, user, schema: 'evaluation_questions' }
}

export const PROMPT_BUILDERS = {
  scenario: buildScenarioPrompt,
  roleMessage: buildRoleMessagePrompt,
  roleResponse: buildRoleResponsePrompt,
  dailyReport: buildDailyReportPrompt,
  workdayMemory: buildWorkdayMemoryPrompt,
  periodReport: buildPeriodReportPrompt,
  ojtWelcome: buildOjtWelcomePrompt,
  ventResponse: buildVentResponsePrompt,
  translation: buildTranslationPrompt,
  supportAnswer: buildSupportAnswerPrompt,
}
