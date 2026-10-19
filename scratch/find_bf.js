const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

let idx = line611.indexOf('function Bf(');
if (idx === -1) idx = line611.indexOf('async function Bf(');
if (idx === -1) idx = line611.indexOf('Bf=');
console.log('Bf search:', idx);
if (idx !== -1) {
  console.log(line611.substring(idx - 20, idx + 250));
}
