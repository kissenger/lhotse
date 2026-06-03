import mongoose from 'mongoose';
import 'dotenv/config';

const DEFAULT_FROM = '/article';
const DEFAULT_TO = '/article';
const DEFAULT_COLLECTION = 'posts';
const DEFAULT_SAMPLE_LIMIT = 10;
const DEFAULT_HOSTS = ['snorkelology.co.uk', 'www.snorkelology.co.uk', 'localhost', '127.0.0.1'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const options = {
    apply: false,
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    collection: DEFAULT_COLLECTION,
    hosts: [...DEFAULT_HOSTS],
    limit: 0,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--from' && argv[i + 1]) {
      options.from = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--to' && argv[i + 1]) {
      options.to = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--collection' && argv[i + 1]) {
      options.collection = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--host' && argv[i + 1]) {
      options.hosts.push(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--limit' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.limit = parsed;
      }
      i += 1;
      continue;
    }

    if (arg === '--sample-limit' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.sampleLimit = parsed;
      }
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.from.startsWith('/') || !options.to.startsWith('/')) {
    throw new Error('Both --from and --to must be root-relative paths, e.g. /article and /article.');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node ./tools/backfill-article-links.mjs [options]

Backfills internal links in article documents by replacing /article with /article.

Options:
  --apply                 Apply updates. If omitted, runs in dry-run mode.
  --from <path>           Source path to replace. Default: ${DEFAULT_FROM}
  --to <path>             Replacement path. Default: ${DEFAULT_TO}
  --collection <name>     Mongo collection name. Default: ${DEFAULT_COLLECTION}
  --host <hostname>       Add an internal hostname for absolute URL replacement.
                          Can be repeated.
  --limit <n>             Only scan first n documents.
  --sample-limit <n>      Number of changed fields to print. Default: ${DEFAULT_SAMPLE_LIMIT}
  --help, -h              Show this help.

Environment:
  MONGO_URI               Required MongoDB connection string.
`);
}

function buildReplacer(options) {
  const escapedFrom = escapeRegex(options.from);
  const hostPattern = options.hosts.map((host) => escapeRegex(host.toLowerCase())).join('|');

  const absoluteRegex = hostPattern
    ? new RegExp(`((?:https?:)?\\/\\/(?:${hostPattern}))${escapedFrom}(?=\\/|\\?|#|$)`, 'gi')
    : null;

  // Prefix capture prevents replacing external links like https://example.com/article.
  const relativeRegex = new RegExp(`(^|[^A-Za-z0-9_-])${escapedFrom}(?=\\/|\\?|#|$)`, 'g');

  return function replaceInString(input) {
    let output = input;
    if (absoluteRegex) {
      output = output.replace(absoluteRegex, `$1${options.to}`);
    }
    output = output.replace(relativeRegex, `$1${options.to}`);
    return output;
  };
}

function collectStringUpdates(node, path, replaceInString, setOps, sampleChanges, sampleLimit) {
  if (typeof node === 'string') {
    if (!node.includes('/article')) {
      return;
    }
    const replaced = replaceInString(node);
    if (replaced !== node && path) {
      setOps[path] = replaced;
      if (sampleChanges.length < sampleLimit) {
        sampleChanges.push({ path, before: node, after: replaced });
      }
    }
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const nextPath = path ? `${path}.${i}` : String(i);
      collectStringUpdates(node[i], nextPath, replaceInString, setOps, sampleChanges, sampleLimit);
    }
    return;
  }

  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const nextPath = path ? `${path}.${key}` : key;
      collectStringUpdates(value, nextPath, replaceInString, setOps, sampleChanges, sampleLimit);
    }
  }
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

  const replaceInString = buildReplacer(options);
  const docsToUpdate = [];

  await mongoose.connect(mongoUri);
  try {
    const collection = mongoose.connection.collection(options.collection);
    const cursor = collection.find({});

    if (options.limit > 0) {
      cursor.limit(options.limit);
    }

    let scanned = 0;
    let changedFields = 0;
    const sampleChanges = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) {
        continue;
      }

      scanned += 1;

      const setOps = {};
      collectStringUpdates(doc, '', replaceInString, setOps, sampleChanges, options.sampleLimit);

      const paths = Object.keys(setOps);
      if (paths.length === 0) {
        continue;
      }

      changedFields += paths.length;
      docsToUpdate.push({ _id: doc._id, setOps });
    }

    console.log(`Scanned documents: ${scanned}`);
    console.log(`Documents needing update: ${docsToUpdate.length}`);
    console.log(`Changed fields: ${changedFields}`);
    console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY RUN'}`);

    if (sampleChanges.length > 0) {
      console.log(`\nSample changes (first ${sampleChanges.length}):`);
      for (const sample of sampleChanges) {
        console.log(`- ${sample.path}`);
        console.log(`  before: ${sample.before}`);
        console.log(`  after:  ${sample.after}`);
      }
    }

    if (!options.apply) {
      console.log('\nDry run complete. Re-run with --apply to write changes.');
      return;
    }

    if (docsToUpdate.length === 0) {
      console.log('\nNo updates to apply.');
      return;
    }

    const operations = docsToUpdate.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: item.setOps },
      },
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });
    console.log('\nApplied updates:');
    console.log(`- Matched: ${result.matchedCount}`);
    console.log(`- Modified: ${result.modifiedCount}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Backfill failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
