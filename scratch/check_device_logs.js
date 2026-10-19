const child = require('child_process');
const adb = 'C:\\Users\\Janagan\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';

const raw = child.execSync(`"${adb}" logcat -d -t 600`).toString();
const lines = raw.split('\n');

const matched = lines.filter(l => 
  l.includes('9204') || 
  l.includes('chromium') || 
  l.includes('stockcount') || 
  l.includes('StockBridge') || 
  l.includes('AndroidStockStorage') ||
  l.includes('auth-sessions') ||
  l.includes('Console')
);

console.log('Total lines matched:', matched.length);
console.log(matched.slice(-60).join('\n'));
