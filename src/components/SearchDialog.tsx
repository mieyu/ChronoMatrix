import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { deriveEffectiveStatus, type Plan } from "@/domain/plan";
import { searchPlans, sortSearchResults } from "@/domain/planSearch";
import { formatPlanTime } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface SearchDialogProps {
  plans: Plan[];
  now: Date;
}

const MAX_RESULTS = 30;

export function SearchDialog({ plans, now }: SearchDialogProps) {
  const open = useUiStore((state) => state.searchOpen);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);
  const closeSearch = useUiStore((state) => state.closeSearch);
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after the dialog mounts.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const results = useMemo(() => {
    const matched = searchPlans(plans, query);
    return sortSearchResults(matched, now).slice(0, MAX_RESULTS);
  }, [plans, query, now]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = (plan: Plan) => {
    closeSearch();
    openEditDialog(plan);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const plan = results[activeIndex];
      if (plan) {
        handleSelect(plan);
      }
    }
  };

  const trimmed = query.trim();

  return (
    <Dialog open={open} onOpenChange={setSearchOpen}>
      <DialogContent showCloseButton={false} className="top-[12%] translate-y-0 gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>搜索计划</DialogTitle>
          <DialogDescription>按标题或描述搜索全部计划</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索计划标题或描述..."
            className="h-7 border-0 px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
          />
        </div>

        <div className="max-h-[50vh] overflow-auto p-1.5">
          {trimmed.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              输入关键字以搜索全部计划。
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              没有匹配 “{trimmed}” 的计划。
            </p>
          ) : (
            results.map((plan, index) => {
              const status = deriveEffectiveStatus(plan, now);
              const active = index === activeIndex;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleSelect(plan)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    active ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{plan.title}</p>
                    {plan.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatPlanTime(plan.endAt)}
                  </span>
                  <StatusBadge status={status} className="shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
