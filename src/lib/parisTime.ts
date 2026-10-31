/** midnight in Paris on that day (a French release: shops open that morning), as a timestamp */
export function parisMidnight(day: string) {
  const utc = Date.parse(`${day}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date(utc)));
  return utc - hour * 3_600_000;
}

/** whole days left until that day's Paris midnight: the countdown's first tile, the same on the server and the phone */
export const daysLeft = (day: string, now = Date.now()) => Math.max(0, Math.floor((parisMidnight(day) - now) / 86_400_000));
