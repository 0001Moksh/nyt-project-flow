import { Filter, GripVertical, Plus } from 'lucide-react';
import React from 'react';

export type TableColumn<T> = {
  key: string;
  label: string;
  width?: string;
  visible?: boolean;
  render: (row: T) => React.ReactNode;
};

export const defaultColumnOrder = <T,>(columns: TableColumn<T>[]) => columns.map((column) => column.key);

export const reorderColumns = <T,>(columns: TableColumn<T>[], order: string[]) => {
  const map = new Map(columns.map((column) => [column.key, column]));
  return order.map((key) => map.get(key)).filter(Boolean) as TableColumn<T>[];
};

export const createColumnControls = (args: {
  onToggleFilters?: () => void;
  onToggleVisibility?: () => void;
  onToggleDrag?: () => void;
}) => ({
  FilterIcon: Filter,
  PlusIcon: Plus,
  DragIcon: GripVertical,
  ...args,
});
