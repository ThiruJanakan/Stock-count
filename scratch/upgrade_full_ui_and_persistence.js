const fs = require('fs');

// 1. Update auth-sessions.js
console.log('--- 1. Updating auth-sessions.js ---');
let authContent = fs.readFileSync('app/src/main/assets/auth-sessions.js', 'utf8');

// Replace login submit handler to unlock app directly and sync data
const oldLoginSuccess = `      if (result === "OK") {
        renderDashboard();
        return;
      }`;

const newLoginSuccess = `      if (result === "OK") {
        showApp();
        try {
          var keys = JSON.parse(bridge.keys());
          keys.forEach(function (k) {
            var val = bridge.getItem(k);
            if (val !== null) window.localStorage.setItem(k, val);
          });
        } catch (e) {}
        if (window.__reloadStockData) {
          window.__reloadStockData();
        } else {
          window.sessionStorage.setItem("lina-open-active", "1");
          window.location.reload();
        }
        return;
      }`;

if (authContent.includes('renderDashboard();\n        return;')) {
  authContent = authContent.replace(
    'renderDashboard();\n        return;',
    `showApp();\n        try {\n          var keys = JSON.parse(bridge.keys());\n          keys.forEach(function (k) {\n            var val = bridge.getItem(k);\n            if (val !== null) window.localStorage.setItem(k, val);\n          });\n        } catch (e) {}\n        if (window.__reloadStockData) {\n          window.__reloadStockData();\n        } else {\n          window.sessionStorage.setItem("lina-open-active", "1");\n          window.location.reload();\n        }\n        return;`
  );
  console.log('  -> Updated login submit handler to unlock app and sync data');
}

// Replace bottom startup check
if (authContent.includes('} else if (bridge.isAuthenticated()) {\n    renderDashboard();')) {
  authContent = authContent.replace(
    '} else if (bridge.isAuthenticated()) {\n    renderDashboard();',
    `} else if (bridge.isAuthenticated()) {\n    showApp();\n    if (window.__reloadStockData) window.__reloadStockData();`
  );
  console.log('  -> Updated startup check to showApp() when authenticated');
}

// Expose window.LinaLockApp
if (!authContent.includes('window.LinaLockApp =')) {
  authContent += `\nwindow.LinaLockApp = function () {\n  if (window.AndroidStockStorage && window.AndroidStockStorage.lock) {\n    window.AndroidStockStorage.lock();\n  }\n  window.location.reload();\n};\n`;
  console.log('  -> Added window.LinaLockApp helper');
}

fs.writeFileSync('app/src/main/assets/auth-sessions.js', authContent, 'utf8');
console.log('Saved app/src/main/assets/auth-sessions.js');

// 2. Update Stock_Count_System_V5.html
console.log('\n--- 2. Updating Stock_Count_System_V5.html ---');

