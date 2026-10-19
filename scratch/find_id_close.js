const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
for (let i = 600; i < 2315; i++) {
  if (lines[i].includes('function iD') || lines[i].includes('`})}') || lines[i].includes('pdf-report')) {
    console.log(i + 1, lines[i]);
  }
}
