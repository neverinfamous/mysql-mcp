import { FulltextCreateSchema } from "./src/adapters/mysql/schemas/text/fulltext.js";
const result = FulltextCreateSchema.parse({table: "test_users", columns: ["bio"], name: "ft_bio_idx"});
console.log(JSON.stringify(result, null, 2));
