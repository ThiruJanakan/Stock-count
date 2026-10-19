const fs = require('fs');

// 1. Update android-storage.js (Remove gateStyle completely)
const androidStorage = `(function () {
  "use strict";

  var bridge = window.AndroidStockStorage;
  var prefix = "lina-stock-count::";
  var storage = Storage.prototype;
  var originalGet = storage.getItem;
  var originalSet = storage.setItem;
  var originalRemove = storage.removeItem;
  var originalKey = storage.key;
  var originalLength = Object.getOwnPropertyDescriptor(storage, "length").get;

  function isAppKey(key) {
    return String(key).indexOf(prefix) === 0;
  }

  function appKeys() {
    if (!bridge) return [];
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
    if (bridge) {
      try {
        var saved = bridge.getItem(String(key));
        if (saved !== null && saved !== undefined) {
          originalSet.call(this, key, saved);
          return saved;
        }
      } catch (e) {}
    }
    return originalGet.call(this, key);
  };

  storage.setItem = function (key, value) {
    originalSet.call(this, key, value);
    if (bridge) {
      try {
        bridge.setItem(String(key), String(value));
      } catch (e) {}
    }
  };

  storage.removeItem = function (key) {
    originalRemove.call(this, key);
    if (bridge) {
      try {
        bridge.removeItem(String(key));
      } catch (e) {}
    }
  };
})();
`;

fs.writeFileSync('app/src/main/assets/android-storage.js', androidStorage, 'utf8');
console.log('1. Updated android-storage.js (No gate, direct access)');

// 2. Clear out auth-sessions.js so no login overlay is ever shown
const authSessions = `// Authentication removed - the application opens directly without login barriers.
(function () {
  "use strict";
  window.__linaGateStyle = null;
  window.LinaAuthSessions = null;
})();
`;

fs.writeFileSync('app/src/main/assets/auth-sessions.js', authSessions, 'utf8');
console.log('2. Cleared auth-sessions.js (No login screen)');

// 3. Update MainActivity.kt
let mainActivity = fs.readFileSync('app/src/main/java/com/linamanufacturing/stockcount/MainActivity.kt', 'utf8');

mainActivity = mainActivity.replace(
  '@Volatile private var isUnlocked = false',
  '@Volatile private var isUnlocked = true'
);

mainActivity = mainActivity.replace(
  'fun isAuthenticated(): Boolean = isUnlocked',
  'fun isAuthenticated(): Boolean = true'
);

mainActivity = mainActivity.replace(
  'require(isUnlocked) { "Sign in before accessing stock data" }',
  '// Unlocked by default'
);

mainActivity = mainActivity.replace(
  'require(isUnlocked) { "Sign in before restoring a session" }',
  '// Unlocked by default'
);

fs.writeFileSync('app/src/main/java/com/linamanufacturing/stockcount/MainActivity.kt', mainActivity, 'utf8');
console.log('3. Updated MainActivity.kt (isUnlocked = true by default, no auth check)');
