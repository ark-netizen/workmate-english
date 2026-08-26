const FOLD_LOGIN_NOTICE_ID = "foldable-login-notice";

function isFoldableMobileExperience() {
  if (window.innerWidth < 768) return false;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const touchCapable = navigator.maxTouchPoints > 0;
  return coarsePointer || (touchCapable && noHover);
}

function closeFoldLoginNotice() {
  document.getElementById(FOLD_LOGIN_NOTICE_ID)?.remove();
}

function openFoldLoginNotice() {
  closeFoldLoginNotice();

  const overlay = document.createElement("div");
  overlay.id = FOLD_LOGIN_NOTICE_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "PC 이용 안내");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483100",
    display: "grid",
    placeItems: "center",
    padding: "20px",
    background: "rgba(0, 0, 0, 0.42)",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    boxSizing: "border-box",
    width: "min(100%, 340px)",
    border: "1px solid rgba(120, 135, 160, 0.2)",
    borderRadius: "18px",
    background: "var(--surface, #fff)",
    color: "var(--foreground, #1f2328)",
    padding: "22px 20px 18px",
    textAlign: "center",
    boxShadow: "0 20px 56px rgba(20, 35, 55, 0.24)",
  });
  panel.innerHTML = `
    <div style="font-size:26px;line-height:1">💻</div>
    <strong style="display:block;margin-top:10px;font-size:15px;line-height:1.4">실제 서비스 이용은 PC에서 가능해요</strong>
    <p style="margin:7px 0 0;color:#68758a;font-size:12px;line-height:1.55;word-break:keep-all">모바일·폴더블에서는 1분 무료체험 미리보기를 볼 수 있어요. 로그인 후 실제 답장·첨삭 체험은 PC에서 이용해주세요.</p>
    <button type="button" data-fold-login-close style="width:100%;min-height:42px;margin-top:16px;border:0;border-radius:999px;background:#1a56ff;color:#fff;font:700 13px Pretendard, sans-serif">확인</button>
  `;

  panel.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-fold-login-close]")) closeFoldLoginNotice();
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeFoldLoginNotice();
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  panel.querySelector<HTMLButtonElement>("[data-fold-login-close]")?.focus();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      if (!isFoldableMobileExperience()) return;
      const target = event.target instanceof Element
        ? event.target.closest(".intro-login-btn, .intro-final-button")
        : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openFoldLoginNotice();
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFoldLoginNotice();
  });
}