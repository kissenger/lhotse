import express from 'express';
import { OrganisationModel } from '../schema/organisations';
import { verifyToken } from './server-auth';
import 'dotenv/config';

const organisations = express();

const VALID_COLLECTIONS = new Set(['discover', 'generate', 'verify']);

// Returns an extra filter to select docs at a given pipeline stage
function stageFilter(collection: string): Record<string, unknown> {
  if (collection === 'generate') return { generate: { $exists: true } };
  if (collection === 'verify')   return { verify:   { $exists: true } };
  return {}; // 'discover' — all documents
}


/*
  List documents — lightweight projection for the record selector
  GET /api/organisations/:collection?search=&skip=&limit=
*/
organisations.get('/api/organisations/:collection', verifyToken, async (req, res) => {
  const collection = req.params.collection;
  if (!VALID_COLLECTIONS.has(collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }

  try {
    const search = typeof req.query['search'] === 'string' ? req.query['search'].trim() : '';
    const skip   = Math.max(0, parseInt(req.query['skip']  as string) || 0);
    const limit  = Math.min(2000, Math.max(1, parseInt(req.query['limit'] as string) || 100));

    const filter: Record<string, unknown> = {
      ...stageFilter(collection),
      ...(search ? { 'discover.title': { $regex: search, $options: 'i' } } : {}),
    };

    const [raw, total] = await Promise.all([
      OrganisationModel
        .find(filter, {
          'discover.title': 1, 'discover.city': 1, 'discover.countryCode': 1, 'discover.status': 1,
          'generate.rank_score': 1, 'generate.category': 1, 'generate.flaggedForUpdate': 1, 'generate.newContentAvailable': 1,
          'verify.rank_score': 1,  'verify.category': 1,
          'verify.newContentPendingVerification': 1,
          'verify.verified': 1,
          'verify.publish': 1,
        })
        .sort(collection === 'verify'
          ? { 'verify.newContentPendingVerification': -1, 'discover.title': 1 }
          : { 'generate.rank_score': -1, 'discover.title': 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrganisationModel.countDocuments(filter),
    ]);

    const docs = raw.map((d: any) => ({
      _id:         d._id,
      title:       d.discover?.title ?? '—',
      city:        d.discover?.city,
      countryCode: d.discover?.countryCode,
      status:      d.discover?.status,
      rank_score:  d.generate?.rank_score ?? d.verify?.rank_score,
      category:    d.generate?.category   ?? d.verify?.category,
      newContentPendingVerification: d.verify?.newContentPendingVerification,
      isVerified:   !!d.verify?.verified,
      isPublished:  !!d.verify?.publish,
      flaggedForUpdate: !!d.generate?.flaggedForUpdate,
      newContentAvailable: !!d.generate?.newContentAvailable,
    }));

    res.json({ docs, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/*
  Get a single document — full record
  GET /api/organisations/:collection/:id
*/
organisations.get('/api/organisations/:collection/:id', verifyToken, async (req, res) => {
  if (!VALID_COLLECTIONS.has(req.params.collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }

  try {
    const doc = await OrganisationModel.findById(req.params.id).lean();
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/*
  Update a document
  POST /api/organisations/:collection/:id
*/
organisations.post('/api/organisations/:collection/:id', verifyToken, async (req, res) => {
  if (!VALID_COLLECTIONS.has(req.params.collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }

  try {
    const { _id, __v, createdAt, updatedAt, ...updates } = req.body;
    const doc = await OrganisationModel.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

/*
  Delete a document
  DELETE /api/organisations/:collection/:id
*/
organisations.delete('/api/organisations/:collection/:id', verifyToken, async (req, res) => {
  if (!VALID_COLLECTIONS.has(req.params.collection)) { res.status(400).json({ error: 'Unknown collection' }); return; }

  try {
    const doc = await OrganisationModel.findByIdAndDelete(req.params.id);
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export { organisations };
