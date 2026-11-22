const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const backups = path.join(root, 'backups');
fs.mkdirSync(backups, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const archiveName = `smart-solar-sdk58-pre-design-v2-${timestamp}.tar.gz`;
const archivePath = path.join(backups, archiveName);

console.log(`Creating archive: ${archivePath}`);
execSync(`tar.exe -czf "${archivePath}" app components features hooks mocks scenes scripts services store tests theme types utils app.json package.json tsconfig.json`, {
  cwd: root,
  stdio: 'inherit'
});

const size = fs.statSync(archivePath).size;
console.log(`Backup completed successfully! (${Math.round(size / 1024)} KB)`);
