/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Schema Validation & Compliance Report Component
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  FileCode,
  Layers,
} from 'lucide-react';
import type { ValidationResult } from '../utils/schemaValidator';
import { BOPP_SCHEMA_LIST } from '../schemas/schemaRegistry';

interface SchemaValidationReportProps {
  validationResult: ValidationResult;
}

export const SchemaValidationReport: React.FC<SchemaValidationReportProps> = ({
  validationResult,
}) => {
  const [selectedSchemaPath, setSelectedSchemaPath] = useState<string>('annotation.json');
  const [explorerTab, setExplorerTab] = useState<'jsonschema' | 'typescript'>('jsonschema');

  const selectedSchema = BOPP_SCHEMA_LIST.find(s => s.path === selectedSchemaPath) || BOPP_SCHEMA_LIST[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-y-auto text-xs p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 rounded">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            validationResult.isValid
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>BOPP v{validationResult.schemaVersion} Schema Compliance</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                validationResult.isValid
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                  : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300'
              }`}>
                {validationResult.isValid ? 'PASSED (100% COMPLIANT)' : 'ISSUES DETECTED'}
              </span>
            </h3>
            <p className="text-neutral-500 mt-0.5">
              Verified against JSON Schema Draft 2020-12 official specifications from github.com/bmcfee/bopp.
            </p>
          </div>
        </div>

        {/* Score indicator */}
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {validationResult.score}%
            </div>
            <div className="text-[11px] text-neutral-400">Compliance Score</div>
          </div>
        </div>
      </div>

      {/* Validation Checks Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              {validationResult.checksSummary.passed} Invariants Passed
            </div>
            <div className="text-neutral-400 text-[11px]">Parallel arrays & field patterns</div>
          </div>
        </div>

        <div className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              {validationResult.checksSummary.warnings} Warnings
            </div>
            <div className="text-neutral-400 text-[11px]">Non-fatal style / regex deviations</div>
          </div>
        </div>

        <div className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 flex items-center gap-2.5">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              {validationResult.checksSummary.errors} Schema Errors
            </div>
            <div className="text-neutral-400 text-[11px]">Violations preventing valid BOPP ingest</div>
          </div>
        </div>
      </div>

      {/* Issues Breakdown */}
      {validationResult.issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 text-xs">
            Validation Findings
          </h4>
          <div className="space-y-1.5">
            {validationResult.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`p-2.5 border rounded flex items-start gap-2.5 ${
                  issue.severity === 'error'
                    ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
                    : issue.severity === 'warning'
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {issue.severity === 'error' ? (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                ) : issue.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-mono font-medium text-[11px]">
                    <span className="text-neutral-400">path:</span> {issue.path}
                  </div>
                  <div className="text-xs">{issue.message}</div>
                  {issue.details && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                      {issue.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automated Schema Codegen Banner (Python datamodel-code-generator equivalent) */}
      <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded space-y-1.5">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
            Automated Compile-Time Codegen (TypeScript / datamodel-code-generator counterpart)
          </h4>
        </div>
        <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
          Just as BOPP uses <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">datamodel-code-generator</code> on the Python end to derive msgspec/pydantic models, this plugin executes <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">json-schema-to-typescript</code> via <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">scripts/generate_types.ts</code> in the <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">prebuild</code> lifecycle hook. TypeScript definitions are automatically compiled from <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">schemas/v1/*.json</code> whenever the codebase compiles.
        </p>
      </div>

      {/* Official BOPP Schemas Explorer */}
      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 text-xs">
              Official BOPP Schema Explorer & Compiled Models
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setExplorerTab('jsonschema')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  explorerTab === 'jsonschema'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 font-medium shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                JSON Schema (v1)
              </button>
              <button
                onClick={() => setExplorerTab('typescript')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  explorerTab === 'typescript'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 font-medium shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Generated TypeScript Models
              </button>
            </div>

            {explorerTab === 'jsonschema' && (
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">File:</span>
                <select
                  value={selectedSchemaPath}
                  onChange={e => setSelectedSchemaPath(e.target.value)}
                  className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-neutral-800 dark:text-neutral-200 focus:outline-none font-mono text-[11px]"
                >
                  {BOPP_SCHEMA_LIST.map(s => (
                    <option key={s.path} value={s.path}>
                      schemas/v1/{s.path}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded">
          {explorerTab === 'jsonschema' ? (
            <>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200 dark:border-neutral-800">
                <div className="font-mono text-neutral-600 dark:text-neutral-400">
                  schemas/v1/{selectedSchema.path}
                </div>
                <div className="text-neutral-500 text-[11px]">
                  {selectedSchema.title}
                </div>
              </div>
              <pre className="font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-auto max-h-72 leading-relaxed">
                {JSON.stringify(selectedSchema.schema, null, 2)}
              </pre>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200 dark:border-neutral-800">
                <div className="font-mono text-neutral-600 dark:text-neutral-400">
                  src/types/generated/boppSchemaTypes.ts
                </div>
                <div className="text-neutral-500 text-[11px]">
                  Auto-compiled by scripts/generate_types.ts
                </div>
              </div>
              <pre className="font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-auto max-h-72 leading-relaxed">
                {`/**
 * AUTO-COMPILED TYPEDEF PREVIEW (from schemas/v1/annotation.json)
 */
export type AnyExtent =
  | Times
  | TimeIntervalExtent
  | TimeFrequencyBoxExtent
  | PixelBoxExtent
  | ScoreQuarterNotes
  | ScoreInterval
  | MIDITicks
  | MIDIInterval;

export type AnyPayload =
  | BeatPositionPayload
  | ChordPayload
  | Key_ModePayload
  | LyricsPayload
  | Mood_ThayerPayload
  | Note_HzPayload
  | Note_MidiPayload
  | ObjectPayload
  | OnsetPayload
  | Pitch_ContourPayload
  | RelationPayload
  | Multi_SegmentPayload
  | Segment_OpenPayload
  | Tag_OpenPayload
  | TempoPayload;

export type AnyConfidence =
  | ConfidenceByInterAnnotatorAgreement
  | LikelihoodConfidence
  | VarianceConfidence;

export interface Annotation {
  id?: string;
  parents?: string[];
  media_id: string;
  bopp_version: string;
  metadata?: AnnotationMetadata;
  extent?: AnyExtent;
  payload: AnyPayload;
  confidence?: AnyConfidence;
  sandbox?: { [k: string]: any };
}`}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
