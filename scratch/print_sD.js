const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

console.log(line611.substring(66000, 67687));
