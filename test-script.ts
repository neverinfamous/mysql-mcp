import { RouteNameInputSchema } from './src/adapters/mysql/schemas/router.js';
console.log(RouteNameInputSchema.parse({ route: 'bootstrap_rw' }));
