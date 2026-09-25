/**
 * Skeletons are shaped like the content they replace — that is what makes a
 * wait read as faster than a spinner. Spinners stay for atomic actions
 * (saving, generating a document), where there is no layout to preview.
 */

export function Skeleton({ w, h = 12, className = "" }: { w?: number | string; h?: number; className?: string }) {
  return <div className={`sk ${className}`} style={{ width: w ?? "100%", height: h }} />;
}

export function SkeletonText({ lines = 3, width = "100%" }: { lines?: number; width?: string }) {
  return (
    <>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="text" w={i === lines - 1 ? "62%" : width} />
      ))}
    </>
  );
}

/** Mirrors PageHead so the title does not jump when data lands. */
export function PageHeadSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="pagehead">
      <div style={{ flex: 1 }}>
        <Skeleton w={220} h={19} />
        <div style={{ marginTop: 8 }}><Skeleton w={300} h={12} /></div>
      </div>
      <div className="actions">
        {Array.from({ length: actions }).map((_, i) => <Skeleton key={i} w={110} h={32} />)}
      </div>
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid k4">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat" key={i}>
          <Skeleton w={90} h={11} />
          <div style={{ marginTop: 10 }}><Skeleton w={64} h={24} /></div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ["38%", "62%", "50%", "44%", "56%", "48%", "40%"];
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      <div className="tablewrap">
        <table className="dt">
          <thead>
            <tr>{Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton w={i === 0 ? 90 : 70} h={11} /></th>
            ))}</tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}><Skeleton w={widths[(r + c) % widths.length]} h={12} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ListPageSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <>
      <PageHeadSkeleton />
      <TableSkeleton cols={cols} />
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <PageHeadSkeleton actions={0} />
      <StatsSkeleton />
      <div style={{ height: 16 }} />
      <div className="grid k2">
        {[0, 1].map((i) => (
          <div className="card" key={i}>
            <div className="card-head"><Skeleton w={140} h={14} /></div>
            <div className="card-body"><SkeletonText lines={5} /></div>
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} cols={4} />
    </>
  );
}

export function EditorSkeleton() {
  return (
    <>
      <div className="rechead">
        <div className="top">
          <div style={{ flex: 1 }}>
            <Skeleton w={280} h={19} />
            <div style={{ marginTop: 8 }}><Skeleton w={200} h={12} /></div>
          </div>
          <div className="actions"><Skeleton w={96} h={32} /><Skeleton w={96} h={32} /></div>
        </div>
        <div className="recfacts">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="fact" key={i}>
              <Skeleton w={70} h={10} />
              <div style={{ marginTop: 6 }}><Skeleton w={110} h={13} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="tabs">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="tab" key={i}><Skeleton w={72} h={13} /></div>
        ))}
      </div>
      <div className="editor">
        <div>
          <div className="card"><div className="card-body">
            <div className="grid k3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}><Skeleton w={80} h={11} /><div style={{ marginTop: 6 }}><Skeleton h={32} /></div></div>
              ))}
            </div>
          </div></div>
          <div className="card"><div className="card-body"><SkeletonText lines={4} /></div></div>
        </div>
        <div className="card"><div className="card-body"><SkeletonText lines={8} /></div></div>
      </div>
    </>
  );
}

export function KanbanSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <>
      <PageHeadSkeleton actions={0} />
      <div className="kanban">
        {Array.from({ length: cols }).map((_, c) => (
          <div className="kcol" key={c}>
            <h3><Skeleton w={90} h={11} /></h3>
            {Array.from({ length: 2 + (c % 2) }).map((_, i) => (
              <div className="kcard" key={i}>
                <Skeleton w="70%" h={13} />
                <div style={{ marginTop: 8 }}><Skeleton w="50%" h={11} /></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function FormSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <>
      <PageHeadSkeleton />
      {Array.from({ length: groups }).map((_, g) => (
        <div className="card" key={g}>
          <div className="card-head"><Skeleton w={150} h={14} /></div>
          <div className="card-body">
            <div className="grid k3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}><Skeleton w={80} h={11} /><div style={{ marginTop: 6 }}><Skeleton h={32} /></div></div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
