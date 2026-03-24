const fs = require('fs');
try {
  const content = fs.readFileSync('load_test_output.txt', 'utf16le');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('Error:') || line.includes('TypeError:') || line.includes('FAIL')) {
      console.log('--- MATCH AT LINE ' + (i+1) + ' ---');
      console.log(lines.slice(i, i + 20).join('\n'));
    }
  });
} catch (e) {
  console.error(e);
}
