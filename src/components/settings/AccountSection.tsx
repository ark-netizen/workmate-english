import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/api";
import { finalizePendingConsent, signIn, signInWithKakao, signUp, signUpWithKakao } from "@/lib/auth";
import { subscribePush } from "@/lib/push";
import { supabase } from "@/lib/supabaseClient.js";
import type { ProfileResponse } from "@/types/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailErrorFor(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  // Supabase(GoTrue)는 아스키 이메일만 허용 — 한글 등 non-ASCII가 있으면 서버에서 "invalid format"으로 거부되므로
  // 클라이언트에서 먼저 한국어로 안내한다.
  if ([...trimmed].some((ch) => ch.charCodeAt(0) > 127)) return "이메일 주소에 한글은 쓸 수 없어요. 영문·숫자로 입력해주세요.";
  if (!EMAIL_PATTERN.test(trimmed)) return "올바른 이메일 형식이 아니에요 (예: name@example.com)";
  return null;
}

function passwordErrorFor(password: string): string | null {
  if (!password) return null;
  if (password.length < 6) return "비밀번호는 6자 이상이어야 해요.";
  return null;
}

function passwordConfirmErrorFor(password: string, confirm: string): string | null {
  if (!confirm) return null;
  if (password !== confirm) return "비밀번호가 일치하지 않아요.";
  return null;
}

