import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function debug() {
  try {
    // First check if it's in the API response
    console.log('Fetching /api/sites/get-sites/Production...');
    const response = await fetch('http://localhost:4000/api/sites/get-sites/Production');
    const data = await response.json();
    
    const features = data.features || [];
    const atlanticFeature = features.find(f => 
      f.properties?.name?.toLowerCase().includes('atlantic')
    );
    
    if (atlanticFeature) {
      console.log('\n✓ Atlantic Adventures FOUND in API response');
      console.log('Feature name:', atlanticFeature.properties.name);
      console.log('Feature type:', atlanticFeature.properties.featureType);
      console.log('Full properties:', JSON.stringify(atlanticFeature.properties, null, 2));
    } else {
      console.log('\n✗ Atlantic Adventures NOT FOUND in API response');
      console.log('Total features in response:', features.length);
      
      // Show a few org examples
      const orgs = features.filter(f => f.properties?.featureType !== 'Snorkelling Site');
      console.log('\nSample organisations in response:');
      orgs.slice(0, 5).forEach(org => {
        console.log('  -', org.properties.name, '(' + org.properties.featureType + ')');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

debug();
