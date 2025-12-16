import React, { useMemo } from 'react';
import { Prospect } from './types';
import { Icons } from './Icons';

interface FilterBarProps {
    columns: string[];
    prospects: Prospect[];
    activeFilters: Record<string, string>;
    onFilterChange: (column: string, value: string) => void;
    onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    columns,
    prospects,
    activeFilters,
    onFilterChange,
    onClearFilters
}) => {

    const filterOptions = useMemo(() => {
        const options: Record<string, string[]> = {};

        columns.forEach(col => {
            const values = prospects
                .map(p => p[col])
                .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                .map(v => String(v));

            options[col] = (Array.from(new Set(values)) as string[]).sort();
        });

        return options;
    }, [columns, prospects]);

    if (columns.length === 0) return null;

    const hasActiveFilters = Object.keys(activeFilters).length > 0;

    return (
        <div className="mb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-xs font-black text-secondary-400 tracking-widest uppercase flex items-center gap-2">
                    <Icons.Filter className="w-4 h-4" />
                    Filtrar por columnas
                </h3>

                {hasActiveFilters && (
                    <button
                        onClick={onClearFilters}
                        className="text-xs text-red-500 hover:text-red-700 font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                        Limpiar filtros ✕
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                {columns.map(col => {
                    const isActive = !!activeFilters[col];

                    return (
                        <div key={col} className="relative group">
                            <div className={`
                    flex items-center pl-4 pr-2 py-2 rounded-full border transition-all duration-200 cursor-pointer
                    ${isActive
                                    ? 'bg-secondary-800 border-secondary-800 text-white shadow-md shadow-secondary-200'
                                    : 'bg-white border-secondary-200 text-secondary-600 hover:border-primary-300 hover:shadow-sm'
                                }
                `}>
                                <span className="text-xs font-bold mr-2">{col}:</span>

                                <select
                                    value={activeFilters[col] || ''}
                                    onChange={(e) => onFilterChange(col, e.target.value)}
                                    className={`
                        appearance-none bg-transparent outline-none text-xs font-bold cursor-pointer pr-6 py-1
                        ${isActive ? 'text-white' : 'text-secondary-800'}
                      `}
                                    style={{ maxWidth: '140px', textOverflow: 'ellipsis' }}
                                >
                                    <option value="" className="text-secondary-800">Todos</option>
                                    {filterOptions[col]?.map(val => (
                                        <option key={val} value={val} className="text-secondary-800">{val}</option>
                                    ))}
                                </select>

                                <div className="pointer-events-none -ml-5 mt-0.5">
                                    <Icons.ChevronDown className={`w-3 h-3 ${isActive ? 'text-secondary-400' : 'text-secondary-400'}`} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
