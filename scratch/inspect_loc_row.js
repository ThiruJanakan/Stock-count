const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const idx = content.indexOf('className:"loc-row"');
console.log(content.substring(idx - 50, idx + 400));
