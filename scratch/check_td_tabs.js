const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

let tDIdx = line611.indexOf('function tD(');
console.log('tD snippet:', line611.substring(tDIdx, tDIdx + 300));

let tabsIdx = line611.indexOf('className:"tabs"');
console.log('tabs snippet:', line611.substring(tabsIdx, tabsIdx + 600));
