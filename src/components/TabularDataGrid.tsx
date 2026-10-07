/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Tabular DataFrame View Component (Matching bopp.util.to_dataframe)
 */

import React, { useState, useMemo } from 'react';
import { Download, Search, ArrowUpDown, Filter } from 'lucide-react';
import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { exportToBoppCsv } from '../utils/boppParser';

interface TabularDataGridProps {
  annotation: BoppAnnotation;
  tabularData: TabularRecord[];
}

export const TabularDataGrid: React.FC<TabularDataGridProps> = ({
  annotation,
  tabularData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('__index');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [minConfidence, setMinConfidence] = useState<number>(0);

  // Discover all keys in dataset
  const columns = useMemo(() => {
    if (tabularData.length === 0) return ['__index'];
    const keys = new Set<string>();
    keys.add('__index');
    for (const row of tabularData) {
      for (const k of Object.keys(row)) {
        if (!k.startsWith('__')) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [tabularData]);

  // Filtering and sorting
  const processedData = useMemo(() => {
    return tabularData
      .filter(row => {
        // Confidence filter
        if (typeof row.confidence === 'number' && row.confidence < minConfidence) {
          return false;
        }
        // Search filter
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          return Object.values(row).some(v => String(v).toLowerCase().includes(s));
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [tabularData, searchTerm, sortColumn, sortDirection, minConfidence]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = exportToBoppCsv(annotation, processedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${annotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}.bopp.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden text-xs">
      {/* Grid Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-slate-300 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter table rows..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded text-slate-900 dark:text-slate-100 font-medium focus:outline-none w-48 shadow-2xs"
            />
          </div>

          {annotation.confidence && (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <Filter className="w-3 h-3 text-slate-500" />
              <span>Min Conf:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={minConfidence}
                onChange={e => setMinConfidence(parseFloat(e.target.value))}
                className="w-16 h-1 accent-blue-600 bg-slate-200 dark:bg-neutral-700 rounded"
              />
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                {minConfidence.toFixed(2)}
              </span>
            </div>
          )}

          <div className="text-slate-600 dark:text-slate-400 font-mono">
            Showing <strong className="text-slate-900 dark:text-slate-100">{processedData.length}</strong> of {tabularData.length} records
          </div>
        </div>

        <button
          onClick={handleDownloadCsv}
          className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-800 dark:text-slate-200 rounded font-semibold transition-colors shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          <span>Export BOPP CSV</span>
        </button>
      </div>

      {/* High-Density Data Grid Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-neutral-700 z-10 shadow-2xs">
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap select-none font-bold"
                >
                  <div className="flex items-center gap-1">
                    <span>{col === '__index' ? '#' : col}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-neutral-800">
            {processedData.map((row, idx) => (
              <tr
                key={row.__index ?? idx}
                className="hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {columns.map(col => {
                  const val = row[col];
                  const isNumber = typeof val === 'number';
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 whitespace-nowrap truncate max-w-xs ${
                        isNumber ? 'tabular-nums' : ''
                      } ${col === 'value' || col === 'label' ? 'font-bold text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}
                    >
                      {val === undefined || val === null
                        ? '—'
                        : isNumber
                        ? Number.isInteger(val)
                          ? val
                          : val.toFixed(4)
                        : typeof val === 'object'
                        ? JSON.stringify(val)
                        : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
