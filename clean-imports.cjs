const { Project } = require('ts-morph');
const glob = require('glob');

const project = new Project();
const files = [
  ...glob.sync('src/adapters/mysql/tools/__tests__/*.test.ts'),
  ...glob.sync('src/adapters/mysql/tools/**/__tests__/*.test.ts')
];
project.addSourceFilesAtPaths(files);

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
  file.saveSync();
});
console.log('Imports cleanup complete.');
