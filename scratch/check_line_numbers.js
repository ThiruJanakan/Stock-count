const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('function tD(')) console.log('Line for tD:', i);
  if (l.includes('className:"tabs"')) console.log('Line for tabs:', i);
  if (l.includes('function hD(')) console.log('Line for hD:', i);
});
