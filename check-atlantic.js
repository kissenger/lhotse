import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
const org = await mongoose.connection.db.collection('organisations').findOne({
  $or: [
    { 'favourite.name': /atlantic/i },
    { 'generate.content.name': /atlantic/i },
    { 'discover.title': /atlantic/i }
  ]
});

console.log('fav.name:', org.favourite?.name);
console.log('gc.name:', org.generate?.content?.name);
console.log('d.title:', org.discover?.title);

process.exit(0);
