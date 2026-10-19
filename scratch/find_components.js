const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

['function tD(', 'function aD(', 'function iD(', 'function sD(', 'function Ph('].forEach(name => {
  let idx = line611.indexOf(name);
  console.log(`${name} found at index: ${idx}`);
  if (idx !== -1) {
    console.log(line611.substring(idx, idx + 400));
    console.log('---------------------------------');
  }
});
