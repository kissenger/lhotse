import express from 'express';
import { OrganisationModel } from '../schema/organisations';
import { requireAdmin, verifyToken } from './server-auth';
import 'dotenv/config';

const organisations = express();

const VALID_COLLECTIONS = new Set(['discover', 'generate']);
const DEFAULT_SCORING_THRESHOLD = 70;
const SETTINGS_FILTER = { __type: 'settings' };
type AsyncRoute = (req: any, res: any) => Promise<void>;

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return value === true || value === 1;
}

async function readOrgSettings(): Promise<{ scoringThreshold: number }> {
  const doc = await (OrganisationModel as any).findOne(SETTINGS_FILTER).lean();
  return { scoringThreshold: Number(doc?.scoringThreshold ?? DEFAULT_SCORING_THRESHOLD) };
}

// Returns an extra filter to select docs at a given pipeline stage
function stageFilter(collection: string): Record<string, unknown> {
  if (collection === 'generate') return { generate: { $exists: true } };
  return {}; // 'discover' — all documents
}

function sendNotFound(res: any): void {
  res.status(404).json({ error: 'Not found' });
}

function withError(message: string, handler: AsyncRoute) {
  return (req: any, res: any) => {
    void handler(req, res).catch(() => {
      res.status(500).json({ error: message });
    });
  };
}

/*
  Settings — scoring threshold
  GET /api/organisations/settings
  POST /api/organisations/settings
*/
organisations.get('/api/organisations/settings', verifyToken, requireAdmin, withError('Failed to read settings', async (_req, res) => {
  res.json(await readOrgSettings());
}));

organisations.post('/api/organisations/settings', verifyToken, requireAdmin, withError('Failed to save settings', async (req, res) => {
  const t = Number(req.body?.scoringThreshold);
  if (isNaN(t) || t < 0 || t > 100) { res.status(400).json({ error: 'scoringThreshold must be 0–100' }); return; }
  await (OrganisationModel as any).findOneAndUpdate(
    SETTINGS_FILTER,
    { __type: 'settings', scoringThreshold: t },
    { upsert: true }
  );
  res.json({ scoringThreshold: t });
}));


/*
  List documents — lightweight projection for the record selector
  GET /api/organisations/:collection?search=&skip=&limit=
*/
organisations.get('/api/organisations/:collection', verifyToken, requireAdmin, withError('Failed to list documents', async (req, res) => {
  const collection = req.params.collection;
  if (!VALID_COLLECTIONS.has(collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }
  const search = typeof req.query['search'] === 'string' ? req.query['search'].trim() : '';
  const skip   = Math.max(0, parseInt(req.query['skip']  as string) || 0);
  const limit  = Math.min(2000, Math.max(1, parseInt(req.query['limit'] as string) || 100));

  const settings = await readOrgSettings();
  const threshold = settings.scoringThreshold;

  const filter: Record<string, unknown> = {
    __type: { $exists: false }, // exclude settings doc
    ...stageFilter(collection),
    ...(search ? { 'discover.title': { $regex: search, $options: 'i' } } : {}),
  };

  const [raw, total] = await Promise.all([
    OrganisationModel
      .find(filter, {
        'discover.title': 1, 'discover.city': 1, 'discover.countryCode': 1, 'discover.status': 1,
        'generate.rank.rank_score': 1, 'generate.content.category': 1,
        'generate.rank.british_operations_pass': 1,
        'generate.rank.active_presence_pass': 1,
        'favourite.tags': 1,
        'favourite.category': 1,
        'favourite.newContentPendingVerification': 1,
        'favourite.verified': 1,
        'favourite.forcedPublish': 1,
        'favourite.suppressOnMap': 1,
        'favourite.isFavourite': 1,
      })
      .sort({ 'generate.rank.rank_score': -1, 'discover.title': 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OrganisationModel.countDocuments(filter),
  ]);

  const docs = raw.map((d: any) => {
    const score: number | undefined = d.generate?.rank?.rank_score;
    const isFavourite = isTruthyFlag(d.favourite?.isFavourite);
    const britishPass = d.generate?.rank?.british_operations_pass === true;
    const activePass = d.generate?.rank?.active_presence_pass === true;
    const isSuppressed = isTruthyFlag(d.favourite?.suppressOnMap);
    const isAutoSelected = !isSuppressed && (isFavourite || (score != null && score >= threshold && britishPass && activePass));
    const isOnMap = isTruthyFlag(d.favourite?.forcedPublish) || isAutoSelected;
    return {
      _id:         d._id,
      title:       d.discover?.title ?? '—',
      city:        d.discover?.city,
      countryCode: d.discover?.countryCode,
      status:      d.discover?.status,
      rank_score:  score,
      british_operations_pass: britishPass,
      active_presence_pass: activePass,
      category:    d.generate?.content?.category ?? d.favourite?.category,
      newContentPendingVerification: d.favourite?.newContentPendingVerification,
      isVerified:      !!d.favourite?.verified,
      isOnMap,
      isPublished:     isOnMap, // kept for backward compat
      isManualPublish: isTruthyFlag(d.favourite?.forcedPublish),
      isSuppressed,
      isFavourite,
    };
  });

  res.json({ docs, total });
}));

/*
  Get a single document — full record
  GET /api/organisations/:collection/:id
*/
organisations.get('/api/organisations/:collection/:id', verifyToken, requireAdmin, withError('Failed to fetch document', async (req, res) => {
  if (!VALID_COLLECTIONS.has(req.params.collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }
  const doc = await OrganisationModel.findById(req.params.id).lean();
  if (!doc) { sendNotFound(res); return; }
  res.json(doc);
}));

/*
  Update a document
  POST /api/organisations/:collection/:id
*/
organisations.post('/api/organisations/:collection/:id', verifyToken, requireAdmin, withError('Failed to update document', async (req, res) => {
  if (!VALID_COLLECTIONS.has(req.params.collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }
  const { _id, __v, createdAt, updatedAt, ...updates } = req.body;
  const doc = await OrganisationModel.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
  if (!doc) { sendNotFound(res); return; }
  res.json(doc);
}));

/*
  Delete a document
  DELETE /api/organisations/:collection/:id
*/
organisations.delete('/api/organisations/:collection/:id', verifyToken, requireAdmin, withError('Failed to delete document', async (req, res) => {
  if (!VALID_COLLECTIONS.has(req.params.collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }
  const doc = await OrganisationModel.findByIdAndDelete(req.params.id);
  if (!doc) { sendNotFound(res); return; }
  res.json({ ok: true });
}));

export { organisations };
