const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');
const lines = content.split('\n');
const line611 = lines[610];

// Let's print from 5500 to 6500 to see state variables
console.log('--- State declarations ---');
console.log(line611.substring(5500, 6500));
