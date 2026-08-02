import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Primitive table elements (shadcn-style)                                    */
/* -------------------------------------------------------------------------- */

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
        <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            'h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
            className,
        )}
        {...props}
    />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
    <td ref={ref} className={cn('p-3 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

/* -------------------------------------------------------------------------- */
/*  DataTable — sortable, filterable, paginated, column visibility             */
/* -------------------------------------------------------------------------- */

export type DataTableSortDir = 'asc' | 'desc';

export type DataTableColumn<T> = {
    id: string;
    header: string;
    /** Plain value used for sorting and text filtering. */
    accessor: (row: T) => string | number | boolean | null | undefined;
    cell?: (row: T, absoluteIndex: number) => React.ReactNode;
    sortable?: boolean;
    filterable?: boolean;
    defaultVisible?: boolean;
    /** Hide from the columns multi-select (always shown). */
    hideable?: boolean;
    className?: string;
    headerClassName?: string;
};

export type DataTableProps<T> = {
    data: T[];
    columns: DataTableColumn<T>[];
    getRowId: (row: T) => string;
    pageSizeOptions?: number[];
    defaultPageSize?: number;
    defaultSortId?: string;
    defaultSortDir?: DataTableSortDir;
    emptyMessage?: string;
    className?: string;
    toolbar?: React.ReactNode;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

function compareValues(a: string | number | boolean | null | undefined, b: string | number | boolean | null | undefined): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;

    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    }
    if (typeof a === 'boolean' && typeof b === 'boolean') {
        return Number(a) - Number(b);
    }

    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function valueMatchesFilter(value: string | number | boolean | null | undefined, filter: string): boolean {
    if (filter.trim() === '') return true;
    const haystack = value == null ? '' : String(value).toLowerCase();

    return haystack.includes(filter.trim().toLowerCase());
}

function SortIcon({ active, dir }: { active: boolean; dir: DataTableSortDir }) {
    if (!active) {
        return <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />;
    }

    return dir === 'asc' ? (
        <ArrowUp className="size-3 shrink-0 text-zinc-700 dark:text-zinc-200" aria-hidden />
    ) : (
        <ArrowDown className="size-3 shrink-0 text-zinc-700 dark:text-zinc-200" aria-hidden />
    );
}

function DataTable<T>({
    data,
    columns,
    getRowId,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    defaultPageSize = 10,
    defaultSortId,
    defaultSortDir = 'asc',
    emptyMessage = 'No results.',
    className,
    toolbar,
}: DataTableProps<T>) {
    const hideableColumns = React.useMemo(() => columns.filter((column) => column.hideable !== false), [columns]);

    const [visibleIds, setVisibleIds] = React.useState<Set<string>>(() => {
        const initial = new Set<string>();
        for (const column of columns) {
            if (column.defaultVisible === false) continue;
            initial.add(column.id);
        }
        return initial;
    });

    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [sortId, setSortId] = React.useState<string | null>(defaultSortId ?? columns.find((c) => c.sortable !== false)?.id ?? null);
    const [sortDir, setSortDir] = React.useState<DataTableSortDir>(defaultSortDir);
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(defaultPageSize);

    const visibleColumns = React.useMemo(
        () => columns.filter((column) => visibleIds.has(column.id) || column.hideable === false),
        [columns, visibleIds],
    );

    const filteredSorted = React.useMemo(() => {
        const indexed = data.map((row, index) => ({ row, index }));

        const filtered = indexed.filter(({ row }) =>
            columns.every((column) => {
                if (column.filterable === false) return true;
                const filter = filters[column.id] ?? '';
                if (filter.trim() === '') return true;
                return valueMatchesFilter(column.accessor(row), filter);
            }),
        );

        if (!sortId) {
            return filtered;
        }

        if (sortId === '__no') {
            const mul = sortDir === 'asc' ? 1 : -1;
            return [...filtered].sort((a, b) => (a.index - b.index) * mul);
        }

        const column = columns.find((item) => item.id === sortId);
        if (!column || column.sortable === false) {
            return filtered;
        }

        const mul = sortDir === 'asc' ? 1 : -1;

        return [...filtered].sort((a, b) => {
            const result = compareValues(column.accessor(a.row), column.accessor(b.row));
            if (result !== 0) return result * mul;

            return (a.index - b.index) * mul;
        });
    }, [columns, data, filters, sortDir, sortId]);

    const pageCount = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
    const safePage = Math.min(page, pageCount);

    React.useEffect(() => {
        setPage(1);
    }, [filters, pageSize, data]);

    React.useEffect(() => {
        if (page > pageCount) {
            setPage(pageCount);
        }
    }, [page, pageCount]);

    const pageRows = React.useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredSorted.slice(start, start + pageSize);
    }, [filteredSorted, pageSize, safePage]);

    const toggleSort = (columnId: string, sortable: boolean) => {
        if (!sortable) return;
        if (sortId === columnId) {
            setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortId(columnId);
        setSortDir('asc');
    };

    const toggleColumn = (columnId: string, checked: boolean) => {
        setVisibleIds((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(columnId);
            } else if (next.size > 1 || !next.has(columnId)) {
                // Keep at least one hideable column visible when possible.
                const visibleHideable = hideableColumns.filter((column) => next.has(column.id)).length;
                if (visibleHideable <= 1 && next.has(columnId)) {
                    return current;
                }
                next.delete(columnId);
            }
            return next;
        });
    };

    const rangeStart = filteredSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const rangeEnd = Math.min(safePage * pageSize, filteredSorted.length);

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">{toolbar}</div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer gap-1.5">
                            <Columns3 className="size-3.5" aria-hidden />
                            Columns
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {hideableColumns.map((column) => (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                checked={visibleIds.has(column.id)}
                                onCheckedChange={(checked) => toggleColumn(column.id, checked === true)}
                                onSelect={(event) => event.preventDefault()}
                            >
                                {column.header}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200/90 dark:border-zinc-800">
                <Table className="min-w-full">
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-950/60">
                        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                            <TableHead className="w-14 px-4 py-2 align-bottom">
                                <button
                                    type="button"
                                    onClick={() => toggleSort('__no', true)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                                    aria-label="Sort by number"
                                    aria-sort={sortId === '__no' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                >
                                    <span>No.</span>
                                    <SortIcon active={sortId === '__no'} dir={sortDir} />
                                </button>
                            </TableHead>
                            {visibleColumns.map((column) => {
                                const sortable = column.sortable !== false;
                                const active = sortId === column.id;

                                return (
                                    <TableHead key={column.id} className={cn('px-4 py-2 align-bottom', column.headerClassName)}>
                                        <div className="space-y-1.5">
                                            {sortable ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort(column.id, true)}
                                                    className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                                                    aria-label={`Sort by ${column.header}`}
                                                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                >
                                                    <span>{column.header}</span>
                                                    <SortIcon active={active} dir={sortDir} />
                                                </button>
                                            ) : (
                                                <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                                                    {column.header}
                                                </span>
                                            )}
                                            {column.filterable !== false ? (
                                                <Input
                                                    value={filters[column.id] ?? ''}
                                                    onChange={(event) =>
                                                        setFilters((current) => ({
                                                            ...current,
                                                            [column.id]: event.target.value,
                                                        }))
                                                    }
                                                    placeholder={`Filter ${column.header.toLowerCase()}…`}
                                                    className="h-8 border-zinc-200 bg-white text-xs font-normal normal-case tracking-normal dark:border-zinc-700 dark:bg-zinc-950"
                                                    aria-label={`Filter ${column.header}`}
                                                />
                                            ) : null}
                                        </div>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageRows.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={visibleColumns.length + 1} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            pageRows.map(({ row, index }, rowIndex) => {
                                const absoluteNo = (safePage - 1) * pageSize + rowIndex + 1;

                                return (
                                    <TableRow key={getRowId(row)} className="border-zinc-100 dark:border-zinc-800">
                                        <TableCell className="px-4 py-3.5 text-zinc-500 tabular-nums dark:text-zinc-400">{absoluteNo}</TableCell>
                                        {visibleColumns.map((column) => (
                                            <TableCell key={column.id} className={cn('px-4 py-3.5', column.className)}>
                                                {column.cell ? column.cell(row, index) : String(column.accessor(row) ?? '—')}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <p>
                    Showing <span className="font-medium text-zinc-700 tabular-nums dark:text-zinc-200">{rangeStart}</span>
                    –<span className="font-medium text-zinc-700 tabular-nums dark:text-zinc-200">{rangeEnd}</span> of{' '}
                    <span className="font-medium text-zinc-700 tabular-nums dark:text-zinc-200">{filteredSorted.length}</span>
                    {filteredSorted.length !== data.length ? (
                        <span>
                            {' '}
                            (filtered from <span className="tabular-nums">{data.length}</span>)
                        </span>
                    ) : null}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span>Rows</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(value) => {
                                setPageSize(Number(value));
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-8 w-[4.5rem] cursor-pointer" aria-label="Rows per page">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={safePage <= 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <span className="min-w-20 text-center tabular-nums">
                            {safePage} / {pageCount}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={safePage >= pageCount}
                            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                            aria-label="Next page"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export {
    DataTable,
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
};
