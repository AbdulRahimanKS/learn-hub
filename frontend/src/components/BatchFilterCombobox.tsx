import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { batchApi, type Batch } from '@/lib/batch-api';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export interface BatchFilterComboboxProps {
  /** Selected batch id as string, or empty when none */
  value: string;
  onValueChange: (batchId: string, batch: Batch) => void;
  /** Shown on the trigger (usually the batch name); truncated with ellipsis */
  selectedLabel: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** If true and `value` is empty after first page loads, select the first batch */
  defaultSelectFirst?: boolean;
  /** Fires once after the first list fetch finishes (success or failure) */
  onReady?: () => void;
  /** Optional icon before the label on the trigger */
  triggerIcon?: ReactNode;
}

export function BatchFilterCombobox({
  value,
  onValueChange,
  selectedLabel,
  disabled,
  className,
  placeholder = 'Search batches…',
  defaultSelectFirst = true,
  onReady,
  triggerIcon,
}: BatchFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<Batch[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const onValueChangeRef = useRef(onValueChange);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const defaultedRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    setPage(1);
    setOptions([]);
    defaultedRef.current = false;
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await batchApi.getBatches({
          paginate: true,
          page,
          page_size: 12,
          ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
        });
        if (cancelled) return;
        const p = res as {
          success?: boolean;
          data?: Batch[];
          next?: string | null;
        };
        if (p.success && Array.isArray(p.data)) {
          setOptions((prev) => (page === 1 ? p.data! : [...prev, ...p.data!]));
          setHasMore(p.next != null);
          if (
            page === 1 &&
            defaultSelectFirst &&
            !valueRef.current &&
            p.data!.length > 0 &&
            !defaultedRef.current
          ) {
            defaultedRef.current = true;
            onValueChangeRef.current(String(p.data![0].id), p.data![0]);
          }
        } else {
          setOptions((prev) => (page === 1 ? [] : prev));
          setHasMore(false);
        }
      } catch {
        if (!cancelled) {
          setOptions((prev) => (page === 1 ? [] : prev));
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (!readyRef.current) {
            readyRef.current = true;
            onReadyRef.current?.();
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, defaultSelectFirst]);

  const handleSelect = (b: Batch) => {
    onValueChange(String(b.id), b);
    setOpen(false);
    setSearch('');
  };

  const display =
    selectedLabel.trim() ||
    (value && options.find((b) => String(b.id) === value)?.name) ||
    placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch('');
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            // Match SelectTrigger: neutral border/text (outline variant uses text-primary / border-primary)
            'h-11 w-full max-w-full justify-between rounded-xl border border-input bg-background px-3 font-bold text-foreground shadow-sm',
            'ring-offset-background hover:bg-muted/60 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !selectedLabel && !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {triggerIcon ? <span className="shrink-0">{triggerIcon}</span> : null}
            <span className="truncate">{display}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Panel width = trigger width so it stays aligned with the filter column; long names truncate */}
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-0 max-w-[var(--radix-popover-content-available-width)] p-0 overflow-hidden"
        align="end"
        sideOffset={4}
      >
        <Command shouldFilter={false} className="min-w-0">
          <CommandInput
            placeholder="Search batches…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </span>
              ) : (
                'No batch found.'
              )}
            </CommandEmpty>
            <CommandGroup className="min-w-0 overflow-hidden">
              {options.map((b) => (
                <CommandItem
                  key={b.id}
                  value={String(b.id)}
                  onSelect={() => handleSelect(b)}
                  className="cursor-pointer min-w-0 max-w-full overflow-hidden"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === String(b.id) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-left" title={b.name}>
                    {b.name}
                  </span>
                </CommandItem>
              ))}
              {hasMore && (
                <CommandItem
                  value="__load_more__"
                  onSelect={() => setPage((p) => p + 1)}
                  className="cursor-pointer justify-center font-medium text-primary"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Load more…'
                  )}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
