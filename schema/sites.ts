import mongoose, {model} from 'mongoose';

const siteSchema = new mongoose.Schema({
  siteName: {type: String},
  alternativeSiteNames: {type: [String]},
  placeName: {type: String},
  nearestLargeTown: {type: String},
  county: {type: String},
  region: {type: String},
  description: {type: String},
  currentAffected: {type: Boolean},
  slackWater: {type: String},
  seabedType: {type: String},
  hasSeagrass: {type: Boolean},
  hasKelp: {type: Boolean},
  hasTidalPool: {type: Boolean},
  hasRockpooling: {type: Boolean},
  hasSandyBeach: {type: Boolean},
  isBeginnerFriendly: {type: Boolean},
  isInSnorkellingBritain: {type: Boolean},
  safetyNotes: {type: String},
  visits: { type: [
    {date: {type: Date}},
    {notes: {type: String}}
  ]},
  location: {
    gps: {type: [Number,Number]},
    directions: {type: String},
  },
  parking: {
    gps: {type: [Number,Number]},
    description: {type: String},
    payAndDisplay: {type: Boolean},
    priceInfo: {type: String},
    heightRestricted: {type: Boolean},
  },
  amenities: {
    description: {type: String},
    publicToilets: {type: Boolean},
    nearbyRefreshments: {type: Boolean}
  }

})