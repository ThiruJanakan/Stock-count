const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('label:"Home"') || l.includes('icon:') || (l.includes('Count') && l.includes('History') && l.includes('Report'))) {
    console.log(`Line ${i + 1}: ${l.slice(0, 180)}`);
  }
});
