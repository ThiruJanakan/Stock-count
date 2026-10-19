const fs = require('fs');
const c = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
let idx = 0;
while ((idx = c.indexOf('LINA MANUFACTURING', idx)) !== -1) {
  console.log(`[${idx}]: ...${c.substring(Math.max(0, idx - 40), Math.min(c.length, idx + 80))}...`);
  idx += 18;
}
