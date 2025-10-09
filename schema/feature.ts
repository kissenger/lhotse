import mongoose, {model} from 'mongoose';

const featureSchema = new mongoose.Schema({
  showOnMap: {type: String, enum: ['No','Development','Production']},
  location: {
    type: {type: String, required: true},
    coordinates: {type: [Number], required: true}
  },
  properties: {
    featureType: { type: String, enum: ['Site','Organisation'], required: true },
    organisationType: { type: String },
    name: {type: String, required: true},
    placeName: {type: String, required: true},
    region: {type: String},    
    description: {type: String},
    categories: {type: [String]},
    moreInfo: [{
      title: {type: String}, 
      url: {type: String},
      preferred: {type: Boolean}
    }],
    siteInfo: {
      hasTidalPool: {type: String},
      isSnorkelTrail: {type: Boolean},
      isBookSite: {type: Boolean},
      isCarAccess: {type: Boolean},
      parking: {
        name: {type: String},
        location: {
          type: {type: String, required: true},
          coordinates: {type: [Number], required: true}
        },
        isPayAndDisplay: {type: Boolean}
      },
    },
    researchNotes: {
      isVisited: {type: Boolean},
      isPriorityToVisit: {type: Boolean},
      notes: {type: String},
      links: {type: [String]},
      credits: {type: String},
      rating: {type: String, enum: ['good','ok','poor','not for snorkelling']},
    }
  }
}, {timestamps: true})

const MapFeatureModel = model('site', featureSchema);

export default MapFeatureModel; 
