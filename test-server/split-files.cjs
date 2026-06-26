const fs = require('fs');
const path = require('path');

const testDir = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-tool-groups';

function splitFile(filename, splitIndex) {
  const content = fs.readFileSync(path.join(testDir, filename), 'utf8');
  
  const groupFocusIndex = content.indexOf('## Group Focus:');
  const postTestIndex = content.indexOf('## Post-Test Procedures');
  
  const pre = content.substring(0, groupFocusIndex);
  const mid = content.substring(groupFocusIndex, postTestIndex);
  const post = content.substring(postTestIndex);
  
  const part1Name = filename.replace('.md', '-part1.md');
  const part2Name = filename.replace('.md', '-part2.md');
  
  // Replace titles and filenames in headers
  const pre1 = pre.replace(/Tool Group Testing: \[(.*?)\]/, 'Tool Group Testing: PART 1 [$1]')
                  .replace('test-' + filename, part1Name); // Not exact, but we'll fix the commit message later
  const pre2 = pre.replace(/Tool Group Testing: \[(.*?)\]/, 'Tool Group Testing: PART 2 [$1]');
  
  const post1 = post.replace(/\[Testing: (.*?)\]/, `[Testing: ${part1Name}]`);
  const post2 = post.replace(/\[Testing: (.*?)\]/, `[Testing: ${part2Name}]`);

  // Split the test items
  const lines = mid.split('\n');
  const mid1Lines = [];
  const mid2Lines = [];
  
  let currentNum = 0;
  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s/);
    if (match) {
      currentNum = parseInt(match[1], 10);
    }
    
    // Tools list starts from 1, tests start from 1 again.
    // Let's just heuristically say if the line has backticks and mysql_, it's a test.
    if (line.match(/^(\d+)\.\s.*?`mysql_/)) {
      if (currentNum <= splitIndex) {
        mid1Lines.push(line);
      } else {
        mid2Lines.push(line);
      }
    } else {
      // Keep headers and domain error markers in both?
      // Or just put the setup in 1 and teardown in 2.
      // Let's just put all non-test lines in both, except we can filter some.
      // Easiest is to put in both.
      mid1Lines.push(line);
      mid2Lines.push(line);
    }
  }
  
  fs.writeFileSync(path.join(testDir, part1Name), pre1 + mid1Lines.join('\n') + '\n' + post1);
  fs.writeFileSync(path.join(testDir, part2Name), pre2 + mid2Lines.join('\n') + '\n' + post2);
  
  // delete original
  fs.unlinkSync(path.join(testDir, filename));
}

splitFile('test-fulltext.md', 10);
splitFile('test-versioning.md', 10);

console.log('Split complete');
