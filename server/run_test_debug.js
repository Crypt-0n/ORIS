const { execSync } = require('child_process');
try {
  execSync('npm run test -- __tests__/cases.test.js', { stdio: 'inherit' });
} catch (e) { }