function updateSystemHtml(filePath) {
  console.log('Processing:', filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  // Change default tab from "count" to "home"
  content = content.replace('[l,u]=(0,Ae.useState)("count")', '[l,u]=(0,Ae.useState)("home")');
  console.log('  -> Set default tab to "home"');

  // Make loadData available globally as window.__reloadStockData
  const oldLoadEffect = `(async()=>{let[Z,te,Oe]=await Promise.all([Pf(O2),Pf(Th),Pf(B2)]),kt=null,Je=null;if(Z)try{kt=JSON.parse(Z)}catch{}if(te)try{Je=JSON.parse(te)}catch{}if(Oe)try{o(JSON.parse(Oe))}catch{}kt&&!Je&&(Je=H2([]),await xl(Th,Je)),Je&&!Je.excludedKeys&&(Je.excludedKeys=[]),kt&&r(kt),Je&&s(Je),t(!1)})()`;
  const newLoadEffect = `async function loadAllStockData(){let[Z,te,Oe]=await Promise.all([Pf(O2),Pf(Th),Pf(B2)]),kt=null,Je=null;if(Z)try{kt=JSON.parse(Z)}catch{}if(te)try{Je=JSON.parse(te)}catch{}if(Oe)try{o(JSON.parse(Oe))}catch{}kt&&!Je&&(Je=H2([]),await xl(Th,Je)),Je&&!Je.excludedKeys&&(Je.excludedKeys=[]),kt&&r(kt),Je&&s(Je),t(!1)}window.__reloadStockData=loadAllStockData;loadAllStockData()`;
  if (content.includes(oldLoadEffect)) {
    content = content.replace(oldLoadEffect, newLoadEffect);
    console.log('  -> Exposed window.__reloadStockData in useEffect');
  }

  // Insert resumeHistorySession inside j2 before Bf
  const resumeHistoryCode = `async function resumeHistorySession(Z){O(!0);try{let te=ae[Z];if(!te){let raw=await Pf(b2+Z);if(raw)te=JSON.parse(raw)}if(!te||!Array.isArray(te.items))throw new Error("Could not load archived session data.");if(a&&n&&Object.keys(n.counts||{}).length>0){await Wt()}let newMaster={meta:{fileName:te.fileName||"Stock Session",uploadedAt:te.uploadedAt||new Date().toISOString(),totalItems:te.items.length},items:te.items};let newSession={status:"in_progress",startDate:te.startDate||Af(),endDate:null,responsiblePersons:Array.isArray(te.responsiblePersons)?te.responsiblePersons:[],counts:(te.counts&&typeof te.counts==="object")?te.counts:{},excludedKeys:Array.isArray(te.excludedKeys)?te.excludedKeys:[]};await sr(newMaster);await Nt(newSession);h(null);v(null);u("count");c({type:"success",text:\`Continued session "\${newMaster.meta.fileName}". You can now count items.\`})}catch(err){c({type:"error",text:err.message||"Could not continue this session."})}finally{O(!1)}}`;

  if (!content.includes('function resumeHistorySession(')) {
    content = content.replace('async function Bf(Z){', resumeHistoryCode + 'async function Bf(Z){');
    console.log('  -> Added resumeHistorySession function');
  }

  // Update hD call to pass onResumeSession
  const oldHdCall = `l==="home"&&(0,k.jsx)(hD,{master:a,session:n,historyIndex:i,totalCount:Te,countedCount:he,pendingCount:Ke,mismatchCount:la,progressPct:wr,onContinueCount:()=>u("count"),onViewReport:()=>u("report"),onViewHistory:()=>u("history"),onOpenHistorySession:Z=>{u("history");Bf(Z);},onNewSession:()=>Y.current&&Y.current.click(),onImportBackup:()=>_e.current&&_e.current.click()}),`;
  const newHdCall = `l==="home"&&(0,k.jsx)(hD,{master:a,session:n,historyIndex:i,totalCount:Te,countedCount:he,pendingCount:Ke,mismatchCount:la,progressPct:wr,onContinueCount:()=>u("count"),onViewReport:()=>u("report"),onViewHistory:()=>u("history"),onOpenHistorySession:Z=>{u("history");Bf(Z);},onResumeSession:resumeHistorySession,onDownloadReport:bf,records:ae,onLoadRecord:Bf,onNewSession:()=>Y.current&&Y.current.click(),onImportBackup:()=>_e.current&&_e.current.click()}),`;

  if (content.includes(oldHdCall)) {
    content = content.replace(oldHdCall, newHdCall);
    console.log('  -> Updated hD invocation with onResumeSession and onDownloadReport');
  }

  // Redefine hD component with full history view details & continue functionality
  const oldHdDef = content.indexOf('function hD(');
  const nextFnDef = content.indexOf('function iD()', oldHdDef);

  if (oldHdDef !== -1 && nextFnDef !== -1) {
    const updatedHdFunction = `function hD({master:e,session:t,historyIndex:a,totalCount:r,countedCount:n,pendingCount:s,mismatchCount:i,progressPct:o,onContinueCount:l,onViewReport:c,onViewHistory:u,onOpenHistorySession:h,onResumeSession:resumeFn,onDownloadReport:downFn,records:recObj,onLoadRecord:loadRecFn,onNewSession:f,onImportBackup:d}){
      let [expandedId, setExpandedId] = (0, Ae.useState)(null);
      let [resumingId, setResumingId] = (0, Ae.useState)(null);

      const handleToggle = (id) => {
        if (expandedId === id) {
          setExpandedId(null);
        } else {
          setExpandedId(id);
          if (loadRecFn) loadRecFn(id);
        }
      };

      const handleResume = async (id) => {
        if (!confirm("Continue counting this past session? The current session will be saved to History first.")) return;
        setResumingId(id);
        try {
          if (resumeFn) await resumeFn(id);
        } finally {
          setResumingId(null);
        }
      };

      return (0, k.jsxs)("div", {
        className: "home-view animate-fade-in",
        children: [
          (0, k.jsxs)("div", {
            className: "home-hero-card",
            children: [
              (0, k.jsx)("img", { src: "lina-logo.png", alt: "Lina Logo", className: "home-brand-logo" }),
              (0, k.jsxs)("div", {
                className: "home-hero-text",
                children: [
                  (0, k.jsx)("div", { className: "home-brand-name", children: "LINA MANUFACTURING (PVT) LTD · WAREHOUSE" }),
                  (0, k.jsx)("h2", { className: "home-title", children: "Stock Verification & Sessions Portal" }),
                  (0, k.jsx)("p", { className: "home-sub", children: "Real-time mobile stock verification, barcode scanning, and multi-session management." })
                ]
              }),
              window.LinaLockApp && (0, k.jsxs)("button", {
                className: "btn btn-ghost btn-sm home-lock-btn",
                onClick: window.LinaLockApp,
                children: [(0, k.jsx)(il, { size: 14 }), " Lock app"]
              })
            ]
          }),

          // Active session card
          (0, k.jsxs)("div", {
            className: "home-card",
            children: [
              (0, k.jsxs)("div", {
                className: "card-title",
                style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
                children: [
                  (0, k.jsxs)("span", { children: [(0, k.jsx)(Si, { size: 15 }), " Current Active Session"] }),
                  e && (0, k.jsx)("span", {
                    className: \`badge \${t && t.status === "complete" ? "badge-match" : "badge-in-progress"}\`,
                    children: t && t.status === "complete" ? "Completed" : "In Progress"
                  })
                ]
              }),
              e ? (0, k.jsxs)("div", {
                className: "home-active-box",
                children: [
                  (0, k.jsx)("div", {
                    className: "home-active-filename",
                    children: (e.meta && e.meta.fileName) || "Stock On Hand Ledger"
                  }),
                  (0, k.jsxs)("div", {
                    className: "home-session-meta",
                    children: [
                      "Started: ", rr(t && t.startDate),
                      t && t.endDate ? \` · Completed: \${rr(t.endDate)}\` : " · Ongoing",
                      \` · \${r} stock items\`
                    ]
                  }),
                  (0, k.jsxs)("div", {
                    className: "stat-grid",
                    style: { margin: "14px 0" },
                    children: [
                      (0, k.jsx)(Ti, { label: "Total items", value: r }),
                      (0, k.jsx)(Ti, { label: "Counted", value: \`\${n} (\${o}%)\`, tone: "teal" }),
                      (0, k.jsx)(Ti, { label: "Pending", value: s }),
                      (0, k.jsx)(Ti, { label: "Mismatches", value: i, tone: i > 0 ? "shortage" : "" })
                    ]
                  }),
                  (0, k.jsx)("div", {
                    className: "progress-track",
                    style: { marginBottom: 16 },
                    children: (0, k.jsx)("div", { className: "progress-fill", style: { width: \`\${o}%\` } })
                  }),
                  (0, k.jsxs)("div", {
                    className: "home-actions-row",
                    children: [
                      (0, k.jsxs)("button", {
                        className: "btn btn-primary btn-lg",
                        onClick: l,
                        children: [(0, k.jsx)(Si, { size: 16 }), " Continue Counting"]
                      }),
                      (0, k.jsxs)("button", {
                        className: "btn btn-secondary",
                        onClick: c,
                        children: [(0, k.jsx)(ks, { size: 15 }), " View Full Report"]
                      })
                    ]
                  })
                ]
              }) : (0, k.jsxs)("div", {
                className: "empty-hint",
                style: { padding: "20px 0" },
                children: [
                  "No active stock count is currently loaded.",
                  (0, k.jsx)("br", {}),
                  "Upload a new stock sheet below, or select a past session to continue."
                ]
              })
            ]
          }),

          // Start a new session actions
          (0, k.jsxs)("div", {
            className: "home-card",
            children: [
              (0, k.jsxs)("div", { className: "card-title", children: [(0, k.jsx)(Ls, { size: 15 }), " Start a New Session"] }),
              (0, k.jsx)("p", { className: "home-action-desc", children: "Upload this month's Stock On Hand Excel sheet (.xlsx) to begin a new audit cycle, or import a colleague's JSON backup." }),
              (0, k.jsxs)("div", {
                className: "home-actions-row",
                children: [
                  (0, k.jsxs)("button", { className: "btn btn-primary", onClick: f, children: [(0, k.jsx)(Ls, { size: 15 }), " Upload Excel Stock Sheet"] }),
                  (0, k.jsxs)("button", { className: "btn btn-secondary", onClick: d, children: [(0, k.jsx)(Ss, { size: 15 }), " Import Session Backup"] })
                ]
              })
            ]
          }),

          // Past sessions & history list with select/continue & view details
          (0, k.jsxs)("div", {
            className: "home-card",
            children: [
              (0, k.jsxs)("div", {
                className: "card-title",
                style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
                children: [
                  (0, k.jsxs)("span", { children: [(0, k.jsx)(Li, { size: 15 }), \` Past Sessions & History (\${a.length})\`] }),
                  a.length > 0 && (0, k.jsx)("button", { className: "btn btn-ghost btn-sm", onClick: u, children: "Open History Tab →" })
                ]
              }),
              a.length === 0 ? (0, k.jsx)("div", {
                className: "empty-hint",
                style: { padding: "24px 0" },
                children: "No archived sessions yet. When you complete a count and upload a new sheet, previous sessions are saved here automatically."
              }) : (0, k.jsx)("div", {
                className: "home-history-list",
                children: a.map(sItem => {
                  let isExp = expandedId === sItem.id;
                  let rec = recObj && recObj[sItem.id];
                  let isBusyResuming = resumingId === sItem.id;

                  return (0, k.jsxs)("div", {
                    className: \`home-history-card \${isExp ? "is-expanded" : ""}\`,
                    children: [
                      (0, k.jsxs)("div", {
                        className: "home-history-header",
                        onClick: () => handleToggle(sItem.id),
                        children: [
                          (0, k.jsxs)("div", {
                            className: "home-history-title-block",
                            children: [
                              (0, k.jsx)("div", { className: "home-history-filename", children: sItem.fileName }),
                              (0, k.jsxs)("div", {
                                className: "home-history-subline",
                                children: [
                                  rr(sItem.startDate), " — ", rr(sItem.endDate),
                                  " · ", sItem.countedCount, "/", sItem.itemCount, " counted",
                                  sItem.mismatchCount > 0 ? \` · \${sItem.mismatchCount} variance(s)\` : " · All matched"
                                ]
                              })
                            ]
                          }),
                          (0, k.jsxs)("div", {
                            className: "home-history-header-actions",
                            children: [
                              (0, k.jsx)("span", { className: "badge badge-archived", children: "Archived" }),
                              (0, k.jsx)(ol, { size: 16, className: isExp ? "chev-open" : "" })
                            ]
                          })
                        ]
                      }),

                      // Expanded details drawer
                      isExp && (0, k.jsxs)("div", {
                        className: "home-history-drawer animate-slide-down",
                        children: [
                          (0, k.jsxs)("div", {
                            className: "home-history-stats-row",
                            children: [
                              (0, k.jsxs)("div", { className: "history-stat-mini", children: [(0, k.jsx)("span", { children: "Progress" }), (0, k.jsxs)("strong", { children: [Math.round((sItem.countedCount / (sItem.itemCount || 1)) * 100), "%"] })] }),
                              (0, k.jsxs)("div", { className: "history-stat-mini", children: [(0, k.jsx)("span", { children: "Total Lines" }), (0, k.jsx)("strong", { children: sItem.itemCount })] }),
                              (0, k.jsxs)("div", { className: "history-stat-mini", children: [(0, k.jsx)("span", { children: "Counted" }), (0, k.jsx)("strong", { children: sItem.countedCount })] }),
                              (0, k.jsxs)("div", { className: "history-stat-mini", children: [(0, k.jsx)("span", { children: "Mismatches" }), (0, k.jsx)("strong", { style: { color: sItem.mismatchCount > 0 ? "var(--shortage-coral)" : "var(--accent-teal)" }, children: sItem.mismatchCount })] })
                            ]
                          }),
                          rec && Array.isArray(rec.responsiblePersons) && rec.responsiblePersons.length > 0 && (0, k.jsxs)("div", {
                            className: "home-history-team",
                            children: [(0, k.jsx)("span", { children: "Counted by: " }), (0, k.jsx)("strong", { children: rec.responsiblePersons.join(", ") })]
                          }),
                          (0, k.jsxs)("div", {
                            className: "home-history-actions-row",
                            children: [
                              (0, k.jsxs)("button", {
                                className: "btn btn-primary",
                                disabled: isBusyResuming,
                                onClick: () => handleResume(sItem.id),
                                children: [
                                  isBusyResuming ? (0, k.jsx)(ar, { size: 15, className: "spin" }) : (0, k.jsx)(Si, { size: 15 }),
                                  " Select & Continue This Session"
                                ]
                              }),
                              downFn && (0, k.jsxs)("button", {
                                className: "btn btn-secondary",
                                onClick: () => downFn(sItem.id),
                                children: [(0, k.jsx)(ks, { size: 14 }), " Download Excel Report"]
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  }, sItem.id);
                })
              })
            ]
          })
        ]
      });
    }`;

    content = content.substring(0, oldHdDef) + updatedHdFunction + content.substring(nextFnDef);
    console.log('  -> Replaced hD definition with interactive history continuation and details drawer');
  }

  // 3. Add comprehensive CSS fixes for Ledger Summary, Location rows, How-to steps, animations, and safe bottom padding
  const comprehensiveCss = `
<style id="comprehensive-v5-polish-styles">
  /* Fix bottom clearance so floating dock never covers content */
  #root, .root {
    padding-bottom: 110px !important;
  }

  /* Smooth animations */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); max-height: 0; }
    to { opacity: 1; transform: translateY(0); max-height: 800px; }
  }
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(27, 110, 95, 0.4); }
    70% { box-shadow: 0 0 0 8px rgba(27, 110, 95, 0); }
    100% { box-shadow: 0 0 0 0 rgba(27, 110, 95, 0); }
  }

  .animate-fade-in {
    animation: fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-slide-down {
    animation: slideDown 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* Badge styling */
  .badge-in-progress {
    background: #fef3c7 !important;
    color: #92400e !important;
    border: 1px solid #fde68a !important;
    animation: pulseGlow 2.5s infinite;
  }
  .badge-archived {
    background: #e2e8f0 !important;
    color: #475569 !important;
    border: 1px solid #cbd5e1 !important;
  }

  /* LEDGER SUMMARY FIX (Fixes "Total lines332" cramped display) */
  .ledger-card {
    background: var(--card) !important;
    border: 1px solid var(--line) !important;
    border-radius: 16px !important;
    padding: 20px !important;
    margin-bottom: 18px !important;
    box-shadow: 0 4px 16px rgba(14, 27, 38, 0.04) !important;
  }
  .summary-row {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 10px 14px !important;
    border-bottom: 1px solid var(--line-soft) !important;
    font-size: 14px !important;
    background: #ffffff !important;
    border-radius: 8px !important;
    margin-bottom: 6px !important;
  }
  .summary-row:last-child {
    border-bottom: none !important;
    margin-bottom: 0 !important;
  }
  .summary-label {
    color: var(--ink-soft) !important;
    font-weight: 500 !important;
  }
  .summary-value {
    font-family: var(--font-mono) !important;
    font-weight: 700 !important;
    font-size: 15px !important;
    color: var(--ink) !important;
  }
  .summary-teal { color: var(--accent-teal) !important; }
  .summary-soft { color: var(--ink-faint) !important; }
  .summary-excess { color: #0369a1 !important; }
  .summary-shortage { color: #c2410c !important; }

  /* LOCATION ROWS FIX (Fixes "Hold Location0/11" cramped display) */
  .location-card {
    background: var(--card) !important;
    border: 1px solid var(--line) !important;
    border-radius: 16px !important;
    padding: 20px !important;
    margin-bottom: 18px !important;
    box-shadow: 0 4px 16px rgba(14, 27, 38, 0.04) !important;
  }
  .loc-row {
    margin-bottom: 12px !important;
    padding: 12px 14px !important;
    background: var(--paper-2) !important;
    border-radius: 12px !important;
    border: 1px solid var(--line-soft) !important;
  }
  .loc-row:last-child {
    margin-bottom: 0 !important;
  }
  .loc-row-top {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    gap: 12px !important;
    margin-bottom: 8px !important;
  }
  .loc-name {
    font-weight: 600 !important;
    font-size: 13.5px !important;
    color: var(--ink) !important;
    overflow-wrap: anywhere !important;
  }
  .loc-frac {
    font-family: var(--font-mono) !important;
    font-weight: 700 !important;
    font-size: 12.5px !important;
    color: var(--accent-teal) !important;
    background: rgba(27, 110, 95, 0.08) !important;
    padding: 3px 8px !important;
    border-radius: 6px !important;
    flex-shrink: 0 !important;
  }
  .progress-track {
    width: 100% !important;
    height: 8px !important;
    background: #e2e8ec !important;
    border-radius: 999px !important;
    overflow: hidden !important;
  }
  .progress-fill {
    height: 100% !important;
    background: linear-gradient(90deg, #1b6e5f, #228b77) !important;
    border-radius: 999px !important;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  /* HOW TO SEARCH FIX */
  .how-to {
    display: grid !important;
    gap: 8px !important;
    margin-top: 12px !important;
    padding: 12px 14px !important;
    background: var(--paper-2) !important;
    border-radius: 10px !important;
    border: 1px solid var(--line-soft) !important;
  }
  .how-to-step {
    display: flex !important;
    align-items: baseline !important;
    gap: 10px !important;
    font-size: 13px !important;
    color: var(--ink-soft) !important;
    line-height: 1.4 !important;
  }
  .how-to-num {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 50% !important;
    background: var(--accent-teal) !important;
    color: #ffffff !important;
    font-family: var(--font-mono) !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    flex-shrink: 0 !important;
  }

  /* TABLE & EXPIRY CARDS MOBILE SCROLL FIX */
  .table-wrap, table {
    width: 100% !important;
  }
  .card table {
    display: block !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    white-space: nowrap !important;
  }

  /* HOME VIEW PAST SESSIONS CARD WITH CONTINUATION */
  .home-active-filename {
    font-size: 17px !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    margin-bottom: 4px !important;
    overflow-wrap: anywhere !important;
  }
  .home-history-list {
    display: grid !important;
    gap: 12px !important;
    margin-top: 14px !important;
  }
  .home-history-card {
    background: #ffffff !important;
    border: 1.5px solid var(--line-soft) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 2px 8px rgba(14, 27, 38, 0.03) !important;
  }
  .home-history-card:hover, .home-history-card.is-expanded {
    border-color: var(--accent-teal) !important;
    box-shadow: 0 6px 18px rgba(27, 110, 95, 0.1) !important;
  }
  .home-history-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 16px 18px !important;
    cursor: pointer !important;
    user-select: none !important;
    background: var(--paper-2) !important;
  }
  .home-history-title-block {
    min-width: 0 !important;
    flex: 1 !important;
  }
  .home-history-filename {
    font-size: 15px !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    overflow-wrap: anywhere !important;
    margin-bottom: 4px !important;
  }
  .home-history-subline {
    font-size: 12.5px !important;
    color: var(--ink-soft) !important;
    font-family: var(--font-mono) !important;
  }
  .home-history-header-actions {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-shrink: 0 !important;
  }
  .home-history-drawer {
    padding: 16px 18px !important;
    border-top: 1px solid var(--line-soft) !important;
    background: #ffffff !important;
  }
  .home-history-stats-row {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 10px !important;
    margin-bottom: 14px !important;
  }
  .history-stat-mini {
    background: var(--paper-2) !important;
    padding: 8px 10px !important;
    border-radius: 8px !important;
    border: 1px solid var(--line-soft) !important;
    text-align: center !important;
  }
  .history-stat-mini span {
    display: block !important;
    font-size: 11px !important;
    color: var(--ink-soft) !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
  }
  .history-stat-mini strong {
    font-family: var(--font-mono) !important;
    font-size: 14px !important;
    color: var(--ink) !important;
  }
  .home-history-team {
    font-size: 13px !important;
    color: var(--ink-soft) !important;
    margin-bottom: 14px !important;
    padding: 8px 12px !important;
    background: #f8fafb !important;
    border-radius: 8px !important;
  }
  .home-history-actions-row {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
  }
  .home-lock-btn {
    margin-left: auto !important;
    color: var(--ink-soft) !important;
    border: 1px solid var(--line) !important;
    border-radius: 9px !important;
    padding: 6px 12px !important;
  }

  @media (max-width: 640px) {
    .home-history-stats-row {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    .home-history-header {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 10px !important;
    }
    .home-history-header-actions {
      align-self: flex-start !important;
      width: 100% !important;
      justify-content: space-between !important;
    }
    .home-history-actions-row button {
      width: 100% !important;
    }
  }
</style>
`;

  if (content.includes('id="comprehensive-v5-polish-styles"')) {
    content = content.replace(/<style id="comprehensive-v5-polish-styles">[\s\S]*?<\/style>/, comprehensiveCss);
  } else {
    content = content.replace('</head>', comprehensiveCss + '</head>');
  }
  console.log('  -> Embedded comprehensive CSS polish styles');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Saved:', filePath);
}

updateSystemHtml('app/src/main/assets/Stock_Count_System_V5.html');
updateSystemHtml('Stock_Count_System_V5.html');
console.log('Update completed successfully!');
