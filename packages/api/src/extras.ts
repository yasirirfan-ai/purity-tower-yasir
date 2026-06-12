import type { Request, Response } from 'express';
import { fetchCollection } from './clients.js';

const ok = <T>(fn: () => Promise<T>) => async (_req: Request, res: Response) => {
  try { res.json(await fn()); } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
};

// Reviews + Artwork are served straight from their (seeded) collections.
export const reviewsHandler = ok(() => fetchCollection('reviews', 60_000));
export const artworkHandler = ok(() => fetchCollection('artwork', 60_000));

// ── Regulatory dossier — DERIVED from the real PD collections ────────
// For each formula, presence-check the compliance record types we actually have
// (formula, stability, challenge, claims) and mark the ones we don't yet source.
type Status = 'on-file' | 'pending' | 'missing';
interface Section { id: string; label: string; status: Status }

export async function regulatoryHandler(_req: Request, res: Response): Promise<void> {
  try {
    const [formulas, stability, challenge, claims] = await Promise.all([
      fetchCollection('formulas', 60_000),
      fetchCollection('stability', 60_000),
      fetchCollection('challengeTests', 60_000),
      fetchCollection('claims', 60_000),
    ]);
    const byFormula = (rows: Array<Record<string, unknown>>, label: string) => {
      const m = new Map<string, Array<Record<string, unknown>>>();
      let orphans = 0;
      for (const r of rows) {
        const k = String(r.formulaId ?? '');
        if (!k) { orphans += 1; continue; } // doc not linked to a formula — surface it
        const list = m.get(k) ?? [];
        list.push(r);
        m.set(k, list);
      }
      if (orphans) console.warn(`[regulatory] ${orphans} ${label} doc(s) have no formulaId — excluded from dossiers`);
      return m;
    };
    const stab = byFormula(stability, 'stability');
    const chal = byFormula(challenge, 'challengeTests');
    const clm = byFormula(claims, 'claims');

    const dossiers = formulas.map((f) => {
      const id = String(f.id);
      const claimDocs = clm.get(id) ?? [];
      const validatedClaims = claimDocs.filter((c) => (c as { status?: string }).status === 'VALIDATED').length;
      const sections: Section[] = [
        { id: 'formula', label: 'Production formula', status: 'on-file' },
        { id: 'stability', label: 'Stability data', status: (stab.get(id)?.length ?? 0) > 0 ? 'on-file' : 'missing' },
        { id: 'challenge', label: 'Challenge test (ISO 11930)', status: (chal.get(id)?.length ?? 0) > 0 ? 'on-file' : 'missing' },
        { id: 'claims', label: 'Claims substantiation', status: claimDocs.length === 0 ? 'missing' : validatedClaims > 0 ? 'on-file' : 'pending' },
        { id: 'ifra', label: 'IFRA / allergen statement', status: 'pending' },
        { id: 'il', label: 'Ingredient list (INCI)', status: 'missing' },
        { id: 'coa', label: 'Certificate of analysis', status: 'missing' },
        { id: 'sds', label: 'Safety data sheet (SDS)', status: 'missing' },
      ];
      const onFile = sections.filter((s) => s.status === 'on-file').length;
      const pct = onFile / sections.length;
      return {
        sku: id, name: String(f.name ?? id), category: String(f.category ?? ''),
        sections, onFile, total: sections.length, missing: sections.filter((s) => s.status === 'missing').length,
        pct, dossierStatus: pct === 1 ? 'complete' : pct >= 0.5 ? 'partial' : 'gaps',
      };
    });
    dossiers.sort((a, b) => a.pct - b.pct); // most gaps first
    res.json({ dossiers, note: 'Formula/stability/challenge/claims are checked against real PD records; IFRA/IL/COA/SDS are not yet sourced.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
