/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Automated JSON Schema to TypeScript Type Generator
 * Mirrors Python's datamodel-code-generator for BOPP (Bounded Observation Payload Protocol)
 * Compiles schemas/v1/*.json into strongly typed TypeScript definitions at build time.
 */

import fs from 'node:fs';
import path from 'node:path';
import { compile } from 'json-schema-to-typescript';

async function generateBoppTypes() {
  const schemasDir = path.resolve(process.cwd(), 'schemas/v1');
  const targetDir = path.resolve(process.cwd(), 'src/types/generated');
  const targetFile = path.join(targetDir, 'boppSchemaTypes.ts');

  console.log(`[BOPP Schema Codegen] Reading schemas from: ${schemasDir}`);

  if (!fs.existsSync(schemasDir)) {
    console.warn(`[BOPP Schema Codegen] Schemas directory not found at ${schemasDir}. Skipping.`);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Load all schemas in schemas/v1/ into a map
  const schemasMap = {};

  function loadDir(dir, baseDir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        loadDir(full, baseDir);
      } else if (f.endsWith('.json')) {
        const rel = path.relative(baseDir, full).replace(/\\/g, '/');
        const content = JSON.parse(fs.readFileSync(full, 'utf-8'));
        schemasMap[rel] = content;
        if (!schemasMap[f]) {
          schemasMap[f] = content;
        }
      }
    }
  }

  loadDir(schemasDir, schemasDir);
  console.log(`[BOPP Schema Codegen] Loaded ${Object.keys(schemasMap).length} schema entries.`);

  // 2. Dereference schemas resolving $ref relative to schemas/v1
  function resolveRef(ref, currentPath) {
    const [filePart, pointer] = ref.split('#');
    let file = filePart || currentPath;
    file = file.replace(/^\.\.\//, '');
    if (!file.endsWith('.json')) file += '.json';

    const schema = schemasMap[file] || schemasMap[path.basename(file)];
    if (!schema) {
      throw new Error(`[BOPP Schema Codegen] Could not find schema for ref: "${ref}" (file: "${file}")`);
    }

    if (!pointer) return schema;

    const parts = pointer.split('/').filter(Boolean);
    let cur = schema;
    for (const p of parts) {
      cur = cur?.[p];
      if (cur === undefined) {
        throw new Error(`[BOPP Schema Codegen] Pointer "${pointer}" not found in schema "${file}"`);
      }
    }
    return cur;
  }

  function dereference(node, currentPath = 'annotation.json', depth = 0) {
    if (depth > 30 || !node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      return node.map(item => dereference(item, currentPath, depth + 1));
    }

    let result = {};

    if (node.$ref) {
      const target = resolveRef(node.$ref, currentPath);
      const newPath = node.$ref.split('#')[0] || currentPath;
      const resolved = dereference(target, newPath, depth + 1);
      result = { ...resolved };
    }

    for (const [k, v] of Object.entries(node)) {
      if (k !== '$ref' && k !== '$id') {
        result[k] = dereference(v, currentPath, depth + 1);
      }
    }

    return result;
  }

  const rootSchema = schemasMap['annotation.json'];
  if (!rootSchema) {
    throw new Error('annotation.json not found in schemas/v1/');
  }

  console.log('[BOPP Schema Codegen] Dereferencing root schema and dependent schemas...');
  const dereferencedRoot = dereference(rootSchema, 'annotation.json');

  // 3. Compile with json-schema-to-typescript
  console.log('[BOPP Schema Codegen] Compiling schema to TypeScript interfaces...');
  const tsCode = await compile(dereferencedRoot, 'BoppAnnotationGenerated', {
    bannerComment: `/* eslint-disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * THIS FILE WAS AUTOMATICALLY GENERATED AT COMPILE TIME FROM schemas/v1/*.json
 * DO NOT MODIFY THIS FILE BY HAND.
 * 
 * Generator: json-schema-to-typescript (TypeScript counterpart of datamodel-code-generator)
 * Source: https://github.com/bmcfee/bopp schemas/v1/annotation.json
 */`,
    unknownAny: false,
    format: false,
  });

  const extraExports = `
// Convenience type aliases for BOPP integration
export type BoppAnnotation = Annotation;
export type BoppExtent = AnyExtent;
export type BoppPayload = AnyPayload;
export type BoppConfidence = AnyConfidence;
export type BoppMetadata = AnnotationMetadata;
`;

  const finalOutput = `${tsCode}\n${extraExports}`;
  fs.writeFileSync(targetFile, finalOutput, 'utf-8');
  console.log(`[BOPP Schema Codegen] Successfully generated ${targetFile} (${finalOutput.length} bytes, ${finalOutput.split('\\n').length} lines).`);
}

generateBoppTypes().catch(err => {
  console.error('[BOPP Schema Codegen] Failed:', err);
  process.exit(1);
});
