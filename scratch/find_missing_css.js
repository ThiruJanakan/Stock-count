const fs = require('fs');
const content = fs.readFileSync('app/src/main/assets/Stock_Count_System_V5.html', 'utf8');

// Extract all class names
const classMatches = content.match(/className:\s*"([^"]+)"/g) || [];
const classes = new Set();
classMatches.forEach(m => {
  const match = m.match(/className:\s*"([^"]+)"/);
  if (match) {
    match[1].split(/\s+/).forEach(c => {
      if (c && !c.includes('${') && !c.includes('`')) classes.add(c);
    });
  }
});

console.log('Total unique classes found:', classes.size);
const missing = [];
classes.forEach(c => {
  if (!content.includes('.' + c + '{') && 
      !content.includes('.' + c + ' ') && 
      !content.includes('.' + c + ',') && 
      !content.includes('.' + c + ':') && 
      !content.includes('.' + c + '.')) {
    missing.push(c);
  }
});

console.log('Classes possibly missing CSS:', missing);
