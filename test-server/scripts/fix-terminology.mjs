import fs from 'fs';
import path from 'path';

const dirs = [
  'test-advanced',
  'test-codemode',
  'test-usability',
  'test-usability-direct',
  'test-tool-groups'
];

for (const dir of dirs) {
  const dirPath = path.join(process.cwd(), 'test-server', dir);
  if (!fs.existsSync(dirPath)) continue;
  
  const files = fs.readdirSync(dirPath).filter(f => f.startsWith('coordinator-workflow') && f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    let original = content;
    content = content.replace(/Graceful Fails/g, 'Graceful Degradations');
    content = content.replace(/graceful fails/g, 'graceful degradations');
    content = content.replace(/Graceful Fail/g, 'Graceful Degradation');
    content = content.replace(/graceful fail/g, 'graceful degradation');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${filePath}`);
    } else {
      console.log(`No changes needed for ${filePath}`);
    }
  }
}
