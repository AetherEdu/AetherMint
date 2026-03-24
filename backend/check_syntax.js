const fs = require('fs');
const vm = require('vm');
try {
  const code = fs.readFileSync('tests/routes/content.test.js', 'utf8');
  new vm.Script(code);
  console.log('Syntax is valid');
} catch (e) {
  console.error('Syntax error:', e.message);
  console.error(e.stack);
}
