export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-foreground/60">
        요청하신 페이지가 존재하지 않습니다.
      </p>
    </div>
  );
}
