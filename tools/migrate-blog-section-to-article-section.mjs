import mongoose from 'mongoose';
import 'dotenv/config';

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function printHelp() {
  console.log(`Usage: node ./tools/migrate-blog-section-to-article-section.mjs [--apply]\n\nMigrates legacy posts with blogSection into articleSection when articleSection is empty.\n\nOptions:\n  --apply     Write changes. Without this flag, runs in dry-run mode.\n  --help,-h   Show help.\n\nEnvironment:\n  MONGO_URI   Required MongoDB connection string.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const mongoUri = process.env['MONGO_URI'];
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set in environment.');
  }

  await mongoose.connect(mongoUri);

  try {
    const collection = mongoose.connection.collection('posts');

    const filter = {
      $and: [
        { blogSection: { $type: 'string', $ne: '' } },
        {
          $or: [
            { articleSection: { $exists: false } },
            { articleSection: null },
            { articleSection: '' }
          ]
        }
      ]
    };

    const needingMigration = await collection.find(filter, {
      projection: { slug: 1, articleSection: 1, blogSection: 1 }
    }).toArray();

    console.log(`Posts needing migration: ${needingMigration.length}`);
    if (needingMigration.length > 0) {
      const sample = needingMigration.slice(0, 10);
      console.log('Sample:');
      for (const post of sample) {
        console.log(`- ${post.slug || post._id}: blogSection="${String(post.blogSection).trim()}"`);
      }
    }

    if (!options.apply) {
      console.log('Dry run complete. Re-run with --apply to write changes.');
      return;
    }

    if (needingMigration.length === 0) {
      console.log('No updates required.');
      return;
    }

    const bulkOps = needingMigration.map((post) => ({
      updateOne: {
        filter: { _id: post._id },
        update: { $set: { articleSection: String(post.blogSection).trim() } },
      }
    }));

    const result = await collection.bulkWrite(bulkOps, { ordered: false });
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);

    const remaining = await collection.countDocuments(filter);
    console.log(`Remaining needing migration: ${remaining}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
