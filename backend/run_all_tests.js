const { execSync } = require('child_process');
const fs = require('fs');

const tests = [
  'tests/routes/content.test.js',
  'tests/load.test.js'
];

tests.forEach(test => {
  console.log(`Running ${test}...`);
  try {
    const output = execSync(`npx jest ${test} --no-cache`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${test} passed`);
  } catch (error) {
    console.log(`❌ ${test} failed`);
    fs.writeFileSync(`failed_${test.replace(/\//g, '_')}.log`, error.stdout || error.stderr || error.message);
  }
});
