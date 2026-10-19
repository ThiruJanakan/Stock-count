const fs = require('fs');

const path = 'app/src/main/assets/auth-sessions.js';
let content = fs.readFileSync(path, 'utf8');

// Update showApp function to remove overlays
const oldShowApp = `  function showApp() {
    if (gateStyle) gateStyle.disabled = true;
    root.style.visibility = "visible";
    var toolsPanel = document.getElementById(panelId);
    if (toolsPanel) toolsPanel.style.visibility = "";
  }`;

const newShowApp = `  function showApp() {
    removeOverlay();
    document.querySelectorAll(".auth-screen, .auth-dashboard-screen").forEach(function (el) {
      el.remove();
    });
    if (gateStyle) gateStyle.disabled = true;
    root.style.visibility = "visible";
    var toolsPanel = document.getElementById(panelId);
    if (toolsPanel) toolsPanel.style.visibility = "";
  }`;

content = content.replace(oldShowApp, newShowApp);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated showApp() in auth-sessions.js to properly remove login overlay');
