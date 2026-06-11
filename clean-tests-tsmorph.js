const { Project } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths('src/adapters/mysql/tools/**/__tests__/*.test.ts');

project.getSourceFiles().forEach(file => {
  const unusedNames = ['MySQLAdapter', 'assertIsSuccess', 'assertIsError', 'assertIsObject', 'assertIsArray', 'vi', 'createMockWithTransaction', 'createMock'];
  
  file.getImportDeclarations().forEach(imp => {
     imp.getNamedImports().forEach(named => {
        if (unusedNames.includes(named.getName())) {
           const refs = named.getNameNode().findReferencesAsNodes();
           if (refs.length === 1) {
              named.remove();
           }
        }
     });
     if (imp.getNamedImports().length === 0 && !imp.getDefaultImport()) {
        imp.remove();
     }
  });

  let c = file.getFullText();
  c = c.replace(/ as unknown as MySQLAdapter/g, '');
  c = c.replace(/ as any\[\]/g, '');
  c = c.replace(/ as any\b/g, '');
  c = c.replace(/ as string/g, '');
  c = c.replace(/ as number/g, '');
  c = c.replace(/ as unknown\[\]/g, '');

  fs.writeFileSync(file.getFilePath(), c);
});
console.log('Cleanup complete.');
