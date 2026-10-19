const fs = require('fs');

['app/src/main/assets/Stock_Count_System_V5.html', 'Stock_Count_System_V5.html'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  console.log('File:', f);
  console.log('  has hD definition:', c.includes('function hD('));
  console.log('  has Home tab active check:', c.includes('active:l==="home"'));
  console.log('  has hD render:', c.includes('l==="home"&&(0,k.jsx)(hD'));
  console.log('  has upload logo:', c.includes('upload-brand-logo'));
  console.log('  has header logo:', c.includes('lina-logo.png'));
  console.log('  has CSS:', c.includes('id="home-view-and-logo-styles"'));
});

const auth = fs.readFileSync('app/src/main/assets/auth-sessions.js', 'utf8');
console.log('auth-sessions.js:');
console.log('  has auth-brand-logo:', auth.includes('auth-brand-logo'));
console.log('  has auth-header-logo:', auth.includes('auth-header-logo'));
console.log('  has logo src:', auth.includes('lina-logo.png'));
