const fs = require('fs');

function updateHtml(filePath) {
  console.log('Processing HTML:', filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Ensure hD render when l === "home"
  const hdRenderSnippet = `l==="home"&&(0,k.jsx)(hD,{master:a,session:n,historyIndex:i,totalCount:Te,countedCount:he,pendingCount:Ke,mismatchCount:la,progressPct:wr,onContinueCount:()=>u("count"),onViewReport:()=>u("report"),onViewHistory:()=>u("history"),onOpenHistorySession:Z=>{u("history");Bf(Z);},onNewSession:()=>Y.current&&Y.current.click(),onImportBackup:()=>_e.current&&_e.current.click()}),`;
  
  if (!content.includes('l==="home"&&(0,k.jsx)(hD')) {
    const target = 'l==="count"&&(0,k.jsx)(rD,';
    if (content.includes(target)) {
      content = content.replace(target, hdRenderSnippet + target);
      console.log('  -> Rendered hD when l==="home"');
    } else {
      console.error('  -> Could not find target:', target);
    }
  } else {
    console.log('  -> hD render already present');
  }

  // 2. Add logo to upload screen (tD)
  const oldEyebrow = `(0,k.jsx)("div",{className:"upload-eyebrow",children:"LINA MANUFACTURING (PVT) LTD \xB7 WAREHOUSE"})`;
  const newEyebrow = `(0,k.jsx)("img",{src:"lina-logo.png",alt:"Lina Logo",className:"upload-brand-logo"}),(0,k.jsx)("div",{className:"upload-eyebrow",children:"LINA MANUFACTURING (PVT) LTD \xB7 WAREHOUSE"})`;
  if (content.includes(oldEyebrow) && !content.includes('className:"upload-brand-logo"')) {
    content = content.replace(oldEyebrow, newEyebrow);
    console.log('  -> Added Lina logo to upload card');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Saved:', filePath);
}

function updateAuthSessions(filePath) {
  console.log('Processing Auth Sessions:', filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add logo in addBrand
  const oldBrandFn = `  function addBrand(parent, subtitle) {\n    var card = document.createElement("section");\n    card.className = "auth-card";\n    var brand = document.createElement("div");`;
  const newBrandFn = `  function addBrand(parent, subtitle) {\n    var card = document.createElement("section");\n    card.className = "auth-card";\n    var logo = document.createElement("img");\n    logo.src = "lina-logo.png";\n    logo.alt = "Lina Logo";\n    logo.className = "auth-brand-logo";\n    card.appendChild(logo);\n    var brand = document.createElement("div");`;

  if (content.includes(oldBrandFn)) {
    content = content.replace(oldBrandFn, newBrandFn);
    console.log('  -> Added logo to login addBrand');
  }

  // 2. Add logo in renderDashboard header
  const oldDashHeader = `    var header = document.createElement("header");\n    header.className = "auth-dashboard-header";\n    var headerLeft = document.createElement("div");`;
  const newDashHeader = `    var header = document.createElement("header");\n    header.className = "auth-dashboard-header";\n    var logo = document.createElement("img");\n    logo.src = "lina-logo.png";\n    logo.alt = "Lina Logo";\n    logo.className = "auth-header-logo";\n    header.appendChild(logo);\n    var headerLeft = document.createElement("div");`;

  if (content.includes(oldDashHeader)) {
    content = content.replace(oldDashHeader, newDashHeader);
    console.log('  -> Added logo to dashboard header');
  }

  // 3. Add styles if missing
  if (!content.includes('.auth-brand-logo{')) {
    const logoStyles = `".auth-brand-logo{width:76px;height:76px;object-fit:contain;margin:0 auto 16px;display:block;border-radius:16px;background:#fff;padding:6px;box-shadow:0 4px 16px rgba(0,0,0,0.08);border:1px solid #d4dde1}",\n    ".auth-header-logo{width:56px;height:56px;object-fit:contain;border-radius:12px;background:#fff;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #d4dde1;flex-shrink:0}",\n    `;
    content = content.replace('".auth-screen,', logoStyles + '".auth-screen,');
    console.log('  -> Added logo styles in auth-sessions.js');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Saved:', filePath);
}

updateHtml('app/src/main/assets/Stock_Count_System_V5.html');
updateHtml('Stock_Count_System_V5.html');
updateAuthSessions('app/src/main/assets/auth-sessions.js');
