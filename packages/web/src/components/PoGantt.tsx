import { useMemo } from 'react';
import { parseISO, todayMs, monthTicks, fmtMonth, fmtDate } from '../lib/dates';

// Per-component PO dependency timeline (models the prototype POGanttDrawer).
export interface PoItem {
  code: string; type: 'ingredient' | 'packaging'; ordered: boolean;
  vendor: string | null; mode: string; badge: 'CN' | 'US'; leadDays: number; leadReal: boolean;
  orderBy: string | null; arrival: string | null;
}
export interface PoTimeline {
  orderId: string; sku: string; name: string; units: number; status: string;
  orderDate: string | null; needBy: string | null; formula: string;
  ingredients: PoItem[]; packaging: PoItem[];
  counts: { packagingOrdered: number; packagingTotal: number; ingredientOrdered: number; ingredientTotal: number };
  phases: { compound: P; fill: P; micro: P & { days: number }; ready: string };
}
interface P { start: string; end: string }

const LABEL_W = 230;
const ING = 'var(--good)';
const PKG = 'var(--cap)';

export function PoGantt({ t }: { t: PoTimeline }) {
  const { ticks, today, pos } = useMemo(() => {
    const today = todayMs();
    const all = [
      ...t.ingredients.flatMap((i) => [parseISO(i.orderBy), parseISO(i.arrival)]),
      ...t.packaging.flatMap((i) => [parseISO(i.orderBy), parseISO(i.arrival)]),
      parseISO(t.phases.compound.start), parseISO(t.phases.ready), parseISO(t.orderDate), today,
    ].filter((x): x is number => x != null);
    const min = Math.min(...all), max = Math.max(...all);
    const pad = (max - min) * 0.03 || 7 * 86_400_000;
    const ds = min - pad, de = max + pad;
    const span = de - ds || 1;
    return { ds, de, ticks: monthTicks(ds, de), today, pos: (ms: number) => ((ms - ds) / span) * 100 };
  }, [t]);

  const Bar = ({ item }: { item: PoItem }) => {
    const s = parseISO(item.orderBy), e = parseISO(item.arrival);
    if (s == null || e == null) return null;
    const left = pos(s), right = pos(e), width = Math.max(1.5, right - left);
    const color = item.type === 'ingredient' ? ING : PKG;
    // hatched "remaining" = from max(today, start) to arrival (not yet landed)
    const hatchFrom = Math.max(left, pos(today));
    const hatchW = Math.max(0, right - hatchFrom);
    return (
      <div className="po-track">
        <div className="po-bar" style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: item.ordered ? 1 : 0.4, outline: item.ordered ? 'none' : `1.5px dashed ${color}`, outlineOffset: -1 }}>
          <span className="po-bar-lab">{item.mode}·{item.leadDays}d</span>
        </div>
        {hatchW > 0.4 && <div className="po-hatch" style={{ left: `${hatchFrom}%`, width: `${hatchW}%` }} />}
        <span className="po-diamond" style={{ left: `${right}%`, background: color, opacity: item.ordered ? 1 : 0.5 }} title={`arrives ${fmtDate(e)}`} />
      </div>
    );
  };

  const Row = ({ item }: { item: PoItem }) => (
    <div className="po-row">
      <div className="po-label" style={{ width: LABEL_W }}>
        <div className="po-label-main">
          <span className={`origin-badge ${item.badge === 'CN' ? 'cn' : 'us'}`}>{item.badge}</span>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{item.code}</span>
        </div>
        <div className="po-sub" style={{ color: item.ordered ? 'var(--good)' : 'var(--crit)' }}>
          {item.ordered ? '✓ Ordered' : '● Not ordered'} · <span className="muted">{item.vendor ?? item.mode}</span>
        </div>
      </div>
      <Bar item={item} />
    </div>
  );

  // production region positions
  const cStart = parseISO(t.phases.compound.start), fEnd = parseISO(t.phases.fill.end);
  const mStart = parseISO(t.phases.micro.start), ready = parseISO(t.phases.ready);

  return (
    <div className="po-gantt">
      <div className="gantt-axis" style={{ marginLeft: LABEL_W }}>
        {ticks.map((tk) => <span key={tk} className="gantt-tick" style={{ left: `${pos(tk)}%` }}>{fmtMonth(tk)}</span>)}
        <span className="gantt-today-label" style={{ left: `${pos(today)}%` }}>today</span>
        {ready != null && <span className="gantt-marker-label" style={{ left: `${pos(ready)}%`, color: 'var(--good)' }}>ready</span>}
      </div>

      <div className="po-body">
        {/* today + ready vertical lines */}
        <div className="gantt-todayline" style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pos(today) / 100})` }} />
        {ready != null && <div className="gantt-markerline" style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pos(ready) / 100})`, borderColor: 'var(--good)' }} />}
        {mStart != null && <div className="gantt-markerline" style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pos(mStart) / 100})`, borderColor: 'var(--warn)' }} />}

        <div className="po-group">① Ingredient POs <span className="po-cnt">{t.counts.ingredientOrdered}/{t.counts.ingredientTotal} ordered</span></div>
        {t.ingredients.map((i) => <Row key={i.code} item={i} />)}

        <div className="po-group">② Packaging POs <span className="po-cnt">{t.counts.packagingOrdered}/{t.counts.packagingTotal} ordered</span></div>
        {t.packaging.map((i) => <Row key={i.code} item={i} />)}

        <div className="po-group">③ Production &amp; Micro QC</div>
        <div className="po-row">
          <div className="po-label" style={{ width: LABEL_W }}>
            <div className="po-label-main"><span className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>Compound → fill → micro</span></div>
            <div className="po-sub muted">{t.phases.micro.days}-day micro / PET hold</div>
          </div>
          <div className="po-track">
            {cStart != null && fEnd != null && <div className="po-bar" style={{ left: `${pos(cStart)}%`, width: `${Math.max(1.5, pos(fEnd) - pos(cStart))}%`, background: 'var(--ink)' }}><span className="po-bar-lab">compound · fill</span></div>}
            {mStart != null && ready != null && <div className="po-bar po-micro" style={{ left: `${pos(mStart)}%`, width: `${Math.max(1.5, pos(ready) - pos(mStart))}%` }}><span className="po-bar-lab">micro</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
