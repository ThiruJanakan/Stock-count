const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610]; // 0-indexed line 611
console.log('Line 611 total length:', line611.length);

let searchTerms = ['Home', 'History', 'Report', 'activeTab', 'setActiveTab', 'master', 'session'];
searchTerms.forEach(term => {
  let idx = 0;
  let matches = [];
  while ((idx = line611.indexOf(term, idx)) !== -1) {
    matches.push(idx);
    idx += term.length;
  }
  console.log(`Term "${term}": ${matches.length} occurrences. First few around:`);
  matches.slice(0, 5).forEach(pos => {
    console.log(`  [${pos}]: ...${line611.substring(Math.max(0, pos - 40), Math.min(line611.length, pos + 80))}...`);
  });
});
