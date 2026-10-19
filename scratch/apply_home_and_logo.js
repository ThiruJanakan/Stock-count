const fs = require('fs');

function updateHtmlFile(filePath) {
  console.log('Updating HTML file:', filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let line611 = lines[610];

  // 1. Define hD component
  const hdCode = `function hD({master:e,session:t,historyIndex:a,totalCount:r,countedCount:n,pendingCount:s,mismatchCount:i,progressPct:o,onContinueCount:l,onViewReport:c,onViewHistory:u,onOpenHistorySession:h,onNewSession:f,onImportBackup:d}){return(0,k.jsxs)("div",{className:"home-view",children:[(0,k.jsxs)("div",{className:"home-hero-card",children:[(0,k.jsx)("img",{src:"lina-logo.png",alt:"Lina Logo",className:"home-brand-logo"}),(0,k.jsxs)("div",{className:"home-hero-text",children:[(0,k.jsx)("div",{className:"home-brand-name",children:"LINA MANUFACTURING (PVT) LTD \xB7 WAREHOUSE"}),(0,k.jsx)("h2",{className:"home-title",children:"Stock Verification & Sessions Portal"}),(0,k.jsx)("p",{className:"home-sub",children:"Manage active stock counting sessions, track physical variances, and start new audit cycles."})]})]}),(0,k.jsxs)("div",{className:"home-card",children:[(0,k.jsxs)("div",{className:"card-title",children:[(0,k.jsx)(Ls,{size:15})," Start a new session"]}),(0,k.jsx)("p",{className:"home-action-desc",children:"Upload this month's stock sheet to start fresh, or import a session backup JSON."}),(0,k.jsxs)("div",{className:"home-actions-row",children:[(0,k.jsxs)("button",{className:"btn btn-primary",onClick:f,children:[(0,k.jsx)(Ls,{size:15})," Upload Excel stock sheet"]}),(0,k.jsxs)("button",{className:"btn btn-secondary",onClick:d,children:[(0,k.jsx)(Ss,{size:15})," Import session backup"]})]})]}),(0,k.jsxs)("div",{className:"home-card",children:[(0,k.jsxs)("div",{className:"card-title",children:[(0,k.jsx)(Si,{size:15})," Current active session"]}),e?(0,k.jsxs)("div",{className:"home-active-box",children:[(0,k.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},children:[(0,k.jsx)("strong",{style:{fontSize:16,color:"var(--ink)"},children:(e.meta&&e.meta.fileName)||"Stock On Hand Ledger"}),(0,k.jsx)("span",{className:\`badge \${t&&t.status==="complete"?"badge-match":"badge-pending"}\`,children:t&&t.status==="complete"?"Completed":"In Progress"})]}),(0,k.jsxs)("div",{className:"home-session-meta",children:["Started: ",rr(t&&t.startDate),t&&t.endDate?\` \xB7 Completed: \${rr(t.endDate)}\`:" \xB7 Ongoing",\` \xB7 \${r} total stock lines\`]}),(0,k.jsxs)("div",{className:"stat-grid",style:{margin:"14px 0"},children:[(0,k.jsx)(Ti,{label:"Total items",value:r}),(0,k.jsx)(Ti,{label:"Counted",value:\`\${n} (\${o}%)\`,tone:"teal"}),(0,k.jsx)(Ti,{label:"Pending",value:s}),(0,k.jsx)(Ti,{label:"Mismatches",value:i,tone:i>0?"shortage":""})]}),(0,k.jsx)("div",{className:"progress-bar",style:{marginBottom:16},children:(0,k.jsx)("div",{className:"progress-fill",style:{width:\`\${o}%\`}})}),(0,k.jsxs)("div",{className:"home-actions-row",children:[(0,k.jsxs)("button",{className:"btn btn-primary",onClick:l,children:[(0,k.jsx)(Si,{size:14})," Continue counting"]}),(0,k.jsxs)("button",{className:"btn btn-secondary",onClick:c,children:[(0,k.jsx)(ks,{size:14})," View report"]})]})]}):(0,k.jsx)("div",{className:"empty-hint",children:"No active session currently open. Start a new session using the buttons above."})]}),(0,k.jsxs)("div",{className:"home-card",children:[(0,k.jsxs)("div",{className:"card-title",children:[(0,k.jsx)(Li,{size:15}),\` Past sessions & history (\${a.length})\`]}),a.length===0?(0,k.jsx)("div",{className:"empty-hint",style:{padding:"20px 0"},children:"No archived sessions yet. When you complete a count and upload a new stock sheet, previous sessions will be listed here."}):(0,k.jsx)("div",{className:"home-history-list",children:a.map(s=>(0,k.jsxs)("div",{className:"home-history-item",children:[(0,k.jsxs)("div",{children:[(0,k.jsx)("div",{className:"sr-code",children:s.fileName}),(0,k.jsxs)("div",{className:"sr-name",children:[rr(s.startDate)," \u2014 ",rr(s.endDate)," \xB7 ",s.countedCount,"/",s.itemCount," counted \xB7 ",s.mismatchCount," mismatch",s.mismatchCount===1?"":"es"]})]}),(0,k.jsxs)("button",{className:"btn btn-secondary btn-sm",onClick:()=>h(s.id),children:[(0,k.jsx)(Li,{size:13})," View in history"]})]},s.id))})]})]})}function iD()`;

  if (!line611.includes('function hD(')) {
    line611 = line611.replace('function iD()', hdCode);
    console.log('Inserted hD before iD()');
  }

  // 2. Update Home tab button in tabs
  const oldHomeBtn = `(0,k.jsx)(Ph,{active:!1,onClick:()=>Y.current&&Y.current.click(),icon:(0,k.jsx)(Ls,{size:15}),label:"Home"})`;
  const newHomeBtn = `(0,k.jsx)(Ph,{active:l==="home",onClick:()=>u("home"),icon:(0,k.jsx)(Ls,{size:15}),label:"Home"})`;
  if (line611.includes(oldHomeBtn)) {
    line611 = line611.replace(oldHomeBtn, newHomeBtn);
    console.log('Updated Home tab button');
  }

  // 3. Render hD when l === "home"
  const hdRenderCode = `l==="home"&&(0,k.jsx)(hD,{master:a,session:n,historyIndex:i,totalCount:Te,countedCount:he,pendingCount:Ke,mismatchCount:la,progressPct:wr,onContinueCount:()=>u("count"),onViewReport:()=>u("report"),onViewHistory:()=>u("history"),onOpenHistorySession:Z=>{u("history");Bf(Z);},onNewSession:()=>Y.current&&Y.current.click(),onImportBackup:()=>_e.current&&_e.current.click()}),`;
  if (!line611.includes('l==="home"')) {
    line611 = line611.replace(
      'l==="count"&&(0,k.jsx)(rD,',
      hdRenderCode + 'l==="count"&&(0,k.jsx)(rD,'
    );
    console.log('Added l==="home" render branch');
  }

  // 4. Add Lina logo to upload card (tD)
  const oldUploadEyebrow = `(0,k.jsx)("div",{className:"upload-eyebrow",children:"LINA MANUFACTURING (PVT) LTD \xB7 WAREHOUSE"}),(0,k.jsx)("h1",{className:"upload-title"`;
  const newUploadEyebrow = `(0,k.jsx)("img",{src:"lina-logo.png",alt:"Lina Logo",className:"upload-brand-logo"}),(0,k.jsx)("div",{className:"upload-eyebrow",children:"LINA MANUFACTURING (PVT) LTD \xB7 WAREHOUSE"}),(0,k.jsx)("h1",{className:"upload-title"`;
  if (line611.includes(oldUploadEyebrow) && !line611.includes('className:"upload-brand-logo"')) {
    line611 = line611.replace(oldUploadEyebrow, newUploadEyebrow);
    console.log('Added Lina logo to upload card');
  }

  // 5. Add Lina logo to active header (aD)
  const oldHeaderEyebrow = `(0,k.jsxs)("div",{className:"eyebrow",children:[(0,k.jsx)(il,{size:12})," LINA MANUFACTURING (PVT) LTD"]})`;
  const newHeaderEyebrow = `(0,k.jsxs)("div",{className:"eyebrow",children:[(0,k.jsx)("img",{src:"lina-logo.png",alt:"Lina",style:{width:18,height:18,objectFit:"contain",verticalAlign:"middle",marginRight:6,borderRadius:3}})," LINA MANUFACTURING (PVT) LTD"]})`;
  if (line611.includes(oldHeaderEyebrow)) {
    line611 = line611.replace(oldHeaderEyebrow, newHeaderEyebrow);
    console.log('Added Lina logo to active header');
  }

  lines[610] = line611;

  // 6. Add CSS for home view and logos
  const customCss = `
<style id="home-view-and-logo-styles">
  .home-view {
    margin-bottom: 30px;
  }
  .home-hero-card {
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--card);
    border: 1px solid var(--line);
    border-top: 4px solid var(--accent-teal);
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 4px 18px rgba(14, 27, 38, 0.05);
    margin-bottom: 18px;
  }
  .home-brand-logo {
    width: 76px;
    height: 76px;
    object-fit: contain;
    border-radius: 14px;
    background: #ffffff;
    padding: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    border: 1px solid var(--line-soft);
    flex-shrink: 0;
  }
  .home-hero-text {
    min-width: 0;
    flex: 1;
  }
  .home-brand-name {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-teal);
    margin-bottom: 4px;
  }
  .home-title {
    margin: 0 0 6px;
    font-family: var(--font-display);
    font-size: clamp(20px, 3.2vw, 26px);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .home-sub {
    margin: 0;
    color: var(--ink-soft);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .home-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 22px;
    margin-bottom: 18px;
    box-shadow: 0 3px 12px rgba(14, 27, 38, 0.03);
  }
  .home-action-desc {
    margin: 4px 0 16px;
    color: var(--ink-soft);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .home-actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .home-actions-row .btn {
    min-height: 46px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
  }
  .home-session-meta {
    color: var(--ink-soft);
    font-family: var(--font-mono);
    font-size: 12px;
    margin: 6px 0 14px;
  }
  .home-history-list {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }
  .home-history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--paper-2);
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    transition: all 0.18s ease;
  }
  .home-history-item:hover {
    background: #ffffff;
    border-color: var(--accent-teal);
    box-shadow: 0 4px 12px rgba(27, 110, 95, 0.08);
  }
  .upload-brand-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    margin: 0 auto 16px;
    display: block;
    border-radius: 16px;
    background: #ffffff;
    padding: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    border: 1px solid var(--line-soft);
  }
  @media (max-width: 640px) {
    .home-hero-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      padding: 18px;
    }
    .home-brand-logo {
      width: 58px;
      height: 58px;
    }
    .home-actions-row {
      flex-direction: column;
    }
    .home-actions-row .btn {
      width: 100%;
      justify-content: center;
    }
    .home-history-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .home-history-item .btn {
      width: 100%;
    }
  }
</style>
`;

  let updatedContent = lines.join('\n');
  if (!updatedContent.includes('id="home-view-and-logo-styles"')) {
    updatedContent = updatedContent.replace('</head>', customCss + '</head>');
    console.log('Added CSS styles');
  }

  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('Successfully written:', filePath);
}

updateHtmlFile('app/src/main/assets/Stock_Count_System_V5.html');
updateHtmlFile('Stock_Count_System_V5.html');
