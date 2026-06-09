import { type ReactNode } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  maxImportanceScore,
  minImportanceScore,
} from "@/domain/importance";
import { type SettingsView } from "@/domain/settings";
import { themeLabels, type ThemePreference } from "@/domain/theme";
import { useSettingsStore } from "@/state/settings";
import { useThemeStore } from "@/state/theme";
import { useUiStore } from "@/state/ui";

const urgentWindowMin = 1;
const urgentWindowMax = 336;
const reminderLeadMin = 0;
const reminderLeadMax = 1440;

const viewOptions: { value: SettingsView; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "matrix", label: "矩阵" },
  { value: "calendar", label: "日历" },
  { value: "list", label: "列表" },
  { value: "review", label: "复盘" },
];

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "跟随本地/系统" },
  { value: "light", label: themeLabels.light },
  { value: "dark", label: themeLabels.dark },
];

export function SettingsDialog() {
  const open = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const defaultView = useSettingsStore((state) => state.defaultView);
  const importantThreshold = useSettingsStore(
    (state) => state.importantThreshold,
  );
  const urgentWindowHours = useSettingsStore(
    (state) => state.urgentWindowHours,
  );
  const remindersEnabled = useSettingsStore(
    (state) => state.remindersEnabled,
  );
  const reminderLeadMinutes = useSettingsStore(
    (state) => state.reminderLeadMinutes,
  );
  const setDefaultView = useSettingsStore((state) => state.setDefaultView);
  const setImportantThreshold = useSettingsStore(
    (state) => state.setImportantThreshold,
  );
  const setUrgentWindowHours = useSettingsStore(
    (state) => state.setUrgentWindowHours,
  );
  const setRemindersEnabled = useSettingsStore(
    (state) => state.setRemindersEnabled,
  );
  const setReminderLeadMinutes = useSettingsStore(
    (state) => state.setReminderLeadMinutes,
  );
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);

  return (
    <Dialog open={open} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            调整默认视图、矩阵判定、提醒与本地外观偏好。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <SettingsSection title="常规">
            <div className="flex items-center justify-between gap-4">
              <SettingText
                labelId="settings-default-view-label"
                descriptionId="settings-default-view-description"
                label="默认视图"
                description="应用启动后首先显示的工作视图"
              />
              <Select
                value={defaultView}
                onValueChange={(value) =>
                  setDefaultView(value as SettingsView)
                }
              >
                <SelectTrigger
                  id="settings-default-view"
                  aria-labelledby="settings-default-view-label"
                  aria-describedby="settings-default-view-description"
                  className="w-36"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {viewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          <SettingsSection title="矩阵">
            <SliderSetting
              id="settings-important-threshold"
              label="重要阈值"
              description="达到该分数的计划会归为重要"
              value={importantThreshold}
              valueLabel={`${importantThreshold} 分`}
              min={minImportanceScore}
              max={maxImportanceScore}
              step={1}
              onChange={setImportantThreshold}
            />
            <SliderSetting
              id="settings-urgent-window"
              label="紧急窗口"
              description="截止或开始时间进入该窗口后视为紧急"
              value={urgentWindowHours}
              valueLabel={formatHours(urgentWindowHours)}
              min={urgentWindowMin}
              max={urgentWindowMax}
              step={1}
              onChange={setUrgentWindowHours}
            />
          </SettingsSection>

          <SettingsSection title="提醒">
            <div className="flex items-center justify-between gap-4">
              <SettingText
                labelId="settings-reminders-enabled-label"
                descriptionId="settings-reminders-enabled-description"
                label="计划提醒"
                description="在 Tauri 桌面环境中发送到期提醒"
              />
              <Button
                type="button"
                variant={remindersEnabled ? "secondary" : "outline"}
                aria-pressed={remindersEnabled}
                aria-labelledby="settings-reminders-enabled-label settings-reminders-enabled-state"
                aria-describedby="settings-reminders-enabled-description"
                onClick={() => setRemindersEnabled(!remindersEnabled)}
              >
                {remindersEnabled ? <Bell /> : <BellOff />}
                <span id="settings-reminders-enabled-state">
                  {remindersEnabled ? "已开启" : "已关闭"}
                </span>
              </Button>
            </div>
            <SliderSetting
              id="settings-reminder-lead"
              label="提前提醒"
              description="计划截止前多久发送即将截止提醒"
              value={reminderLeadMinutes}
              valueLabel={formatMinutes(reminderLeadMinutes)}
              min={reminderLeadMin}
              max={reminderLeadMax}
              step={5}
              disabled={!remindersEnabled}
              onChange={setReminderLeadMinutes}
            />
          </SettingsSection>

          <SettingsSection title="外观">
            <div className="flex items-center justify-between gap-4">
              <SettingText
                labelId="settings-theme-label"
                descriptionId="settings-theme-description"
                label="主题"
                description="选择浅色、深色或跟随本地系统"
              />
              <Select
                value={themePreference}
                onValueChange={(value) =>
                  setThemePreference(value as ThemePreference)
                }
              >
                <SelectTrigger
                  id="settings-theme"
                  aria-labelledby="settings-theme-label"
                  aria-describedby="settings-theme-description"
                  className="w-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg border bg-card/60 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function SettingText({
  labelId,
  descriptionId,
  label,
  description,
}: {
  labelId: string;
  descriptionId: string;
  label: string;
  description: string;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label id={labelId}>{label}</Label>
      <p id={descriptionId} className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function SliderSetting({
  id,
  label,
  description,
  value,
  valueLabel,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: number;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-4">
        <SettingText
          labelId={labelId}
          descriptionId={descriptionId}
          label={label}
          description={description}
        />
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {valueLabel}
        </span>
      </div>
      <Slider
        id={id}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
      />
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours % 24 === 0) {
    return `${hours / 24} 天`;
  }

  return `${hours} 小时`;
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) {
    return "不提前";
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} 小时`;
  }

  return `${minutes} 分钟`;
}
