const fs = require('fs');
['Stock_Count_System_V5.html', 'app/src/main/assets/Stock_Count_System_V5.html'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\r?\n<script src="auth-sessions\.js"><\/script>/g, '');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Cleaned ' + file);
});
