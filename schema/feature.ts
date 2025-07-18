import mongoose, {model} from 'mongoose';

const featureSchema = new mongoose.Schema({
  showOnMap: {type: Boolean},
  location: {
    type: {type: String, required: true},
    coordinates: {type: [Number], required: true}
  },
  properties: {
    featureType: { type: String, enum: ['site','shop','instructor'], required: true },
    instructor: {
      businessName: {type: String, required: true},
      placeName: {type: String},
      region: {type: String},
      instructorType: {type: String, enum: ['BSAC School','PADI School','Independent']},
      qualifications: [{
        agency: {type: String},
        qualification: {type: String}
      }],
      services: [{type: String}],
      shortDescription: {type: String},
      bookings: {type: String},
      socials: [{
        name: {type: String},
        url: {type: String},
        preferred: {type: Boolean}
      }]
    },
    site: {
      siteName: {type: String, required: true},
      placeName: {type: String, required: true},
      region: {type: String},    
      hasTidalPool: {type: String},
      habitats: {type: [String], enum: ['seagrass meadow','kelp forest','rocky reef','mearl beds','sand and gravel','chalk reef']},
      isSnorkelTrail: {type: Boolean},
      isBookSite: {type: Boolean},
      isCarAccess: {type: Boolean},
      furtherInfo: [{
        title: {type: String}, 
        url: {type: String}
      }],
      parking: {
        name: {type: String},
        location: {
          type: {type: String, required: true},
          coordinates: {type: [Number], required: true}
        },
        isPayAndDisplay: {type: Boolean}
      },
      shortDescription: {type: String},
      images: [{
        url: {type: String},
        alt: {type: String},
        credit: {type: String}
      }],
      videos: [{
        url: {type: String},
        alt: {type: String},
        credit: {type: String}
      }],
      researchNotes: {
        isVisited: {type: Boolean},
        isPriorityToVisit: {type: Boolean},
        notes: {type: String},
        links: {type: [String]},
        credits: {type: String},
        rating: {type: String, enum: ['good','ok','poor','not for snorkelling']},
      }
    }
  }
}, {timestamps: true})

const MapFeatureModel = model('mapfeature', featureSchema);

export default MapFeatureModel; 
