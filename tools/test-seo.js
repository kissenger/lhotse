import fs from 'fs';
import path from 'path';

const root = process.cwd();
const files = [
  { name: 'prod', file: path.join(root, 'src', 'config', 'prod', 'index.html') },
  { name: 'beta', file: path.join(root, 'src', 'config', 'beta', 'index.html') },
];

function read(f) {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch (e) {
    console.error(`ERROR: cannot read ${f}: ${e.message}`);
    process.exit(2);
  }
}

function has(html, re) {
  return re.test(html);
}

let failed = false;

for (const f of files) {
  const html = read(f.file);
  console.log(`Checking ${f.name}: ${f.file}`);

  // Common checks
  const checks = [
    { name: 'canonical', ok: has(html, /<link[^>]+rel=["']canonical["']/i) },
    { name: 'og:type', ok: has(html, /property=["']og:type["']/i) },
    { name: 'og:title', ok: has(html, /property=["']og:title["']/i) },
    { name: 'og:description', ok: has(html, /property=["']og:description["']/i) },
    { name: 'twitter:card', ok: has(html, /name=["']twitter:card["']/i) },
  ];

  for (const c of checks) {
    if (!c.ok) {
      console.error(`  MISSING: ${c.name}`);
      failed = true;
    } else {
      console.log(`  OK: ${c.name}`);
    }
  }

  if (f.name === 'beta') {
    // Beta must have noindex
    if (!has(html, /<meta[^>]+name=["']robots["'][^>]*content=["']?noindex["']?/i) && !has(html, /googlebot[^>]*noindex/i)) {
      console.error('  MISSING: beta should include robots noindex');
      failed = true;
    } else {
      console.log('  OK: beta noindex present');
    }
  }
}

if (failed) {
  console.error('\nOne or more SEO checks failed.');
  process.exit(1);
} else {
  console.log('\nAll SEO checks passed.');
  process.exit(0);
}
