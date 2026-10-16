(function () {
  "use strict";

  var bridge = window.AndroidStockStorage;
  var root = document.getElementById("root");
  var encryptedFormat = "lina-stock-count-encrypted-backup";
  var kdfIterations = 310000;
  var maxBackupBytes = 40 * 1024 * 1024;

  function read(key) {
    var value = window.localStorage.getItem("lina-stock-count::" + key);
    return value ? JSON.parse(value) : null;
  }

  function encodeBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function decodeBase64(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(password, salt) {
    var material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: kdfIterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptBackup(plainText, password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(password, salt);
    var cipherText = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, additionalData: new TextEncoder().encode(encryptedFormat) },
      key,
      new TextEncoder().encode(plainText)
    );
    return JSON.stringify({
      format: encryptedFormat,
      version: 1,
      cipher: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations: kdfIterations,
      salt: encodeBase64(salt),
      iv: encodeBase64(iv),
      ciphertext: encodeBase64(new Uint8Array(cipherText))
    }, null, 2);
  }

  async function decryptBackup(wrapper, password) {
    if (wrapper.version !== 1 || wrapper.cipher !== "AES-256-GCM" ||
        wrapper.kdf !== "PBKDF2-SHA-256" || wrapper.iterations !== kdfIterations) {
      throw new Error("This encrypted backup uses an unsupported format.");
    }
    var salt = decodeBase64(wrapper.salt);
    var iv = decodeBase64(wrapper.iv);
    var ciphertext = decodeBase64(wrapper.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length > maxBackupBytes) {
      throw new Error("This encrypted backup is malformed.");
    }
    var key = await deriveKey(password, salt);
    var plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        additionalData: new TextEncoder().encode(encryptedFormat)
      },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plain);
  }

  function download(name, content, mimeType) {
    if (bridge) {
      var bytes = new TextEncoder().encode(content);
      var binary = "";
      for (var i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      if (!bridge.saveFile(name, mimeType, btoa(binary))) {
        throw new Error("Android could not save the backup.");
      }
      window.alert("Backup saved in Downloads/Lina Stock Count.");
      return;
    }

    var url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (bridge) {
    var createObjectURL = URL.createObjectURL.bind(URL);
    var revokeObjectURL = URL.revokeObjectURL.bind(URL);
    var downloadBlobs = new Map();
    var pendingRevokes = new Set();
    var activeDownloads = new Set();

    URL.createObjectURL = function (blob) {
      var url = createObjectURL(blob);
      if (blob instanceof Blob) downloadBlobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = function (url) {
      if (activeDownloads.has(url)) {
        pendingRevokes.add(url);
        return;
      }
      downloadBlobs.delete(url);
      revokeObjectURL(url);
    };

    document.addEventListener("click", function (event) {
      var anchor = event.target && event.target.closest && event.target.closest("a[download]");
      if (!anchor || !downloadBlobs.has(anchor.href)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      var url = anchor.href;
      var blob = downloadBlobs.get(url);
      activeDownloads.add(url);
      if (blob.size > maxBackupBytes) {
        activeDownloads.delete(url);
        window.alert("This exported file exceeds the 40 MB limit.");
        return;
      }
      blob.arrayBuffer().then(function (buffer) {
        var bytes = new Uint8Array(buffer);
        var binary = "";
        for (var i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        if (!bridge.saveFile(anchor.download, blob.type || "application/octet-stream", btoa(binary))) {
          throw new Error("Android could not save the exported file.");
        }
        window.alert("File saved in Downloads/Lina Stock Count.");
      }).catch(function (error) {
        window.alert(error.message || "The exported file could not be saved.");
      }).finally(function () {
        activeDownloads.delete(url);
        if (pendingRevokes.has(url)) {
          pendingRevokes.delete(url);
          downloadBlobs.delete(url);
          revokeObjectURL(url);
        }
      });
    }, true);
  }

  function button(text, action) {
    var element = document.createElement("button");
    element.type = "button";
    element.textContent = text;
    element.addEventListener("click", action);
    return element;
  }

  function passwordDialog(confirmPassword) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "session-password-overlay";
      var dialog = document.createElement("section");
      dialog.className = "session-password-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      var heading = document.createElement("h2");
      heading.textContent = confirmPassword ? "Protect session backup" : "Unlock session backup";
      var description = document.createElement("p");
      description.textContent = confirmPassword
        ? "Use a password with at least 12 characters. You will need it to restore this file."
        : "Enter the password used when this backup was created.";
      var form = document.createElement("form");
      var passwordLabel = document.createElement("label");
      passwordLabel.textContent = confirmPassword ? "Backup password" : "Password";
      var passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.autocomplete = confirmPassword ? "new-password" : "current-password";
      passwordInput.required = true;
      passwordInput.maxLength = 1024;
      passwordLabel.appendChild(passwordInput);
      form.appendChild(passwordLabel);

      var confirmationInput = null;
      if (confirmPassword) {
        var confirmationLabel = document.createElement("label");
        confirmationLabel.textContent = "Confirm password";
        confirmationInput = document.createElement("input");
        confirmationInput.type = "password";
        confirmationInput.autocomplete = "new-password";
        confirmationInput.required = true;
        confirmationInput.maxLength = 1024;
        confirmationLabel.appendChild(confirmationInput);
        form.appendChild(confirmationLabel);
      }

      var error = document.createElement("div");
      error.className = "session-password-error";
      error.setAttribute("role", "alert");
      var actions = document.createElement("div");
      actions.className = "session-password-actions";
      var cancel = button("Cancel", function () { finish(null); });
      var submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = confirmPassword ? "Encrypt backup" : "Unlock backup";
      actions.appendChild(cancel);
      actions.appendChild(submit);
      form.appendChild(error);
      form.appendChild(actions);
      dialog.appendChild(heading);
      dialog.appendChild(description);
      dialog.appendChild(form);
      overlay.appendChild(dialog);

      function finish(result) {
        passwordInput.value = "";
        if (confirmationInput) confirmationInput.value = "";
        overlay.remove();
        resolve(result);
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (passwordInput.value.length < 12 || passwordInput.value.length > 1024) {
          error.textContent = "Use a password between 12 and 1,024 characters.";
          passwordInput.focus();
          return;
        }
        if (confirmationInput && passwordInput.value !== confirmationInput.value) {
          error.textContent = "The passwords do not match.";
          confirmationInput.focus();
          return;
        }
        finish({ password: passwordInput.value });
      });
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) finish(null);
      });
      document.body.appendChild(overlay);
      passwordInput.focus();
    });
  }

  async function exportSession() {
    try {
      var master = read("stock-master");
      var session = read("count-session");
      if (!master || !Array.isArray(master.items) || !session) {
        window.alert("There is no active stock-count session to back up.");
        return;
      }

      var plain = JSON.stringify({
        exportedAt: new Date().toISOString(),
        master: master,
        session: session
      }, null, 2);
      if (new Blob([plain]).size > maxBackupBytes) throw new Error("This backup is too large to export.");

      var encrypted = window.confirm(
        "Protect this backup with a password? Choose Cancel to continue without encryption."
      );
      var content = plain;
      var suffix = "_plain";
      if (encrypted) {
        var password = await passwordDialog(true);
        if (!password) return;
        try {
          content = await encryptBackup(plain, password.password);
        } finally {
          password.password = "";
        }
        suffix = "_encrypted";
      } else if (!window.confirm(
        "This JSON file will not be password-protected. Anyone with the file can read it. Save an unencrypted backup?"
      )) {
        return;
      }
      download("stock-count-backup_" + new Date().toISOString().slice(0, 10) + suffix + ".json", content, "application/json");
    } catch (error) {
      window.alert(error.message || "The backup could not be created.");
    }
  }

  function restoreControl() {
    restoreInput.click();
  }

  function installControls() {
    if (!root || !root.isConnected || document.getElementById("session-backup-tools")) return;
    var panel = document.createElement("aside");
    panel.id = "session-backup-tools";
    panel.setAttribute("aria-label", "Session backup and restore");
    panel.appendChild(button("Download session JSON", exportSession));
    panel.appendChild(button("Restore JSON", restoreControl));
    document.body.appendChild(panel);
  }

  function validBackup(backup) {
    if (!backup || !backup.master || !Array.isArray(backup.master.items) ||
        !backup.session || typeof backup.session !== "object" || Array.isArray(backup.session)) {
      throw new Error("This file is not a stock-count session backup.");
    }
    if (backup.master.items.length > 200000) throw new Error("The backup contains too many stock items.");
    var itemKeys = new Set();
    backup.master.items.forEach(function (item) {
      if (!item || typeof item !== "object" || typeof item.key !== "string" || !item.key) {
        throw new Error("The backup contains an invalid stock item.");
      }
      if (itemKeys.has(item.key)) throw new Error("The backup contains duplicate stock item keys.");
      itemKeys.add(item.key);
    });
    if (backup.session.counts == null) backup.session.counts = {};
    if (typeof backup.session.counts !== "object" || Array.isArray(backup.session.counts)) {
      throw new Error("The backup contains invalid count data.");
    }
    if (Object.keys(backup.session.counts).length > 200000) {
      throw new Error("The backup contains too many count records.");
    }
  }

  window.LinaSessionTools = {
    read: read,
    passwordDialog: passwordDialog,
    decryptBackup: decryptBackup,
    validateBackup: validBackup
  };

  var restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = ".json,application/json";
  restoreInput.hidden = true;
  restoreInput.addEventListener("change", async function () {
    var file = restoreInput.files && restoreInput.files[0];
    if (!file) return;
    try {
      if (file.size > maxBackupBytes) throw new Error("The selected backup exceeds the 40 MB limit.");
      var text = await file.text();
      var wrapper = JSON.parse(text);
      if (wrapper && wrapper.format === encryptedFormat) {
        var password = await passwordDialog(false);
        if (!password) return;
        try {
          text = await decryptBackup(wrapper, password.password);
        } finally {
          password.password = "";
        }
      }
      if (new Blob([text]).size > maxBackupBytes) throw new Error("The restored backup is too large.");
      var backup = JSON.parse(text);
      validBackup(backup);
      if (!window.confirm(
        "Restore this session and replace all stock-count data and history on this device? This cannot be undone."
      )) return;
      if (bridge) {
        if (!bridge.replaceAll(JSON.stringify(backup.master), JSON.stringify(backup.session))) {
          throw new Error("Android could not restore the backup.");
        }
      } else {
        window.localStorage.setItem("lina-stock-count::stock-master", JSON.stringify(backup.master));
        window.localStorage.setItem("lina-stock-count::count-session", JSON.stringify(backup.session));
      }
      window.location.reload();
    } catch (error) {
      window.alert(error.name === "OperationError"
        ? "Could not decrypt the backup. Check the password and try again."
        : (error.message || "The backup could not be restored."));
    } finally {
      restoreInput.value = "";
    }
  });
  document.body.appendChild(restoreInput);

  var style = document.createElement("style");
  style.textContent = [
    "#session-backup-tools{position:fixed;z-index:9999;right:12px;bottom:12px;display:flex;gap:8px;padding:8px;border:1px solid #c9d3d9;border-radius:14px;background:#fff;box-shadow:0 4px 18px #16283a26}",
    "#session-backup-tools button{min-height:42px;padding:8px 12px;border:0;border-radius:9px;background:#16283a;color:#fff;font:600 13px system-ui,sans-serif}",
    "#session-backup-tools button:focus-visible{outline:3px solid #2a6f97;outline-offset:2px}",
    ".session-password-overlay{position:fixed;inset:0;z-index:10001;display:grid;place-items:center;padding:16px;background:#101c2acc}",
    ".session-password-dialog{box-sizing:border-box;width:min(100%,420px);padding:22px;border-radius:16px;background:#fff;color:#16283a;font:15px system-ui,sans-serif;box-shadow:0 14px 48px #0005}",
    ".session-password-dialog h2{margin:0 0 8px;font-size:20px}",
    ".session-password-dialog p{margin:0 0 18px;color:#5e6e7c;line-height:1.45}",
    ".session-password-dialog label{display:block;margin:12px 0 6px;font-weight:600}",
    ".session-password-dialog input{box-sizing:border-box;width:100%;min-height:44px;margin-top:6px;padding:10px;border:1px solid #aebbc3;border-radius:8px;font:inherit}",
    ".session-password-error{min-height:20px;margin:6px 0;color:#b5432e;font-size:13px}",
    ".session-password-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}",
    ".session-password-actions button{min-height:42px;padding:8px 14px;border:0;border-radius:9px;background:#16283a;color:#fff;font:600 14px system-ui,sans-serif}",
    ".session-password-actions button:first-child{background:#e4eaed;color:#16283a}",
    "@media(max-width:420px){#session-backup-tools{left:10px;right:10px;bottom:10px}#session-backup-tools button{flex:1;padding:8px 5px;font-size:12px}}",
    "body{padding-bottom:72px!important}"
  ].join("");
  document.head.appendChild(style);

  var observer = new MutationObserver(installControls);
  observer.observe(root || document.body, { childList: true, subtree: true });
  installControls();
})();
