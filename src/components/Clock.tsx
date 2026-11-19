import { useEffect, useState } from "react";

export function Clock({ bare = false }: { bare?: boolean } = {}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const dateStr = now.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div
      className={`${bare ? "" : "glass rounded-2xl px-4 py-2.5 "}text-right font-display tabular-nums leading-tight`}
    >
      <div className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {hh}
        <span className="animate-pulse text-foreground/60">:</span>
        {mm}
        <span className="text-foreground/50 text-lg sm:text-xl">:{ss}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
        {dateStr}
      </div>
    </div>
  );
}
