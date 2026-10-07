/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BOPP Schema Registry exporting the 38 official Draft 2020-12 schemas
 */

import schemasJson from './boppSchemas.json';

export interface SchemaEntry {
  path: string;
  schema: Record<string, unknown>;
  title?: string;
  description?: string;
}

export const BOPP_SCHEMAS: Record<string, Record<string, unknown>> = schemasJson as Record<string, Record<string, unknown>>;

export const BOPP_SCHEMA_LIST: SchemaEntry[] = Object.entries(BOPP_SCHEMAS).map(([path, schema]) => ({
  path,
  schema,
  title: (schema.title as string) || path,
  description: (schema.description as string) || '',
}));
