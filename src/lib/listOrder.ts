// 메신저/이메일 목록을 유저가 드래그로 직접 순서를 바꿀 수 있게 하는 로컬 저장 순서.
// "오늘의 연락"(홈 화면)은 실제 도착 순서를 그대로 보여줘야 하므로 이 로직을 쓰지 않는다.
const keyFor = (listKey: string) => `list_order_${listKey}`;

export function getCustomOrder(listKey: string): string[] {
  try {
    const raw = localStorage.getItem(keyFor(listKey));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function setCustomOrder(listKey: string, ids: string[]): void {
  localStorage.setItem(keyFor(listKey), JSON.stringify(ids));
}

// 저장된 순서대로 재배치하고, 아직 순서에 없는 새 항목(새로 온 대화 등)은 기본 순서 그대로 맨 앞에 끼워 넣는다.
export function applyCustomOrder<T extends { id: string }>(items: T[], listKey: string): T[] {
  const order = getCustomOrder(listKey);
  if (!order.length) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  return [...byId.values(), ...ordered];
}

// 드래그로 index를 옮긴 뒤 결과 배열을 만들고, 그 순서를 저장한다.
export function reorder<T extends { id: string }>(items: T[], fromIndex: number, toIndex: number, listKey: string): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  setCustomOrder(
    listKey,
    next.map((item) => item.id),
  );
  return next;
}
