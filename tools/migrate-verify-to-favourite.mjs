/**
 * One-time migration: copy verify.suppressOnMap and verify.forcedPublish
 * into favourite.* for any orgs that have them set but not yet in favourite.
 */
import mongoose from 'mongoose';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const MONGO_URI = process.env['MONGO_URI'];
if (!MONGO_URI) throw new Error('MONGO_URI not set in .env');

await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;
const col = db.collection('organisations');

// Migrate suppressOnMap
const suppressed = await col.find({ 'verify.suppressOnMap': true }).toArray();
console.log(`Found ${suppressed.length} orgs with verify.suppressOnMap=true`);
for (const doc of suppressed) {
  await col.updateOne({ _id: doc._id }, { $set: { 'favourite.suppressOnMap': true } });
  console.log(`  Migrated suppressOnMap: ${doc.discover?.title ?? doc._id}`);
}

// Migrate forcedPublish
const forced = await col.find({ 'verify.forcedPublish': true }).toArray();
console.log(`Found ${forced.length} orgs with verify.forcedPublish=true`);
for (const doc of forced) {
  await col.updateOne({ _id: doc._id }, { $set: { 'favourite.forcedPublish': true } });
  console.log(`  Migrated forcedPublish: ${doc.discover?.title ?? doc._id}`);
}

await mongoose.disconnect();
console.log('Done.');
