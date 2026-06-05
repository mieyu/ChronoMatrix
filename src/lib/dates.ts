import {
  differenceInMilliseconds,
  format,
  formatDistanceToNowStrict,
  isValid,
} from "date-fns";

export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}

export function fromDateTimeLocalValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function formatPlanTime(iso: string | null): string {
  if (!iso) {
    return "未排期";
  }

  const date = new Date(iso);
  return isValid(date) ? format(date, "MM-dd HH:mm") : "时间无效";
}

export function formatTimePressure(referenceAt: string | null, now = new Date()): string {
  if (!referenceAt) {
    return "未排期";
  }

  const date = new Date(referenceAt);

  if (!isValid(date)) {
    return "时间无效";
  }

  const diff = differenceInMilliseconds(date, now);
  const distance = formatDistanceToNowStrict(date);
  return diff < 0 ? `已过期 ${distance}` : `剩余 ${distance}`;
}
