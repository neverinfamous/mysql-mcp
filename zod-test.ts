import { z } from "zod";
const schema = z.object({ path: z.string().regex(/^\$((?:\.[a-zA-Z0-9_$]+)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/).optional() });
try {
  console.log(schema.parse({ path: '$invalid[' }));
} catch (e) {
  console.log('ERROR:', JSON.stringify(e.errors));
}
