const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

let idx = line611.indexOf('function sD(');
console.log(line611.substring(idx, idx + 1200));
