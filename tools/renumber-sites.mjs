import 'dotenv/config';
import mongoose from 'mongoose';

try {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  const col = conn.connection.db.collection('sites');

  const SNORKEL = 'Snorkelling Site';

  // Non-snorkelling sites: 5000, 5001, 5002 …
  const others = await col
    .find({ 'properties.featureType': { $ne: SNORKEL } })
    .sort({ 'properties.symbolSortOrder': 1 })
    .toArray();
  console.log(`Found ${others.length} non-snorkelling sites`);
  if (others.length) {
    await col.bulkWrite(
      others.map((doc, i) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { 'properties.symbolSortOrder': 5000 + i } },
        },
      }))
    );
  }
  console.log(`Non-snorkelling sites renumbered: 5000 – ${5000 + others.length - 1}`);

  await mongoose.disconnect();
  console.log('Done.');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
