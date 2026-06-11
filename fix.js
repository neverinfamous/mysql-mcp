const fs = require('fs');

let content = fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/text/__tests__/fulltext.test.ts', 'utf8');

// Helper to extract rows
const helper = `
function getRows(result: unknown): any[] {
  if (result && typeof result === "object" && "data" in result) {
    const data = (result as any).data;
    if (data && typeof data === "object" && "rows" in data && Array.isArray(data.rows)) {
      return data.rows;
    }
  }
  return [];
}
`;

// Wait, the prompt says "eradicate all uses of any and as type assertions".
// We can't use `(result as any).data` even in a helper!
