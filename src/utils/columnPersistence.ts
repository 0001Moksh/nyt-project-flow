import { useState, useEffect } from 'react';

/**
 * Custom hook for persisting table column visibility preferences in localStorage.
 * @param tableKey Unique identifier for the table (e.g. 'table_cols_admin_projects')
 * @param defaultColumns Initial default column key array
 */
export function useColumnPersistence(tableKey: string, defaultColumns: string[]) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(tableKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(`Failed to read ${tableKey} from localStorage`, e);
    }
    return defaultColumns;
  });

  useEffect(() => {
    try {
      localStorage.setItem(tableKey, JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn(`Failed to save ${tableKey} to localStorage`, e);
    }
  }, [tableKey, visibleColumns]);

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    );
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const resetToDefault = () => setVisibleColumns(defaultColumns);

  return {
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    isColumnVisible,
    resetToDefault,
  };
}
