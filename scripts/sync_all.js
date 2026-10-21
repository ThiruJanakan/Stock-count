const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'index.html');

const TARGETS = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'Stock_Count_System_V5.html'),
  path.join(ROOT, 'public', 'Stock_Count_System_V5.html'),
  path.join(ROOT, 'app', 'src', 'main', 'assets', 'index.html'),
  path.join(ROOT, 'app', 'src', 'main', 'assets', 'Stock_Count_System_V5.html')
];

if (!fs.existsSync(SOURCE)) {
  console.error('Source file not found:', SOURCE);
  process.exit(1);
}

const content = fs.readFileSync(SOURCE);
console.log(`Synchronizing from index.html (${content.length} bytes)...`);

let updated = 0;
for (const target of TARGETS) {
  try {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, content);
    console.log(`  ✓ Synced to: ${path.relative(ROOT, target)}`);
    updated++;
  } catch (err) {
    console.error(`  ✗ Failed to sync to ${path.relative(ROOT, target)}:`, err.message);
  }
}

console.log(`Successfully synchronized ${updated}/${TARGETS.length} target files!`);
