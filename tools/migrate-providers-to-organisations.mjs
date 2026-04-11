#!/usr/bin/env node
/**
 * migrate-providers-to-organisations.mjs
 *
 * Migrates provider documents from the `sites` collection into the `organisations`
 * collection under the `human` key.
 *
 * Usage:
 *   node tools/migrate-providers-to-organisations.mjs [--dry-run]
 *
 * Requires MONGO_URI in environment (or .env file at project root).
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('[dry-run] No documents will be written to MongoDB.');
}

// ---------------------------------------------------------------------------
// Inline schemas (minimal — only what the migration needs)
// ---------------------------------------------------------------------------

const moreInfoItemSchema = new mongoose.Schema({
  title:     String,
  icon:      String,
  url:       String,
  text:      String,
  preferred: Boolean,
}, { _id: false });

const humanSubSchema = new mongoose.Schema({
  showOnMap:        String,
  featureType:      String,
  name:             String,
  description:      String,
  imageUrl:         String,
  symbolSortOrder:  Number,
  categories:       [String],
  location: {
    country:         String,
    region:          String,
    district:        String,
    place:           String,
    locality:        String,
    neighborhood:    String,
    localityOverride: String,
  },
  coordinates: [Number],
  moreInfo:    [moreInfoItemSchema],
  migratedFrom: mongoose.Schema.Types.ObjectId,
}, { _id: false });

const organisationSchema = new mongoose.Schema({
  human:    humanSubSchema,
  discover: mongoose.Schema.Types.Mixed,
  generate: mongoose.Schema.Types.Mixed,
  verify:   mongoose.Schema.Types.Mixed,
});
const OrganisationModel = mongoose.model('Organisation', organisationSchema, 'organisations');

const featureSchema = new mongoose.Schema({
  showOnMap: String,
  location: mongoose.Schema.Types.Mixed,
  properties: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
const MapFeatureModel = mongoose.model('site', featureSchema);

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Fetch all non-snorkelling-site docs from the sites collection
  const providers = await MapFeatureModel.find({
    'properties.featureType': { $ne: 'Snorkelling Site' },
  }).lean();

  console.log(`Found ${providers.length} provider(s) in sites collection.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const provider of providers) {
    try {
      const p = provider.properties || {};
      const coords = provider.location?.coordinates;

      // Check if already migrated (idempotency)
      const existing = await OrganisationModel.findOne({ 'human.migratedFrom': provider._id }).lean();
      if (existing) {
        console.log(`  SKIP  [already migrated] ${p.name}`);
        skipped++;
        continue;
      }

      const humanData = {
        showOnMap:       provider.showOnMap ?? 'No',
        featureType:     p.featureType,
        name:            p.name,
        description:     p.description,
        imageUrl:        p.imageUrl,
        symbolSortOrder: p.symbolSortOrder,
        categories:      p.categories?.length ? p.categories : undefined,
        location: {
          country:          p.location?.country,
          region:           p.location?.region,
          district:         p.location?.district,
          place:            p.location?.place,
          locality:         p.location?.locality,
          neighborhood:     p.location?.neighborhood,
          localityOverride: p.location?.localityOverride,
        },
        coordinates:  coords ?? undefined,
        moreInfo:     p.moreInfo?.length
          ? p.moreInfo.map(item => ({
              ...item,
              preferred: typeof item.preferred === 'string'
                ? item.preferred.toLowerCase() === 'yes'
                : item.preferred,
            }))
          : undefined,
        migratedFrom: provider._id,
      };

      if (DRY_RUN) {
        console.log(`  DRY   ${p.name} (${p.featureType})`);
        migrated++;
        continue;
      }

      await OrganisationModel.create({ human: humanData });
      console.log(`  OK    ${p.name} (${p.featureType})`);
      migrated++;
    } catch (err) {
      console.error(`  ERROR processing ${provider.properties?.name}:`, err);
      errors++;
    }
  }

  console.log('');
  console.log('--- Migration summary ---');
  console.log(`  Found:    ${providers.length}`);
  console.log(`  Migrated: ${migrated}${DRY_RUN ? ' (dry-run — nothing written)' : ''}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);

  if (!DRY_RUN) {
    console.log('');
    console.log('NOTE: Provider documents have NOT been removed from the sites collection.');
    console.log('      Verify the map works correctly before deleting them.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
