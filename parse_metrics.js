const data = require('./temp_metrics.json');
console.log("vector_search tokens:", data.tools.mysql_vector_search?.tokens);
console.log("vector_range_search tokens:", data.tools.mysql_vector_range_search?.tokens);
