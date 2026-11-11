
const HAS_TZ_DESIGNATOR = /(Z|[+-]\d{2}:?\d{2})$/;

export function parseServerDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = HAS_TZ_DESIGNATOR.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
}

function formatParts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ru-RU", { ...options, timeZone }).format(date);
}

export function formatServerDate(value: string | null | undefined, timeZone: string): string {
  const date = parseServerDateTime(value);
  if (!date) return "—";
  return formatParts(date, timeZone, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatServerDateTime(value: string | null | undefined, timeZone: string): string {
  const date = parseServerDateTime(value);
  if (!date) return "—";
  const datePart = formatParts(date, timeZone, { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = formatParts(date, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${datePart}, ${timePart}`;
}

export function formatServerTime(value: string | null | undefined, timeZone: string): string {
  const date = parseServerDateTime(value);
  if (!date) return "—";
  return formatParts(date, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function formatInstant(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return formatParts(date, timeZone, options);
}

export function formatNowDate(timeZone: string): string {
  return formatServerDate(new Date().toISOString(), timeZone);
}

export function formatNowDateTime(timeZone: string): string {
  return formatServerDateTime(new Date().toISOString(), timeZone);
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - instant.getTime();
}

function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const target = Date.UTC(year, month, day, hour, minute, second);
  const offset1 = getTimeZoneOffsetMs(new Date(target), timeZone);
  const candidate = target - offset1;
  const offset2 = getTimeZoneOffsetMs(new Date(candidate), timeZone);
  return new Date(target - offset2);
}

export function toServerDateTimeString(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export function localDateOnlyToServerString(dateString: string, timeZone: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return toServerDateTimeString(zonedWallClockToUtc(y, m - 1, d, 0, 0, 0, timeZone));
}

export function localDateTimeInputToServerString(value: string, timeZone: string): string {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, mi] = (timePart || "00:00").split(":").map(Number);
  return toServerDateTimeString(zonedWallClockToUtc(y, m - 1, d, h, mi, 0, timeZone));
}

export function instantToLocalDateTimeInputValue(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export interface TimezoneOption {
  value: string;
  cities: string;
  code: string;
}

export const RU_BY_TIMEZONES: TimezoneOption[] = [
  { value: "Europe/Kaliningrad", cities: "Калининград", code: "МСК−1" },
  { value: "Europe/Moscow", cities: "Москва, Санкт-Петербург", code: "МСК" },
  { value: "Europe/Minsk", cities: "Минск", code: "МСК" },
  { value: "Europe/Samara", cities: "Самара, Ижевск", code: "МСК+1" },
  { value: "Asia/Yekaterinburg", cities: "Екатеринбург, Пермь, Тюмень, Челябинск", code: "МСК+2" },
  { value: "Asia/Omsk", cities: "Омск", code: "МСК+3" },
  { value: "Asia/Krasnoyarsk", cities: "Красноярск, Новосибирск, Барнаул, Томск, Кемерово", code: "МСК+4" },
  { value: "Asia/Irkutsk", cities: "Иркутск, Улан-Удэ", code: "МСК+5" },
  { value: "Asia/Yakutsk", cities: "Якутск, Чита", code: "МСК+6" },
  { value: "Asia/Vladivostok", cities: "Владивосток, Хабаровск", code: "МСК+7" },
  { value: "Asia/Magadan", cities: "Магадан, Южно-Сахалинск", code: "МСК+8" },
  { value: "Asia/Kamchatka", cities: "Петропавловск-Камчатский, Анадырь", code: "МСК+9" },
];

export function getTimezoneOption(timeZone: string): TimezoneOption | undefined {
  return RU_BY_TIMEZONES.find((tz) => tz.value === timeZone);
}

function formatUtcOffset(timeZone: string): string {
  try {
    const minutes = Math.round(getTimeZoneOffsetMs(new Date(), timeZone) / 60000);
    const sign = minutes < 0 ? "−" : "+";
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
  } catch {
    return "UTC";
  }
}

export function describeTimezone(timeZone: string): { title: string; code: string } {
  const option = getTimezoneOption(timeZone);
  if (option) return { title: option.cities, code: option.code };
  return { title: timeZone.replace(/_/g, " "), code: formatUtcOffset(timeZone) };
}