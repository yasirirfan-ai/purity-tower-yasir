import type { Request, Response } from 'express';
import { firestore, fetchCollection, cached } from './clients.js';

type Doc = Record<string, unknown> & { id: string };
const docsOf = (snap: FirebaseFirestore.QuerySnapshot): Doc[] => snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

/** GET /api/pd/formulas — list all formulas (with version count + current label). */
export async function pdFormulasHandler(_req: Request, res: Response): Promise<void> {
  try {
    const data = await cached('pd:formulas', 30_000, async () => {
      const snap = await firestore.collection('formulas').get();
      const formulas = await Promise.all(
        snap.docs.map(async (d) => {
          const versions = await d.ref.collection('versions').get();
          const labels = versions.docs.map((v) => String(v.get('label') ?? ''));
          const current = labels.includes('PRODUCTION') ? 'PRODUCTION' : labels.includes('DEVELOPMENT') ? 'DEVELOPMENT' : (labels[0] ?? '');
          return { id: d.id, ...(d.data() as Record<string, unknown>), versionCount: versions.size, currentLabel: current };
        }),
      );
      formulas.sort((a, b) => String((a as Record<string, unknown>).name ?? '').localeCompare(String((b as Record<string, unknown>).name ?? '')));
      return formulas;
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/** GET /api/pd/formulas/:id — formula head + versions + selected version's ingredients + stability/challenge/claims. */
export async function pdFormulaDetailHandler(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!id) { res.status(400).json({ error: 'formula id required' }); return; }
  try {
    const ref = firestore.collection('formulas').doc(id);
    const [headSnap, versionsSnap, stabilitySnap, challengeSnap, claimsSnap] = await Promise.all([
      ref.get(),
      ref.collection('versions').get(),
      firestore.collection('stability').where('formulaId', '==', id).get(),
      firestore.collection('challengeTests').where('formulaId', '==', id).get(),
      firestore.collection('claims').where('formulaId', '==', id).get(),
    ]);
    if (!headSnap.exists) { res.status(404).json({ error: `formula ${id} not found` }); return; }

    const versions = docsOf(versionsSnap).sort((a, b) => Number(b.versionNumber ?? 0) - Number(a.versionNumber ?? 0));
    // Selected version: PRODUCTION if present, else highest versionNumber.
    const selected = versions.find((v) => v.label === 'PRODUCTION') ?? versions[0] ?? null;
    let ingredients: Doc[] = [];
    if (selected) {
      const ingSnap = await ref.collection('versions').doc(selected.id).collection('ingredients').get();
      ingredients = docsOf(ingSnap).sort((a, b) => Number(a.sNo ?? 0) - Number(b.sNo ?? 0));
    }

    res.json({
      id,
      head: { id: headSnap.id, ...(headSnap.data() as Record<string, unknown>) },
      versions,
      selectedVersionId: selected?.id ?? null,
      version: selected,
      ingredients,
      stability: docsOf(stabilitySnap),
      challengeTests: docsOf(challengeSnap),
      claims: docsOf(claimsSnap),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/** GET /api/pd/ingredients — ingredient master. */
export async function pdIngredientsHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await fetchCollection('ingredients', 60_000));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
