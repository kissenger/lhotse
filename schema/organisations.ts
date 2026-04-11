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

const ContactsSchema = new Schema({
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

const DiscoverSnapshotSchema = new Schema({
  title:        String,
  website:      String,
  address:      String,
  city:         String,
  countryCode:  String,
  phone:        String,
  categoryName: String,
}, { _id: false });

const GenerateSchema = new Schema({
  // Input snapshot — what was supplied to Gemini
  discover:            DiscoverSnapshotSchema,
  // Pipeline status
  status:              { type: String, enum: ['generated', 'error'] },
  processed_at:        Date,
  // Gemini scores
  rank_score:          { type: Number, min: 0, max: 100 },
  criterion_scores:    { type: Map, of: Number },
  criterion_rationale: { type: Map, of: String },
  // Classification
  tags:                [String],
  category:            String,
  // Extracted contacts
  contacts:            ContactsSchema,
  // Output text
  description:         String,
  reviewer_notes:      String,
  // Error tracking
  error:               String,
  // Run metadata
  run_settings:        { type: Schema.Types.Mixed },
  grounding_sources:   [String],
  // History — previous generate subdocs, oldest first
  history:             { type: [Schema.Types.Mixed], default: undefined },
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
  publish:              Boolean,
  publishedAt:            Date,
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
OrganisationSchema.index({ 'generate.rank_score': -1 }, { sparse: true });
OrganisationSchema.index({ 'generate.category': 1 }, { sparse: true });
OrganisationSchema.index({ 'generate.tags': 1 }, { sparse: true });
OrganisationSchema.index({ 'verify.verified_at': -1 }, { sparse: true });

// ---------------------------------------------------------------------------

export const Organisation = model('Organisation', OrganisationSchema);

// Named alias — keeps existing server imports (OrganisationModel) working
export { Organisation as OrganisationModel };
