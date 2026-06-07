import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { themeLabels, type ThemePreference } from "@/domain/theme";
import { useThemeStore } from "@/state/theme";

const icons: Record<ThemePreference, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle() {
  const preference = useThemeStore((state) => state.preference);
  const cyclePreference = useThemeStore((state) => state.cyclePreference);
  const Icon = icons[preference];

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cyclePreference}
      title={`主题：${themeLabels[preference]}（点击切换）`}
      aria-label={`切换主题，当前：${themeLabels[preference]}`}
    >
      <Icon />
    </Button>
  );
}
