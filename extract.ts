import { TEST_FILES } from './test-server/scripts/test-manifest.ts'; 
import * as fs from 'fs';
fs.writeFileSync('C:/Users/chris/.gemini/antigravity/brain/5d120974-ac11-4a06-b1e0-0d5e77e2e419/scratch/test-usability.json', JSON.stringify(TEST_FILES.filter(f => f.directory === 'test-usability'), null, 2));
