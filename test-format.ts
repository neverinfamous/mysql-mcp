import { formatHandlerErrorResponse } from './src/adapters/mysql/tools/core/error-helpers.js';
const err = new Error("Key column 'missing_col' doesn't exist in table");
(err as any).errno = 1072;
console.log(formatHandlerErrorResponse(err));
