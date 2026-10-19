const fs = require('fs');

const path = 'app/src/main/assets/auth-sessions.js';
let content = fs.readFileSync(path, 'utf8');

// Update username & password inputs
content = content.replace(
  'usernameInput.required = true;\n    usernameLabel.appendChild(usernameInput);',
  'usernameInput.required = true;\n    usernameInput.value = "Lina_Warehouse";\n    usernameInput.placeholder = "Lina_Warehouse";\n    usernameLabel.appendChild(usernameInput);'
);

content = content.replace(
  'passwordInput.required = true;\n    var passwordWrapper',
  'passwordInput.required = true;\n    passwordInput.placeholder = "Enter password (Lina12345678)";\n    var passwordWrapper'
);

// Add hint to form
content = content.replace(
  'form.appendChild(submit);',
  `form.appendChild(submit);
    var loginHint = document.createElement("div");
    loginHint.className = "auth-login-hint";
    loginHint.innerHTML = 'Credentials: <strong>Lina_Warehouse</strong> &nbsp;·&nbsp; Password: <strong>Lina12345678</strong>';
    form.appendChild(loginHint);`
);

// Add style for auth-login-hint
if (!content.includes('.auth-login-hint{')) {
  content = content.replace(
    '".auth-brand-logo{',
    '".auth-login-hint{margin-top:14px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:12.5px;color:#166534;text-align:center;line-height:1.4}",\n    ".auth-brand-logo{'
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Updated app/src/main/assets/auth-sessions.js with login defaults and hints');
