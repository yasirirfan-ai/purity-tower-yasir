import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });

export const Ic = {
  grid: (p?: P) => <svg {...base(p ?? {})}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  scale: (p?: P) => <svg {...base(p ?? {})}><path d="M12 3v18M7 7h10M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7zM8 21h8"/></svg>,
  box: (p?: P) => <svg {...base(p ?? {})}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>,
  channels: (p?: P) => <svg {...base(p ?? {})}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3M12 13.5v2"/></svg>,
  recon: (p?: P) => <svg {...base(p ?? {})}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>,
  trend: (p?: P) => <svg {...base(p ?? {})}><path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5"/></svg>,
  flask: (p?: P) => <svg {...base(p ?? {})}><path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3M7.5 14h9"/></svg>,
  alert: (p?: P) => <svg {...base(p ?? {})}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  search: (p?: P) => <svg {...base(p ?? {})}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  x: (p?: P) => <svg {...base(p ?? {})}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  check: (p?: P) => <svg {...base(p ?? {})}><path d="M20 6L9 17l-5-5"/></svg>,
  plus: (p?: P) => <svg {...base(p ?? {})}><path d="M12 5v14M5 12h14"/></svg>,
  chevron: (p?: P) => <svg {...base(p ?? {})}><path d="M9 18l6-6-6-6"/></svg>,
  clock: (p?: P) => <svg {...base(p ?? {})}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  arrowR: (p?: P) => <svg {...base(p ?? {})}><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  ban: (p?: P) => <svg {...base(p ?? {})}><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg>,
  flame: (p?: P) => <svg {...base(p ?? {})}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  chat: (p?: P) => <svg {...base(p ?? {})}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  down: (p?: P) => <svg {...base(p ?? {})}><path d="M6 9l6 6 6-6"/></svg>,
};
