/**
 * Standard Schema interface (subset of the ~standard protocol)
 * Used for safely extracting JSON Schema from Zod 4 objects
 */
interface StandardSchemaLike {
  '~standard': {
    jsonSchema: {
      input: () => Record<string, unknown>;
    };
  };
}

/**
 * Check if a value implements the Standard Schema protocol
 */
function isStandardSchema(value: unknown): value is StandardSchemaLike {
  return value !== null && typeof value === 'object' && '~standard' in value;
}

/**
 * Safely extract JSON Schema from a Zod schema.
 * Returns the schema properties/required fields, or null if extraction fails.
 *
 * Uses the Standard Schema protocol (~standard.jsonSchema.input())
 * which produces clean, acyclic JSON Schema for all Zod 4 schema types.
 */
export function extractJsonSchema(
  inputSchema: unknown,
): Record<string, unknown> | null {
  if (inputSchema == null || !isStandardSchema(inputSchema)) {
    return null;
  }

  try {
    const jsonSchema = inputSchema['~standard'].jsonSchema.input();
    // Verify it's safely serializable (should always be, but defensive)
    JSON.stringify(jsonSchema);
    return jsonSchema;
  } catch {
    return null;
  }
}

/**
 * Extract a lightweight parameter list from a JSON Schema object.
 * This provides a summary view — agents can read the full jsonSchema for details.
 */
export interface ParameterSummary {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export function extractParameterSummary(
  jsonSchema: Record<string, unknown>,
): ParameterSummary[] {
  const properties = jsonSchema['properties'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!properties) return [];

  const requiredSet = new Set((jsonSchema['required'] as string[]) ?? []);

  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: resolveType(prop),
    required: requiredSet.has(name),
    ...(typeof prop['description'] === 'string'
      ? { description: prop['description'] }
      : {}),
  }));
}

function resolveType(prop: Record<string, unknown>): string {
  if (prop['anyOf'] !== undefined) return 'union';
  if (prop['oneOf'] !== undefined) return 'union';
  if (prop['const'] !== undefined) return 'literal';
  if (prop['enum'] !== undefined) return 'enum';
  if (typeof prop['type'] === 'string') return prop['type'];
  return 'unknown';
}
