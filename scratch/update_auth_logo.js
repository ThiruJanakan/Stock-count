const fs = require('fs');

const file = 'app/src/main/assets/auth-sessions.js';
let content = fs.readFileSync(file, 'utf8');

// 1. In addBrand
if (!content.includes('logo.src = "lina-logo.png"')) {
  content = content.replace(
    'card.className = "auth-card";',
    'card.className = "auth-card";\n    var logo = document.createElement("img");\n    logo.src = "lina-logo.png";\n    logo.alt = "Lina Logo";\n    logo.className = "auth-brand-logo";\n    card.appendChild(logo);'
  );
  console.log('Added logo to addBrand');
}

// 2. In renderDashboard
if (!content.includes('logo.className = "auth-header-logo"')) {
  content = content.replace(
    'header.className = "auth-dashboard-header";',
    'header.className = "auth-dashboard-header";\n    var logo = document.createElement("img");\n    logo.src = "lina-logo.png";\n    logo.alt = "Lina Logo";\n    logo.className = "auth-header-logo";\n    header.appendChild(logo);'
  );
  console.log('Added logo to renderDashboard');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Updated auth-sessions.js successfully');
