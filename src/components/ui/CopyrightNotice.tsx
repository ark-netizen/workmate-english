export const COPYRIGHT_NOTICE =
  "© 2026 WorkMate English. Created with AI assistance. Unauthorized use prohibited.";

export function CopyrightNotice({ className = "" }: { className?: string }) {
  return (
    <p className={className} style={{ fontSize: "10.5px" }}>
      {COPYRIGHT_NOTICE}
    </p>
  );
}
