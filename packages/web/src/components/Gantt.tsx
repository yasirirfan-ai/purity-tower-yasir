import { useMemo } from 'react';
import { parseISO, todayMs, monthTicks, fmtMonth, fmtDate } from '../lib/dates';

export interface GanttRow {
  id: string;
  label: string;        // primary (e.g. SKU)
  sublabel?: string;    // secondary (e.g. component description)
  badge?: string;       // origin badge text (CN / US)
  color: string;        // bar color
  start: string | null; // ISO order date
  end: string | null;   // ISO expected arrival
  carrier?: string;     // logistics caption
  tooltip?: string;
  onClick?: () => void;
}

const LABEL_W = 240;
const MIN_BAR_PCT = 1.2;

export interface GanttMarker { date: string | null; label: string; color: string }

export function Gantt({ rows, markers = [] }: { rows: GanttRow[]; markers?: GanttMarker[] }) {
  const { domainStart, domainEnd, ticks, today } = useMemo(() => {
    const today = todayMs();
    const starts = rows.map((r) => parseISO(r.start)).filter((x): x is number => x != null);
    const ends = rows.map((r) => parseISO(r.end)).filter((x): x is number => x != null);
    const mk = markers.map((m) => parseISO(m.date)).filter((x): x is number => x != null);
    const all = [...starts, ...ends, ...mk, today];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.04 || 86_400_000 * 7;
    const domainStart = min - pad;
    const domainEnd = max + pad;
    return { domainStart, domainEnd, ticks: monthTicks(domainStart, domainEnd), today };
  }, [rows, markers]);

  const span = domainEnd - domainStart || 1;
  const pos = (ms: number) => ((ms - domainStart) / span) * 100;

  if (rows.length === 0) return <div className="muted" style={{ padding: 20 }}>No orders to plot.</div>;

  return (
    <div className="gantt">
      {/* axis */}
      <div className="gantt-axis" style={{ marginLeft: LABEL_W }}>
        {ticks.map((t) => (
          <span key={t} className="gantt-tick" style={{ left: `${pos(t)}%` }}>{fmtMonth(t)}</span>
        ))}
        <span className="gantt-today-label" style={{ left: `${pos(today)}%` }}>today</span>
        {markers.map((m) => {
          const ms = parseISO(m.date);
          return ms == null ? null : (
            <span key={m.label} className="gantt-marker-label" style={{ left: `${pos(ms)}%`, color: m.color }}>{m.label}</span>
          );
        })}
      </div>

      <div className="gantt-body">
        {/* today line spanning all rows. NB: left = labelGutter + trackWidth * fraction.
            Multiply the track width by a UNITLESS fraction (pos/100) — multiplying a
            percentage by a length is invalid CSS and silently breaks the position. */}
        <div className="gantt-todayline" style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pos(today) / 100})` }} />
        {/* milestone marker lines */}
        {markers.map((m) => {
          const ms = parseISO(m.date);
          return ms == null ? null : (
            <div
              key={m.label}
              className="gantt-markerline"
              style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pos(ms) / 100})`, borderColor: m.color }}
            />
          );
        })}
        {rows.map((r) => {
          const s = parseISO(r.start);
          const e = parseISO(r.end);
          const left = s != null ? pos(s) : 0;
          const rightEnd = e != null ? pos(e) : left;
          const width = Math.max(MIN_BAR_PCT, rightEnd - left);
          const overdue = e != null && e < today;
          return (
            <div className="gantt-row" key={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }} title={r.tooltip}>
              <div className="gantt-label" style={{ width: LABEL_W }}>
                <div className="gantt-label-main">
                  {r.badge && <span className={`origin-badge ${r.badge === 'CN' ? 'cn' : 'us'}`}>{r.badge}</span>}
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{r.label}</span>
                </div>
                {r.sublabel && <div className="gantt-label-sub truncate">{r.sublabel}</div>}
                {r.carrier && <div className="gantt-carrier truncate">🚢 {r.carrier}</div>}
              </div>
              <div className="gantt-track">
                <div
                  className="gantt-bar"
                  style={{ left: `${left}%`, width: `${width}%`, background: r.color, outline: overdue ? '2px solid var(--crit)' : 'none' }}
                >
                  <span className="gantt-bar-dates">
                    {fmtDate(s)} → {fmtDate(e)}
                  </span>
                </div>
                <span className="gantt-diamond" style={{ left: `${rightEnd}%`, background: r.color }} title={`arrives ${fmtDate(e)}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
