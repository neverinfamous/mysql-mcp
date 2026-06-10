const fs = require('fs');
const path = require('path');

const schemasDir = path.join(__dirname, 'src', 'adapters', 'mysql', 'schemas');
const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.ts'));

files.push('../tools/codemode/index.ts'); // Also fix codemode if there's any

for (const file of files) {
  const filePath = file.includes('/') ? path.join(__dirname, 'src', file) : path.join(schemasDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // We want to find:
  // BaseOutputSchema.extend({
  //   data: z.object({
  //     ...
  //   })
  // });
  
  // A simple regex approach won't handle nested objects perfectly if we aren't careful.
  // Instead, let's look for `data: z.object({` or `data: z.unknown()` etc.
  // Actually, we can just replace `data: z.object({` with `data: z.object({` and then find the matching closing bracket.
  
  // Or, a simpler way: just match `data: z.object({ ... })` using a balanced parenthesis parser.
  // But wait! Many schemas were written simply as:
  // export const FooOutputSchema = BaseOutputSchema.extend({
  //   data: z.object({
  //     ...
  //   }),
  // });
  
  // Let's use a regex that matches `data: z.object({` and we can manually check them if needed, or we just do a more robust string replacement.
  
  const blocks = [];
  let index = 0;
  while ((index = content.indexOf('data: z.object({', index)) !== -1) {
    // find the matching closing brace for the z.object(
    let depth = 0;
    let i = index + 'data: z'.length; // Start at 'o' of object
    for (; i < content.length; i++) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') {
        depth--;
        if (depth === 0) {
          break; // Found the end of z.object(...)
        }
      }
    }
    
    if (depth === 0) {
      // The substring from index to i+1 is `data: z.object(...)`
      const replacement = content.substring(index, i + 1) + '.loose().optional()';
      
      // If it already has .loose() or .optional(), skip
      if (content.substring(i + 1, i + 20).includes('.optional()') || content.substring(i + 1, i + 20).includes('.loose()')) {
        index = i + 1;
        continue;
      }

      content = content.substring(0, index) + replacement + content.substring(i + 1);
      index = index + replacement.length;
    } else {
      index++;
    }
  }

  // Also handle data: z.array(...) or data: z.unknown() that aren't optional
  // Let's do a similar pass for data: z.array(
  index = 0;
  while ((index = content.indexOf('data: z.array(', index)) !== -1) {
    let depth = 0;
    let i = index + 'data: z'.length;
    for (; i < content.length; i++) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    
    if (depth === 0) {
      const replacement = content.substring(index, i + 1) + '.optional()';
      if (content.substring(i + 1, i + 20).includes('.optional()')) {
        index = i + 1;
        continue;
      }
      content = content.substring(0, index) + replacement + content.substring(i + 1);
      index = index + replacement.length;
    } else {
      index++;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
