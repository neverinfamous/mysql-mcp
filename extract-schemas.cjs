const fs = require('fs');
const path = require('path');

const typesPath = path.join(__dirname, 'src', 'adapters', 'mysql', 'types.ts');
const schemasDir = path.join(__dirname, 'src', 'adapters', 'mysql', 'schemas');

const introspectionDir = path.join(schemasDir, 'introspection');
const migrationDir = path.join(schemasDir, 'migration');

if (!fs.existsSync(introspectionDir)) fs.mkdirSync(introspectionDir, { recursive: true });
if (!fs.existsSync(migrationDir)) fs.mkdirSync(migrationDir, { recursive: true });

const content = fs.readFileSync(typesPath, 'utf8');
const lines = content.split('\n');

let introspectionOutput = [];
let migrationOutput = [];

let currentSection = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('// Introspection Schemas')) {
    currentSection = 'introspection_in';
    continue;
  } else if (line.includes('// Migration Tracking Input Schemas')) {
    currentSection = 'migration_in';
    continue;
  } else if (line.includes('// Introspection & Migration Output Schemas')) {
    currentSection = 'mixed_out';
    continue;
  } else if (line.includes('// =============================================================================')) {
    // maybe end of section, but let's be careful, some sections have this at the start
  }

  if (currentSection === 'introspection_in') {
    if (line.includes('// ===============================') && lines[i+1]?.includes('// Migration Tracking Input Schemas')) {
      currentSection = '';
    } else {
      introspectionOutput.push(line);
    }
  } else if (currentSection === 'migration_in') {
    if (line.includes('// ===============================') && lines[i+1]?.includes('// Introspection & Migration Output Schemas')) {
      currentSection = '';
    } else {
      migrationOutput.push(line);
    }
  } else if (currentSection === 'mixed_out') {
    // we need to split outputs by analyzing names
    if (line.startsWith('export const ')) {
      // It's a schema definition
    }
    // Since it's mixed, let's just push it to a temp array and process it
  }
}
