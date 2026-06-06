import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, planStatusLabels } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { createPlan, deletePlan, type PlanDraft, updatePlan } from "@/data/plans";
import {
  buildDateShortcutOptions,
  endDateShortcuts,
  startDateShortcuts,
  type DateShortcutOption,
} from "@/domain/dateShortcuts";
import {
  defaultImportanceScore,
  maxImportanceScore,
  minImportanceScore,
  normalizeImportanceScore,
} from "@/domain/importance";
import type { Plan, StoredPlanStatus } from "@/domain/plan";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface PlanDialogProps {
  plan: Plan | null;
  open: boolean;
}

const storedStatusOptions: StoredPlanStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "archived",
];

export function PlanDialog({ plan, open }: PlanDialogProps) {
  const queryClient = useQueryClient();
  const closeDialog = useUiStore((state) => state.closeDialog);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importanceScore, setImportanceScore] = useState(defaultImportanceScore);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [storedStatus, setStoredStatus] =
    useState<StoredPlanStatus>("not_started");
  const shortcutReference = new Date();
  const startShortcutOptions = buildDateShortcutOptions(
    startDateShortcuts,
    shortcutReference,
  );
  const endShortcutOptions = buildDateShortcutOptions(
    endDateShortcuts,
    shortcutReference,
  );

  useEffect(() => {
    setTitle(plan?.title ?? "");
    setDescription(plan?.description ?? "");
    setImportanceScore(
      normalizeImportanceScore(plan?.importanceScore ?? defaultImportanceScore),
    );
    setStartAt(toDateTimeLocalValue(plan?.startAt ?? null));
    setEndAt(toDateTimeLocalValue(plan?.endAt ?? null));
    setStoredStatus(plan?.storedStatus ?? "not_started");
  }, [plan, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const draft: PlanDraft = {
        title,
        description,
        importanceScore,
        startAt: fromDateTimeLocalValue(startAt),
        endAt: fromDateTimeLocalValue(endAt),
        storedStatus,
        categoryId: null,
      };

      if (plan) {
        await updatePlan(plan.id, draft);
        return;
      }

      await createPlan(draft);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!plan) {
        return;
      }

      await deletePlan(plan.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      closeDialog();
    },
  });

  const canSave = title.trim().length > 0 && !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeDialog()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? "编辑计划" : "新增计划"}</DialogTitle>
          <DialogDescription>
            设置计划的重要度与时间边界，矩阵位置会随当前时间自动更新。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="plan-title">标题</Label>
            <Input
              id="plan-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="例如：整理本周观测计划"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="plan-description">描述</Label>
            <Textarea
              id="plan-description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder="补充背景、输出物或注意事项"
              rows={4}
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>重要程度</Label>
              <span className="text-sm font-medium tabular-nums">
                {importanceScore}
              </span>
            </div>
            <Slider
              min={minImportanceScore}
              max={maxImportanceScore}
              step={1}
              value={[importanceScore]}
              onValueChange={(value) =>
                setImportanceScore(normalizeImportanceScore(value[0] ?? 0))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <OptionalDateTimeField
              id="plan-start"
              label="开始时间"
              emptyLabel="未设置开始时间"
              icon={<CalendarClock className="size-4" />}
              value={startAt}
              shortcuts={startShortcutOptions}
              onChange={setStartAt}
            />
            <OptionalDateTimeField
              id="plan-end"
              label="结束时间"
              emptyLabel="未设置结束时间"
              icon={<Clock3 className="size-4" />}
              value={endAt}
              shortcuts={endShortcutOptions}
              onChange={setEndAt}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>当前状态</Label>
              <StatusBadge status={storedStatus} />
            </div>
            <Select
              value={storedStatus}
              onValueChange={(value) =>
                setStoredStatus(value as StoredPlanStatus)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {storedStatusOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {planStatusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          {plan ? (
            <Button
              type="button"
              variant="destructive"
              className="mr-auto"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 />
              删除
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!canSave}
          >
            {storedStatus === "completed" ? <CheckCircle2 /> : <Save />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionalDateTimeField({
  id,
  label,
  emptyLabel,
  icon,
  value,
  shortcuts = [],
  onChange,
}: {
  id: string;
  label: string;
  emptyLabel: string;
  icon: ReactNode;
  value: string;
  shortcuts?: DateShortcutOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {icon}
          {label}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onChange("")}
          title={`清空${label}`}
        >
          <X />
          清空
        </Button>
      </div>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {shortcuts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.id}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onChange(shortcut.value)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {value ? "已设置时间；点击清空可设为无时间" : emptyLabel}
      </p>
    </div>
  );
}