export function AccountSection({
  profile,
  onAccountChanged,
  initialMode = "signin",
}: {
  profile: ProfileResponse;
  onAccountChanged: () => void | Promise<void>;
  initialMode?: "signup" | "signin";
}) {
  const [mode, setMode] = useState<"signup" | "signin">(initialMode);
  // 온보딩 전(인트로 페이지 등)이라 profile.display_name이 아직 없는 경우, 여기서 바로 입력받는다
  const [name, setName] = useState(profile.display_name ?? "");
  const [email, setEmail] = useState("");
  // 브라우저 자동완성/비밀번호 관리자가 input의 DOM value만 채우고 React onChange를
  // 안 태우는 경우가 있어서(자동완성 값이 화면엔 보이는데 email state는 여전히 빈 문자열),
  // 제출 시점엔 이 ref로 실제 DOM 값을 한 번 더 확인해서 state와 다르면 그걸 우선한다.
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [emailTakenError, setEmailTakenError] = useState<string | null>(null);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "계정" 카드를 보여줄지 판단할 때, 이메일 없이 카카오로만 로그인한 경우(이메일 동의 안 함)도
  // 놓치지 않도록 identity 목록을 같이 확인한다 — 안 그러면 이 케이스는 회원가입 폼으로 빠진다
  const [kakaoLinked, setKakaoLinked] = useState(false);

  // 카카오 로그인은 브라우저가 통째로 리다이렉트됐다 돌아오는 방식이라, 돌아온 직후
  // 대기 중이던 개인정보처리방침 동의를 마저 기록하고 최신 프로필을 다시 읽어와야 함
  useEffect(() => {
    finalizePendingConsent().then((finalized) => {
      if (finalized) onAccountChanged();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (profile.email || kakaoLinked) {
    return (
      <section className="space-y-2 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground/70">계정</h2>
        {profile.email ? (
          <p className="text-sm">{profile.email}</p>
        ) : (
          <p className="text-sm">카카오 계정으로 로그인되어 있어요</p>
        )}
        <p className="text-xs text-foreground/40">계정으로 로그인되어 있어 다른 기기에서도 이어서 사용할 수 있어요.</p>
      </section>
    );
  }

  const effectiveName = name.trim();
  const needsNameInput = !(profile.display_name ?? "").trim();

  const trimmedEmail = email.trim();
  const emailError = emailErrorFor(email);
  const passwordError = mode === "signup" ? passwordErrorFor(password) : null;
  const passwordConfirmError = mode === "signup" ? passwordConfirmErrorFor(password, passwordConfirm) : null;

  const canSubmitSignup =
    trimmedEmail.length > 0 &&
    !emailError &&
    password.length >= 6 &&
    password === passwordConfirm &&
    agreePrivacy &&
    effectiveName.length > 0;
  const canSubmitSignin = trimmedEmail.length > 0 && !emailError && password.length > 0;
  const canSubmitKakaoSignup = agreePrivacy && effectiveName.length > 0;

  const handleSubmit = async () => {
    setError(null);
    setEmailTakenError(null);

    // 자동완성이 React state를 못 거치고 DOM에만 값을 채운 경우를 대비해,
    // 제출 직전 실제 input의 값을 한 번 더 확인해서 state와 다르면 그걸 사용한다.
    const domEmail = emailInputRef.current?.value ?? "";
    const resolvedEmail = domEmail.trim() || trimmedEmail;
    if (domEmail.trim() && domEmail.trim() !== trimmedEmail) {
      setEmail(domEmail);
    }
    const resolvedEmailError = emailErrorFor(resolvedEmail);

    if (!resolvedEmail) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (resolvedEmailError) {
      setError(resolvedEmailError);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!canSubmitSignup) return;
        if (needsNameInput) await api.postProfile({ display_name: effectiveName });
        await signUp({ email: resolvedEmail, password, displayName: effectiveName });
      } else {
        if (!canSubmitSignin) return;
        await signIn({ email: resolvedEmail, password });
        // 지금까지는 온보딩 "시작하기"에서만 알림 권한을 물어봐서, 온보딩을 이미 끝낸 계정으로
        // 다른 기기(예: 발표용 노트북)에 로그인하면 알림을 켤 방법이 설정 화면밖에 없었다.
        // 로그인 클릭은 사용자 제스처라 이 자리에서 요청해야 브라우저가 권한창을 띄워준다.
        // 이미 허용/차단을 고른 브라우저에서는 다시 묻지 않는다(default일 때만).
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          subscribePush().catch(() => {});
        }
      }
      // onAccountChanged가 다음 화면(오늘의 업무 불러오기 등)까지 끝내는 비동기 작업이라,
      // 이걸 기다리지 않고 submitting을 먼저 꺼버리면 버튼은 "로그인"으로 돌아왔는데 화면은
      // 아직 안 넘어가는 어색한 정지 구간이 생긴다 — 실제로 넘어갈 때까지 "처리 중"을 유지한다.
      await onAccountChanged();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (mode === "signup" && (code === "email_exists" || code === "identity_already_exists")) {
        setEmailTakenError("이미 가입된 이메일이에요. 위에서 \"로그인\" 탭으로 전환해 로그인해주세요.");
      } else {
        setError(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKakao = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!canSubmitKakaoSignup) return;
        if (needsNameInput) await api.postProfile({ display_name: effectiveName });
        await signUpWithKakao(); // 성공 시 카카오 인증 페이지로 이동하며 여기서 끝남
      } else {
        await signInWithKakao();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 문제가 발생했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground/70">계정</h2>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-2 py-1 ${mode === "signup" ? "bg-accent/10 text-accent" : "text-foreground/50"}`}
          >
            회원가입
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-md px-2 py-1 ${mode === "signin" ? "bg-accent/10 text-accent" : "text-foreground/50"}`}
          >
            로그인
          </button>
        </div>
      </div>

      <p className="text-xs text-foreground/40">
        {mode === "signup"
          ? "지금까지 사용한 데이터는 그대로 유지된 채 계정만 연결돼요. 위 \"이름\"에 입력한 이름으로 가입됩니다."
          : "다른 기기에서 만든 계정으로 로그인하면, 지금 이 브라우저의 임시 데이터는 사라집니다."}
      </p>

      <div className="space-y-3">
        {mode === "signup" && needsNameInput && (
          <label className="block space-y-1 text-xs text-foreground/50">
            이름
            <input
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
              placeholder="예: 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label className="block space-y-1 text-xs text-foreground/50">
          이메일
          <input
            ref={emailInputRef}
            type="email"
            autoComplete="email"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none ${
              emailError || emailTakenError ? "border-red-400" : "border-border"
            }`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailTakenError(null);
            }}
            // 브라우저 자동완성(저장된 주소/계정 등)이 onChange 없이 값만 채우는 경우가
            // 있어서, 필드에서 포커스가 빠질 때(자동완성 선택 직후 등) 한 번 더 동기화한다.
            onBlur={(e) => {
              if (e.target.value !== email) setEmail(e.target.value);
            }}
          />
        </label>
        {(emailError || emailTakenError) && (
          <p className="-mt-2 text-xs text-red-600">{emailError || emailTakenError}</p>
        )}
        <label className="block space-y-1 text-xs text-foreground/50">
          비밀번호 {mode === "signup" && "(6자 이상)"}
          <input
            type="password"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none ${
              passwordError ? "border-red-400" : "border-border"
            }`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {passwordError && <p className="-mt-2 text-xs text-red-600">{passwordError}</p>}

        {mode === "signup" && (
          <>
            <label className="block space-y-1 text-xs text-foreground/50">
              비밀번호 확인
              <input
                type="password"
                className={`mt-1 w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none ${
                  passwordConfirmError ? "border-red-400" : "border-border"
                }`}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </label>
            {passwordConfirmError && <p className="-mt-2 text-xs text-red-600">{passwordConfirmError}</p>}
            <label className="flex items-start gap-2 text-xs text-foreground/60">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
              />
              <span>
                <Link to="/privacy" target="_blank" className="text-accent underline">
                  개인정보처리방침
                </Link>
                에 동의합니다. (필수)
              </span>
            </label>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleKakao}
          disabled={submitting || (mode === "signup" && !canSubmitKakaoSignup)}
          className="rounded-md bg-[#FEE500] px-4 py-1.5 text-sm font-medium text-black/85 hover:opacity-90 disabled:opacity-50"
        >
          {mode === "signup" ? "카카오로 계속하기" : "카카오로 로그인"}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (mode === "signup" ? !canSubmitSignup : !canSubmitSignin)}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "처리 중..." : mode === "signup" ? "회원가입" : "로그인"}
        </button>
      </div>

      <div className="border-t border-border pt-3 text-center text-xs text-foreground/50">
        {mode === "signin" ? (
          <>
            회원가입이 필요하신가요?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-medium text-accent underline underline-offset-2"
            >
              회원가입하러 가기
            </button>
          </>
        ) : (
          <>
            이미 계정이 있으신가요?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="font-medium text-accent underline underline-offset-2"
            >
              로그인하러 가기
            </button>
          </>
        )}
      </div>
    </section>
  );
}
