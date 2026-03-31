import mongoose, {model} from 'mongoose';

const featureSchema = new mongoose.Schema({
  showOnMap: {type: String, enum: ['No','Development','Production']},
  location: {
    type: {type: String, required: true},
    coordinates: {type: [Number], required: true}
  },
  properties: {
    featureType: { type: String, required: true },
    symbolSortOrder: { type: Number },
    name: {type: String, required: true},
    region: {type: String},    
    imageUrl: { type: String },
    location: {
      adminLevel3: { type: String },
      county: { type: String },
      locality: { type: String },
      localityOverride: { type: String },
      postalTown: { type: String }
    },
    description: {type: String},
    categories: {type: [String]},
    contact: {
      name: {type: String},
      email: {type: String}
    },
    moreInfo: [{
      title: {type: String}, 
      icon: {type: String},
      url: {type: String},
      text: {type: String},
      preferred: {type: Boolean}
    }],
    siteInfo: {
      isCarAccess: {type: Boolean},
      parking: {
        name: {type: String},
        location: {
          type: {type: String},
          coordinates: {type: [Number]}
        },
        isPayAndDisplay: {type: Boolean}
      },
    },
    researchNotes: {
      isVisited: {type: Boolean},
      visitPriority: {type: Boolean},
      notes: {type: String},
      links: {type: [String]},
      credits: {type: String},
      rating: {type: String, enum: ['good','ok','poor','not for snorkelling', '']},
    }
  }
}, {timestamps: true})

const MapFeatureModel = model('site', featureSchema);

export default MapFeatureModel; 
