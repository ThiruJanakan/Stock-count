(function () {
  "use strict";

  var bridge = window.AndroidStockStorage;
  var tools = window.LinaSessionTools;
  var root = document.getElementById("root");
  var panelId = "session-backup-tools";
  var prefix = "lina-stock-count::";
  var historyKey = "history-index";
  var maxBackupBytes = 40 * 1024 * 1024;

  if (!bridge || !tools || !root) return;

  var gateStyle = window.__linaGateStyle;
  var currentOverlay = null;
  var activeExpanded = true;
  var expandedHistoryId = null;

  function appRead(key) {
    return tools.read(key);
  }

  function appWrite(key, value) {
    window.localStorage.setItem(prefix + key, JSON.stringify(value));
  }

  function appRemove(key) {
    window.localStorage.removeItem(prefix + key);
  }

  function safeText(value) {
    return value == null || value === "" ? "—" : String(value);
  }

  function dateText(value) {
    if (!value) return "Date not set";
    var date = new Date(value + (String(value).length === 10 ? "T00:00:00" : ""));
    return isNaN(date.getTime())
      ? "Date not set"
      : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function statusText(status) {
    return status === "completed" ? "Completed"
      : status === "in_progress" ? "In progress"
        : "Not started";
  }

  function countsSummary(session) {
    var counts = session && session.counts || {};
    return {
      counted: Object.keys(counts).length,
      total: 0,
      mismatches: Object.values(counts).filter(function (count) {
        return count && Number(count.variance) !== 0;
      }).length
    };
  }

  function statusElement(status) {
    var badge = document.createElement("span");
    badge.className = "auth-session-status status-" + (status || "not_started");
    badge.textContent = statusText(status);
    return badge;
  }

  function createButton(label, className, action) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className || "";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function hideRoot() {
    root.style.visibility = "hidden";
    var toolsPanel = document.getElementById(panelId);
    if (toolsPanel) toolsPanel.style.visibility = "hidden";
  }

  function showApp() {
    if (gateStyle) gateStyle.disabled = true;
    root.style.visibility = "visible";
    var toolsPanel = document.getElementById(panelId);
    if (toolsPanel) toolsPanel.style.visibility = "";
  }

  function removeOverlay() {
    if (currentOverlay) currentOverlay.remove();
    currentOverlay = null;
  }

  function createOverlay(className) {
    removeOverlay();
    var overlay = document.createElement("main");
    overlay.className = className;
    currentOverlay = overlay;
    document.body.appendChild(overlay);
    return overlay;
  }

  function addBrand(parent, subtitle) {
    var card = document.createElement("section");
    card.className = "auth-card";
    var brand = document.createElement("div");
    brand.className = "auth-brand";
    brand.textContent = "LINA MANUFACTURING · WAREHOUSE";
    var title = document.createElement("h1");
    title.textContent = "Stock Verification Ledger";
    var help = document.createElement("p");
    help.className = "auth-muted";
    help.textContent = subtitle;
    card.appendChild(brand);
    card.appendChild(title);
    card.appendChild(help);
    parent.appendChild(card);
    return card;
  }

  function showLogin(message) {
    hideRoot();
    if (gateStyle) gateStyle.disabled = false;
    var overlay = createOverlay("auth-screen");
    var card = addBrand(overlay, "Sign in to view and manage stock-count sessions.");
    var form = document.createElement("form");
    form.className = "auth-form";
    var usernameLabel = document.createElement("label");
    usernameLabel.textContent = "Username";
    var usernameInput = document.createElement("input");
    usernameInput.type = "text";
    usernameInput.autocomplete = "username";
    usernameInput.autocapitalize = "none";
    usernameInput.spellcheck = false;
    usernameInput.maxLength = 64;
    usernameInput.required = true;
    usernameLabel.appendChild(usernameInput);
    var passwordLabel = document.createElement("label");
    passwordLabel.textContent = "Password";
    var passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.autocomplete = "current-password";
    passwordInput.maxLength = 1024;
    passwordInput.required = true;
    passwordLabel.appendChild(passwordInput);
    var feedback = document.createElement("div");
    feedback.className = "auth-feedback";
    feedback.setAttribute("role", "alert");
    feedback.textContent = message || "";
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "auth-primary";
    submit.textContent = "Sign in";
    form.appendChild(usernameLabel);
    form.appendChild(passwordLabel);
    form.appendChild(feedback);
    form.appendChild(submit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submit.disabled = true;
      feedback.textContent = "";
      var result = bridge.authenticate(usernameInput.value.trim(), passwordInput.value);
      passwordInput.value = "";
      if (result === "OK") {
        renderDashboard();
        return;
      }
      submit.disabled = false;
      if (result.indexOf("LOCKED:") === 0) {
        feedback.textContent = "Too many attempts. Try again in " + result.slice(7) + " seconds.";
      } else if (result === "ERROR") {
        feedback.textContent = "Sign-in could not be checked. Please restart the app and try again.";
      } else {
        feedback.textContent = "Username or password is incorrect.";
      }
      passwordInput.focus();
    });
    card.appendChild(form);
    usernameInput.focus();
  }

  function addLockButton(parent) {
    parent.appendChild(createButton("Lock app", "auth-secondary auth-lock", function () {
      bridge.lock();
      window.sessionStorage.removeItem("lina-open-active");
      window.location.reload();
    }));
  }

  function readHistoryIndex() {
    var index = appRead(historyKey);
    if (!Array.isArray(index)) return [];
    return index.filter(function (entry) {
      return entry && typeof entry.id === "string" &&
        /^[A-Za-z0-9_-]{1,160}$/.test(entry.id);
    });
  }

  function readSessions() {
    var master = appRead("stock-master");
    var session = appRead("count-session");
    var active = master && Array.isArray(master.items) && session
      ? { id: "active", kind: "active", master: master, session: session }
      : null;
    var sourceId = session && session._dashboardHistoryId;
    var history = readHistoryIndex()
      .filter(function (entry) { return entry.id !== sourceId; })
      .map(function (entry) {
        var record = appRead("history-record-" + entry.id);
        if (!record || !Array.isArray(record.items)) return null;
        return { id: entry.id, kind: "history", meta: entry, record: record };
      })
      .filter(Boolean);

    history.sort(function (a, b) {
      var left = new Date(a.record.endDate || a.record.startDate || 0).getTime();
      var right = new Date(b.record.endDate || b.record.startDate || 0).getTime();
      return right - left;
    });
    return { active: active, history: history };
  }

  function sessionCard(session, expanded, onToggle, onContinue) {
    var isActive = session.kind === "active";
    var master = isActive ? session.master : {
      meta: { fileName: session.record.fileName },
      items: session.record.items
    };
    var record = isActive ? session.session : session.record;
    var summary = countsSummary(record);
    summary.total = master.items.length;

    var card = document.createElement("article");
    card.className = "auth-session-card";
    var heading = document.createElement("button");
    heading.type = "button";
    heading.className = "auth-session-heading";
    heading.setAttribute("aria-expanded", expanded ? "true" : "false");
    var titleBlock = document.createElement("span");
    titleBlock.className = "auth-session-title";
    var name = document.createElement("strong");
    name.textContent = safeText(
      master.meta && master.meta.fileName || record.fileName
    );
    var dates = document.createElement("span");
    dates.textContent = dateText(record.startDate) + " – " +
      (record.endDate ? dateText(record.endDate) : "ongoing") +
      " · " + summary.counted + "/" + summary.total + " counted";
    titleBlock.appendChild(name);
    titleBlock.appendChild(dates);
    heading.appendChild(titleBlock);
    heading.appendChild(statusElement(record.status));
    heading.addEventListener("click", onToggle);
    card.appendChild(heading);

    if (expanded) {
      var details = document.createElement("div");
      details.className = "auth-session-details";
      var statLine = document.createElement("p");
      statLine.textContent = "Items: " + summary.total + " · Counted: " +
        summary.counted + " · Mismatches: " + summary.mismatches;
      details.appendChild(statLine);
      var people = record.responsiblePersons;
      var team = document.createElement("p");
      team.textContent = "Counted by: " +
        (Array.isArray(people) && people.length ? people.join(", ") : "Not specified");
      details.appendChild(team);
      var items = document.createElement("div");
      items.className = "auth-session-items";
      var listTitle = document.createElement("strong");
      listTitle.textContent = "Items in this session";
      items.appendChild(listTitle);
      var counts = record.counts || {};
      master.items.slice(0, MAX_DETAIL_ROWS).forEach(function (item) {
        var count = counts[item.key];
        var row = document.createElement("div");
        row.className = "auth-item-row";
        var label = document.createElement("span");
        label.textContent = [item.itemCode, item.itemName, item.batch && "Batch " + item.batch]
          .filter(Boolean).join(" · ");
        var quantities = document.createElement("span");
        quantities.textContent = count
          ? "System " + safeText(item.systemQty) + " · Count " +
            safeText(count.physicalQty) + " · Variance " + safeText(count.variance)
          : "Pending · System " + safeText(item.systemQty);
        row.appendChild(label);
        row.appendChild(quantities);
        items.appendChild(row);
      });
      if (master.items.length > MAX_DETAIL_ROWS) {
        var remaining = document.createElement("p");
        remaining.textContent = "Showing the first " + MAX_DETAIL_ROWS +
          " of " + master.items.length + " items. Open the session to view the full ledger.";
        items.appendChild(remaining);
      }
      details.appendChild(items);
      var action = createButton(
        isActive ? "Continue current session" : "Continue this past session",
        "auth-primary auth-continue",
        onContinue
      );
      details.appendChild(action);
      card.appendChild(details);
    }
    return card;
  }

  function archiveCurrent(snapshot) {
    if (!snapshot || (!snapshot.master && !snapshot.session)) return null;
    if (!snapshot.master || !snapshot.session ||
        !Array.isArray(snapshot.master.items)) {
      throw new Error("The current session is incomplete and cannot be saved safely.");
    }
    var session = snapshot.session;
    var now = new Date().toISOString();
    var id = typeof session._dashboardHistoryId === "string" &&
      /^[A-Za-z0-9_-]{1,160}$/.test(session._dashboardHistoryId)
      ? session._dashboardHistoryId
      : "hist-" + Date.now().toString(36) + "-" +
        Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map(function (byte) { return byte.toString(16).padStart(2, "0"); })
          .join("");
    var record = {
      id: id,
      fileName: snapshot.master.meta && snapshot.master.meta.fileName || "Stock session",
      uploadedAt: snapshot.master.meta && snapshot.master.meta.uploadedAt || now,
      startDate: session.startDate || null,
      endDate: session.endDate || null,
      status: session.status || "not_started",
      responsiblePersons: Array.isArray(session.responsiblePersons) ? session.responsiblePersons : [],
      items: snapshot.master.items,
      counts: session.counts && typeof session.counts === "object" ? session.counts : {}
    };
    appWrite("history-record-" + id, record);
    var countSummary = countsSummary(record);
    var index = [{
      id: id,
      fileName: record.fileName,
      startDate: record.startDate,
      endDate: record.endDate,
      status: record.status,
      itemCount: record.items.length,
      countedCount: countSummary.counted,
      mismatchCount: countSummary.mismatches
    }].concat(readHistoryIndex().filter(function (entry) {
      return entry.id !== id;
    })).slice(0, 50);
    appWrite(historyKey, index);
    return id;
  }

  function saveActiveAndOpen(session, master, sourceHistoryId) {
    archiveCurrent({
      master: appRead("stock-master"),
      session: appRead("count-session")
    });
    var resumed = JSON.parse(JSON.stringify(session));
    resumed._dashboardHistoryId = sourceHistoryId ||
      session._dashboardHistoryId || null;
    if (resumed.status === "completed") {
      resumed.status = "in_progress";
      resumed.endDate = null;
    }
    appWrite("stock-master", master);
    appWrite("count-session", resumed);
    window.sessionStorage.setItem("lina-open-active", "1");
    window.location.reload();
  }

  async function beginNewExcelSession() {
    if (!window.confirm(
      "Start a new stock count? The current session will be saved in History first."
    )) return;
    try {
      archiveCurrent({ master: appRead("stock-master"), session: appRead("count-session") });
      appRemove("stock-master");
      appRemove("count-session");
      window.sessionStorage.setItem("lina-open-active", "1");
      window.location.reload();
    } catch (error) {
      window.alert(error.message || "Could not save the current session before starting a new one.");
    }
  }

  function openExcelPicker() {
    var input = root.querySelector('input[type="file"][accept*=".xlsx"]');
    if (!input) {
      window.alert("The stock-sheet upload is not ready. Please try again.");
      return;
    }
    input.click();
  }

  function addNewSessionActions(parent) {
    var section = document.createElement("section");
    section.className = "auth-new-session";
    var title = document.createElement("h2");
    title.textContent = "Start a new session";
    var description = document.createElement("p");
    description.textContent = "Upload this month's stock sheet, or import a colleague's session backup to continue their count.";
    var actions = document.createElement("div");
    actions.className = "auth-actions";
    actions.appendChild(createButton("Upload Excel stock sheet", "auth-primary", beginNewExcelSession));
    actions.appendChild(createButton("Import session backup", "auth-secondary", function () {
      backupInput.click();
    }));
    section.appendChild(title);
    section.appendChild(description);
    section.appendChild(actions);
    parent.appendChild(section);
  }

  async function readBackup(file) {
    if (!file || file.size > maxBackupBytes) {
      throw new Error("Choose a backup file smaller than 40 MB.");
    }
    var text = await file.text();
    var wrapper = JSON.parse(text);
    if (wrapper && wrapper.format === "lina-stock-count-encrypted-backup") {
      var password = await tools.passwordDialog(false);
      if (!password) return null;
      try {
        text = await tools.decryptBackup(wrapper, password.password);
      } finally {
        password.password = "";
      }
    }
    if (new Blob([text]).size > maxBackupBytes) throw new Error("The backup is larger than 40 MB.");
    var backup = JSON.parse(text);
    tools.validateBackup(backup);
    return backup;
  }

  var backupInput = document.createElement("input");
  backupInput.type = "file";
  backupInput.accept = ".json,application/json";
  backupInput.hidden = true;
  backupInput.addEventListener("change", async function () {
    var file = backupInput.files && backupInput.files[0];
    if (!file) return;
    try {
      var backup = await readBackup(file);
      if (!backup) return;
      if (!window.confirm(
        "Import this backup as the current session? The existing session will first be saved in History."
      )) return;
      var oldMaster = appRead("stock-master");
      var oldSession = appRead("count-session");
      archiveCurrent({ master: oldMaster, session: oldSession });
      var importedSession = JSON.parse(JSON.stringify(backup.session));
      delete importedSession._dashboardHistoryId;
      if (!bridge.importSession(JSON.stringify(backup.master), JSON.stringify(importedSession))) {
        throw new Error("The backup could not be saved to this device.");
      }
      window.sessionStorage.setItem("lina-open-active", "1");
      window.location.reload();
    } catch (error) {
      window.alert(error.name === "OperationError"
        ? "Could not decrypt the backup. Check its password and try again."
        : (error.message || "The backup could not be imported."));
    } finally {
      backupInput.value = "";
    }
  });
  document.body.appendChild(backupInput);

  function renderDashboard() {
    if (!bridge.isAuthenticated()) {
      showLogin();
      return;
    }
    hideRoot();
    var overlay = createOverlay("auth-dashboard-screen");
    var sessions;
    try {
      sessions = readSessions();
    } catch (error) {
      showLogin("Could not load local sessions: " + (error.message || "unknown error"));
      return;
    }

    var header = document.createElement("header");
    header.className = "auth-dashboard-header";
    var brand = document.createElement("div");
    brand.className = "auth-brand";
    brand.textContent = "LINA MANUFACTURING · WAREHOUSE";
    var title = document.createElement("h1");
    title.textContent = "Stock count sessions";
    var subtitle = document.createElement("p");
    subtitle.textContent = "Choose a session to continue, or start a new count.";
    header.appendChild(brand);
    header.appendChild(title);
    header.appendChild(subtitle);
    addLockButton(header);
    overlay.appendChild(header);

    addNewSessionActions(overlay);

    var currentSection = document.createElement("section");
    currentSection.className = "auth-session-section";
    var currentTitle = document.createElement("h2");
    currentTitle.textContent = "Current session";
    currentSection.appendChild(currentTitle);
    if (sessions.active) {
      var activeCard = sessionCard(sessions.active, activeExpanded, function () {
        activeExpanded = !activeExpanded;
        renderDashboard();
      }, continueCurrent);
      currentSection.appendChild(activeCard);
    } else {
      var empty = document.createElement("p");
      empty.className = "auth-empty";
      empty.textContent = "No active session. Start a new count or import a backup above.";
      currentSection.appendChild(empty);
    }
    overlay.appendChild(currentSection);

    var historySection = document.createElement("section");
    historySection.className = "auth-session-section";
    var historyTitle = document.createElement("h2");
    historyTitle.textContent = "Past sessions (" + sessions.history.length + ")";
    historySection.appendChild(historyTitle);
    if (sessions.history.length) {
      sessions.history.forEach(function (item) {
        var card = sessionCard(item, expandedHistoryId === item.id, function () {
          expandedHistoryId = expandedHistoryId === item.id ? null : item.id;
          renderDashboard();
        }, function () {
          try {
            saveActiveAndOpen(item.record, {
              meta: {
                fileName: item.record.fileName,
                uploadedAt: item.record.uploadedAt,
                totalItems: item.record.items.length
              },
              items: item.record.items
            }, item.id);
          } catch (error) {
            window.alert(error.message || "Could not continue this session.");
          }
        });
        historySection.appendChild(card);
      });
    } else {
      var noHistory = document.createElement("p");
      noHistory.className = "auth-empty";
      noHistory.textContent = "Completed and saved sessions will appear here.";
      historySection.appendChild(noHistory);
    }
    overlay.appendChild(historySection);
    addLockButton(overlay);
  }

  function continueCurrent() {
    var master = appRead("stock-master");
    var session = appRead("count-session");
    if (!master || !session) {
      window.alert("There is no active session to continue.");
      return;
    }
    try {
      if (session.status === "completed") {
        session.status = "in_progress";
        session.endDate = null;
        appWrite("count-session", session);
      }
      window.sessionStorage.setItem("lina-open-active", "1");
      window.location.reload();
    } catch (error) {
      window.alert(error.message || "Could not open the current session.");
    }
  }

  var style = document.createElement("style");
  style.textContent = [
    ".auth-screen,.auth-dashboard-screen{box-sizing:border-box;position:fixed;inset:0;z-index:10000;overflow:auto;padding:20px;background:#e9eef0;color:#16283a;font:15px system-ui,-apple-system,'Segoe UI',sans-serif}",
    ".auth-screen{display:grid;place-items:center}",
    ".auth-card{box-sizing:border-box;width:min(100%,500px);padding:28px;border:1px solid #d4dde1;border-top:5px solid #1f6f63;border-radius:18px;background:#fff;box-shadow:0 12px 36px #16283a20}",
    ".auth-brand{color:#1f6f63;font:600 12px ui-monospace,monospace;letter-spacing:.14em}",
    ".auth-card h1,.auth-dashboard-header h1{margin:10px 0;font-size:clamp(23px,5vw,30px);letter-spacing:-.035em}",
    ".auth-muted,.auth-dashboard-header p,.auth-new-session p{color:#5e6e7c;line-height:1.5}",
    ".auth-form{display:grid;gap:14px;margin-top:22px}",
    ".auth-form label,.session-password-dialog label{display:grid;gap:7px;font-weight:600}",
    ".auth-form input{box-sizing:border-box;width:100%;min-height:48px;padding:10px 12px;border:1px solid #bac6cd;border-radius:9px;font:inherit}",
    ".auth-primary,.auth-secondary{box-sizing:border-box;min-height:46px;padding:10px 15px;border:0;border-radius:10px;font:600 14px system-ui,sans-serif;cursor:pointer}",
    ".auth-primary{background:#1f6f63;color:#fff}",
    ".auth-primary:disabled{opacity:.65}",
    ".auth-secondary{border:1px solid #cbd4d9;background:#fff;color:#16283a}",
    ".auth-feedback{min-height:20px;color:#b5432e;font-size:14px}",
    ".auth-dashboard-screen{padding:18px max(14px,calc((100vw - 860px)/2));padding-bottom:40px}",
    ".auth-dashboard-header{position:relative;padding:22px 20px 18px;border-radius:16px;background:#fff;box-shadow:0 4px 18px #16283a12}",
    ".auth-dashboard-header p{margin:4px 0 0}",
    ".auth-lock{position:absolute;top:17px;right:16px;min-height:38px;padding:8px 12px}",
    ".auth-new-session,.auth-session-section{margin-top:16px;padding:18px;border:1px solid #d4dde1;border-radius:15px;background:#fff;box-shadow:0 4px 16px #16283a0b}",
    ".auth-new-session h2,.auth-session-section h2{margin:0 0 8px;font-size:18px}",
    ".auth-new-session p{margin:0 0 14px}",
    ".auth-actions{display:flex;flex-wrap:wrap;gap:9px}",
    ".auth-session-card{margin-top:10px;border:1px solid #d6dfe3;border-radius:12px;overflow:hidden}",
    ".auth-session-heading{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:13px;text-align:left;border:0;background:#f9fbfb;color:#16283a;font:inherit;cursor:pointer}",
    ".auth-session-title{display:grid;gap:5px;min-width:0}",
    ".auth-session-title strong{overflow-wrap:anywhere}",
    ".auth-session-title span{color:#5e6e7c;font-size:13px}",
    ".auth-session-status{flex:none;padding:5px 9px;border-radius:999px;background:#e4eaed;color:#53636e;font-size:12px;font-weight:600}",
    ".auth-session-status.status-in_progress{background:#fff0d7;color:#8a5a12}",
    ".auth-session-status.status-completed{background:#dceee4;color:#1f6f63}",
    ".auth-session-details{padding:13px;border-top:1px solid #e0e6e9}",
    ".auth-session-details p{margin:0 0 8px;color:#5e6e7c;font-size:13px}",
    ".auth-session-items{display:grid;gap:8px;margin:12px 0;max-height:360px;overflow:auto}",
    ".auth-session-items>strong{font-size:14px}",
    ".auth-item-row{display:grid;gap:3px;padding:8px;border-radius:8px;background:#f1f5f6;font-size:12px;overflow-wrap:anywhere}",
    ".auth-item-row span+span{color:#5e6e7c}",
    ".auth-continue{width:100%;margin-top:8px}",
    ".auth-empty{margin:8px 0;color:#72818b;font-size:14px}",
    "@media(max-width:480px){.auth-screen,.auth-dashboard-screen{padding:12px}.auth-card{padding:22px}.auth-dashboard-screen{padding-bottom:24px}.auth-session-heading{align-items:flex-start}.auth-session-status{max-width:96px;text-align:center}.auth-actions>*{flex:1 1 100%}}"
  ].join("");
  document.head.appendChild(style);

  if (bridge.isAuthenticated() && window.sessionStorage.getItem("lina-open-active") === "1") {
    window.sessionStorage.removeItem("lina-open-active");
    showApp();
  } else if (bridge.isAuthenticated()) {
    renderDashboard();
  } else {
    showLogin();
  }
})();
