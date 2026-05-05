/**
 * One-time migration:
 * For snorkelling sites with existing research notes, prepend a fixed timestamp.
 *
 * Prepends: [2026-01-01 00:00]
 *
 * Safety:
 * - Only updates documents where featureType is 'Snorkelling Site'
 * - Only updates non-empty notes
 * - Skips notes already starting with [YYYY-MM-DD HH:MM]
 */
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const STAMP = '[2026-01-01 00:00]';

function loadDotEnv() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, '../.env');
  const envLines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of envLines) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function run() {
  loadDotEnv();

  const mongoUri = process.env['MONGO_URI'];
  if (!mongoUri) {
    throw new Error('MONGO_URI not set in .env');
  }

  await mongoose.connect(mongoUri);
  const col = mongoose.connection.db.collection('sites');

  const filter = {
    'properties.featureType': 'Snorkelling Site',
    $and: [
      { 'properties.researchNotes.notes': { $type: 'string', $regex: /\S/ } },
      { 'properties.researchNotes.notes': { $not: /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/ } }
    ]
  };

  const matchingBefore = await col.countDocuments(filter);
  console.log(`Matching snorkelling-site records before update: ${matchingBefore}`);

  const result = await col.updateMany(
    filter,
    [
      {
        $set: {
          'properties.researchNotes.notes': {
            $concat: [STAMP, ' ', '$properties.researchNotes.notes']
          }
        }
      }
    ]
  );

  console.log(`Matched: ${result.matchedCount}`);
  console.log(`Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exitCode = 1;
});
