const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

// Let's find where tabs state is initialized: search for ("count")
let idx = 0;
while ((idx = line611.indexOf('"count"', idx)) !== -1) {
  console.log(`[${idx}]: ...${line611.substring(Math.max(0, idx - 30), Math.min(line611.length, idx + 40))}...`);
  idx += 7;
}
