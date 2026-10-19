const fs = require('fs');

let content = fs.readFileSync('app/src/main/assets/auth-sessions.js', 'utf8');

// Replace renderDashboard with direct app reveal and data reload on login
const regex1 = /if\s*\(\s*result\s*===\s*"OK"\s*\)\s*\{\s*renderDashboard\(\);\s*return;\s*\}/;
if (regex1.test(content)) {
  content = content.replace(regex1, `if (result === "OK") {
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
      }`);
  console.log('Successfully updated login handler in auth-sessions.js');
} else {
  console.log('Login handler already updated or regex did not match');
}

// Replace startup check:
const regex2 = /\}\s*else\s+if\s*\(\s*bridge\.isAuthenticated\(\)\s*\)\s*\{\s*renderDashboard\(\);/;
if (regex2.test(content)) {
  content = content.replace(regex2, `} else if (bridge.isAuthenticated()) {
    showApp();
    if (window.__reloadStockData) window.__reloadStockData();`);
  console.log('Successfully updated startup check in auth-sessions.js');
} else {
  console.log('Startup check already updated or regex did not match');
}

fs.writeFileSync('app/src/main/assets/auth-sessions.js', content, 'utf8');
console.log('Saved app/src/main/assets/auth-sessions.js');
