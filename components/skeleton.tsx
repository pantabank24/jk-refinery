// Loading placeholders. A skeleton says "this is the shape of what is coming";
// a spinner says "something is happening". So these replace every wait for
// CONTENT, while a spinner stays on the waits for an ACTION — saving a sale,
// clearing bills — where there is no shape to promise.

/** One shimmering block. Pass the size through className. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`sk-shimmer sk-reveal rounded-xl ${className}`} />;
}

/** Plain lines — for a small inline area inside a card. */
export function SkeletonLines({
  count = 3,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`sk-reveal flex flex-col gap-y-2 ${className}`} role="status" aria-label="กำลังโหลด">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock
          key={i}
          // The last line stops short, the way a paragraph does.
          className={`h-3.5 ${i === count - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** A list of rows — the shape every list page settles into. */
export function SkeletonList({
  rows = 6,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`sk-reveal flex flex-col gap-y-2 ${className}`} role="status" aria-label="กำลังโหลดรายการ">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex flex-row items-center gap-x-3 rounded-2xl border-1 border-black/10 bg-black/5 p-3"
        >
          <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-y-2 min-w-0">
            <SkeletonBlock className="h-3.5 w-1/3" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
          <SkeletonBlock className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** A row of stat tiles. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="sk-reveal grid grid-cols-2 gap-2 lg:grid-cols-4" role="status" aria-label="กำลังโหลด">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-y-2 rounded-2xl border-1 border-black/10 bg-black/5 p-3"
        >
          <SkeletonBlock className="h-3 w-1/2" />
          <SkeletonBlock className="h-5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Form fields — for edit/detail screens. */
export function SkeletonForm({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="sk-reveal flex flex-col gap-y-3 rounded-3xl border-1 border-black/10 bg-black/5 p-4"
      role="status"
      aria-label="กำลังโหลดข้อมูล"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-y-1.5">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

/**
 * A whole page. Used where the old spinner filled the viewport (`h-full`), so the
 * layout does not collapse to a centred dot and then jump when the data lands.
 */
export function SkeletonPage({
  stats = true,
  rows = 5,
}: {
  stats?: boolean;
  rows?: number;
}) {
  return (
    <div className="sk-reveal flex flex-col gap-y-3 py-5" role="status" aria-label="กำลังโหลดหน้า">
      <div className="flex flex-row items-center justify-between gap-x-3">
        <SkeletonBlock className="h-7 w-52" />
        <SkeletonBlock className="h-9 w-28 rounded-2xl" />
      </div>
      {stats && <SkeletonStats />}
      <SkeletonList rows={rows} />
    </div>
  );
}
