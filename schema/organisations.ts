// ---------------------------------------------------------------------------
// Snorkelling Industry Directory — Mongoose Schema
// ---------------------------------------------------------------------------
// Collection: organisations
//
// Each document holds all pipeline stages as sub-documents:
//   discover  — raw Google Maps data      (written by Apify actor)
//   generate  — Gemini review results     (written by generate.py)
//   verify    — verification outcome      (written by verify.py)
//
// Usage (ESM):
//   import { Organisation } from './organisationSchema.js';
//
// Usage (CJS):
//   const { Organisation } = require('./organisationSchema.js');
// ---------------------------------------------------------------------------

import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const LocationSchema = new Schema({
  type:        { type: String, default: 'Point' },
  coordinates: { type: [Number] },  // [lng, lat]
}, { _id: false });

const DiscoverSchema = new Schema({
  title:             String,
  website:           String,
  address:           String,
  neighborhood:      String,
  street:            String,
  city:              String,
  postalCode:        String,
  state:             String,
  countryCode:       String,
  phone:             String,
  categoryName:      String,
  categories:        [String],
  location:          LocationSchema,
  scrapedAt:         String,
  searchString:      String,
}, { _id: false, strict: false });

const DiscoverSnapshotSchema = new Schema({
  title:        String,
  website:      String,
  address:      String,
  city:         String,
  countryCode:  String,
  phone:        String,
  categoryName: String,
}, { _id: false });

const SocialLinksSchema = new Schema({
  emails:        [String],
  phones:        [String],
  website:       String,
  instagram:     String,
  facebook:      String,
  twitter:       String,
  youtube:       String,
  tiktok:        String,
  other_socials: [String],
}, { _id: false });

// generate.rank — ranking/scoring output from rank.py
const GenerateRankSchema = new Schema({
  discover:            DiscoverSnapshotSchema,
  status:              { type: String, enum: ['ranked', 'error'] },
  processed_at:        Date,
  rank_score:          { type: Number, min: 0, max: 100 },
  british_operations_pass: Boolean,
  active_presence_pass: Boolean,
  criterion_scores:    { type: Map, of: Number },
  criterion_rationale: { type: Map, of: String },
  socialLinks:         SocialLinksSchema,
  url_reachable:       Boolean,
  reviewer_notes:      String,
  error:               String,
  run_settings:        { type: Schema.Types.Mixed },
  grounding_sources:   [String],
}, { _id: false, strict: false });

// generate.content — descriptive content output from generate.py
const GenerateContentSchema = new Schema({
  discover:          DiscoverSnapshotSchema,
  status:            { type: String, enum: ['generated', 'error'] },
  processed_at:      Date,
  description:       String,
  name:              String,
  tags:              [String],
  category:          String,
  url_reachable:     Boolean,
  reviewer_notes:    String,
  error:             String,
  run_settings:      { type: Schema.Types.Mixed },
  grounding_sources: [String],
}, { _id: false, strict: false });

const GenerateSchema = new Schema({
  rank:    GenerateRankSchema,
  content: GenerateContentSchema,
  // History — previous generate subdocs, oldest first
  history: { type: [Schema.Types.Mixed], default: undefined },
}, { _id: false, strict: false });

const VerifySchema = new Schema({
  newContentPendingVerification: Boolean,
  verified:              Boolean,
  verifiedAt:            Date,
  verifiedData: {
    description:         String,
    tags:                [String],
    category:            String,    
  },
  forcedPublish:        Boolean,
  suppressOnMap:        Boolean,
}, { _id: false, strict: false });

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

const OrganisationSchema = new Schema({
  discover: { type: DiscoverSchema, required: true },
  generate: { type: GenerateSchema },
  verify:   { type: VerifySchema },
  // Preflight results
  preflight: { type: Schema.Types.Mixed },
}, {
  collection: 'organisations',
  strict: false,
  timestamps: false,
});

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

OrganisationSchema.index({ 'discover.countryCode': 1, 'discover.city': 1 });
OrganisationSchema.index({ 'discover.status': 1 }, { sparse: true });
OrganisationSchema.index({ 'generate.rank.rank_score': -1 }, { sparse: true });
OrganisationSchema.index({ 'generate.content.category': 1 }, { sparse: true });
OrganisationSchema.index({ 'generate.content.tags': 1 }, { sparse: true });
OrganisationSchema.index({ 'verify.verified_at': -1 }, { sparse: true });

// ---------------------------------------------------------------------------

export const Organisation = model('Organisation', OrganisationSchema);

// Named alias — keeps existing server imports (OrganisationModel) working
export { Organisation as OrganisationModel };
