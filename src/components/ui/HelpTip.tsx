import { useState } from "react";

// 한 번만 보여주면 충분히 익힐 거라고 보고, 그 이후엔 계속 떠 있지 않게 함
const MAX_SHOWN = 1;

function shouldShow(id: string): boolean {
  try {
    const key = `go_help_tip_${id}`;
    const count = Number(window.localStorage.getItem(key) || "0");
    if (count >= MAX_SHOWN) return false;
    window.localStorage.setItem(key, String(count + 1));
    return true;
  } catch {
    return true; // localStorage 사용 불가(프라이빗 모드 등) — 이번엔 그냥 보여줌
  }
}

// 라벨만으로는 뭘 하는 버튼인지 바로 안 와닿는 경우 옆에 붙이는 "?" 배지 —
// 마우스를 올리면(포커스도 동일) 위에 짧은 설명이 뜬다. CSS만으로 동작(JS 상태 없음).
// 아이콘(선 하나짜리 원)은 이 크기에서 테두리가 옅어 물음표만 둥둥 떠 보이므로,
// 배경을 채운 작은 원 배지 위에 직접 "?"를 그려 확실히 원 안에 있는 것처럼 보이게 한다.
// id는 이 도움말을 몇 번 보여줬는지 localStorage에 기록해 구분하는 키 — 초기 유저에게만
// 몇 번 보이고, 그 뒤로는(같은 브라우저에서) 자동으로 사라진다.
export function HelpTip({ text, id }: { text: string; id: string }) {
  const [visible] = useState(() => shouldShow(id));

  if (!visible) return null;

  return (
    <span tabIndex={0} className="group relative inline-flex shrink-0 outline-none">
      <span
        style={{ backgroundColor: "rgba(31, 35, 40, 0.12)" }}
        className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none text-foreground/60 group-hover:text-foreground/80 group-focus-visible:text-foreground/80"
      >
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-44 -translate-x-1/2 rounded-md bg-foreground px-2 py-1.5 text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {text}
      </span>
    </span>
  );
}
