(function () {
  "use strict";

  var bridge = window.AndroidStockStorage;
  var prefix = "lina-stock-count::";
  var storage = Storage.prototype;
  var originalGet = storage.getItem;
  var originalSet = storage.setItem;
  var originalRemove = storage.removeItem;
  var originalKey = storage.key;
  var originalLength = Object.getOwnPropertyDescriptor(storage, "length").get;

  var gateStyle = document.createElement("style");
  gateStyle.textContent = "#root{visibility:hidden!important}#session-backup-tools{visibility:hidden!important}";
  document.head.appendChild(gateStyle);
  window.__linaGateStyle = gateStyle;

  function isAppKey(key) {
    return String(key).indexOf(prefix) === 0;
  }

  function appKeys() {
    if (!bridge || !bridge.isAuthenticated()) return [];
    try {
      return JSON.parse(bridge.keys());
    } catch (e) {
      return [];
    }
  }

  function legacyKeys(target) {
    var keys = [];
    for (var i = 0; i < originalLength.call(target); i++) {
      var key = originalKey.call(target, i);
      if (key !== null && !isAppKey(key)) keys.push(key);
    }
    return keys;
  }

  Object.defineProperty(storage, "length", {
    configurable: true,
    get: function () {
      if (this !== window.localStorage) return originalLength.call(this);
      return appKeys().length + legacyKeys(this).length;
    }
  });

  storage.key = function (index) {
    if (this !== window.localStorage) return originalKey.call(this, index);
    if (!Number.isInteger(index) || index < 0) return null;
    var keys = appKeys().concat(legacyKeys(this));
    return keys[index] === undefined ? null : keys[index];
  };

  storage.getItem = function (key) {
    if (this !== window.localStorage || !isAppKey(key)) return originalGet.call(this, key);
    // 1. Try bridge if authenticated
    if (bridge && bridge.isAuthenticated && bridge.isAuthenticated()) {
      try {
        var saved = bridge.getItem(String(key));
        if (saved !== null && saved !== undefined) {
          // Mirror to standard localStorage for extra redundancy
          originalSet.call(this, key, saved);
          return saved;
        }
      } catch (e) {}
    }
    // 2. Fall back to standard localStorage
    return originalGet.call(this, key);
  };

  storage.setItem = function (key, value) {
    // ALWAYS persist in standard localStorage
    originalSet.call(this, key, value);
    // AND persist in native SQLite database if bridge is active
    if (bridge && bridge.isAuthenticated && bridge.isAuthenticated()) {
      try {
        bridge.setItem(String(key), String(value));
      } catch (e) {}
    }
  };

  storage.removeItem = function (key) {
    originalRemove.call(this, key);
    if (bridge && bridge.isAuthenticated && bridge.isAuthenticated()) {
      try {
        bridge.removeItem(String(key));
      } catch (e) {}
    }
  };
})();
