const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const appLine = lines[757];

let tDIdx = appLine.indexOf('function tD(');
console.log('tD snippet:', appLine.substring(tDIdx, tDIdx + 300));

let tabsIdx = appLine.indexOf('className:"tabs"');
console.log('tabs snippet:', appLine.substring(tabsIdx, tabsIdx + 400));
