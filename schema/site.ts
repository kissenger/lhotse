import mongoose, {model} from 'mongoose';

const siteSchema = new mongoose.Schema({
  showOnMap: {type: Boolean},
  location: {
    type: {type: String, required: true},
    coordinates: {type: [Number], required: true}
  },
  info: {
    siteName: {type: String, required: true},
    placeName: {type: String, required: true},
    region: {type: String},    
    hasTidalPool: {type: String},
    habitatMain: {type: String, enum: ['seagrass meadow','kelp forest','rocky reef','mearl beds','sand and gravel','chalk reef']},
    habitatSecondary: {type: String, enum: ['seagrass meadow','kelp forest','rocky reef','mearl beds','sand and gravel','chalk reef']},
    snorkelTrail: {
      isSnorkelTrail: {type: Boolean},
      trailName: {type: String},
      trailUrl: {type: String}
    },
    snorkellingBritain: {
      isBookSite: {type: Boolean},
      buyUrl: {type: String}
    },
    findingTheSite: {type: String},
    gettingThere: {type: String},
    thingsToKnow: {type: String},
    isCarAccess: {type: Boolean},
    parking: {
      name: {type: String},
      location: {
        type: {type: String, required: true},
        coordinates: {type: [Number], required: true}
      },
      isPayAndDisplay: {type: Boolean}
    },
    images: [{
      url: {type: String},
      alt: {type: String},
      credit: {type: String}
    }],
    videos: [{
      url: {type: String},
      alt: {type: String},
      credit: {type: String}
    }]
  },
  researchInfo: {
    isVisited: {type: Boolean},
    isPriorityToVisit: {type: Boolean},
    notes: {type: String},
    links: {type: [String]},
    credits: {type: String},
    rating: {type: String, enum: ['good','ok','poor','not for snorkelling']},
  }
}, {timestamps: true})

const SiteModel = model('site', siteSchema);

export default SiteModel; 
