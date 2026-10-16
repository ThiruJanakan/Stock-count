(function () {
  "use strict";

  var bridge = window.AndroidStockStorage;
  if (!bridge) return;

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
    if (!bridge.isAuthenticated()) return [];
    return JSON.parse(bridge.keys());
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
    if (!bridge.isAuthenticated()) return null;
    var saved = bridge.getItem(String(key));
    if (saved !== null) return saved;

    var legacy = originalGet.call(this, key);
    if (legacy !== null) {
      if (!bridge.setItem(String(key), legacy)) throw new Error("Could not migrate local stock data");
      originalRemove.call(this, key);
    }
    return legacy;
  };

  storage.setItem = function (key, value) {
    if (this !== window.localStorage || !isAppKey(key)) return originalSet.call(this, key, value);
    if (!bridge.isAuthenticated()) throw new Error("Sign in before changing stock data");
    if (!bridge.setItem(String(key), String(value))) throw new Error("Could not save local stock data");
  };

  storage.removeItem = function (key) {
    if (this !== window.localStorage || !isAppKey(key)) return originalRemove.call(this, key);
    if (!bridge.isAuthenticated()) throw new Error("Sign in before changing stock data");
    if (!bridge.removeItem(String(key))) throw new Error("Could not remove local stock data");
    originalRemove.call(this, key);
  };
})();
