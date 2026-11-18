export function getGreeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date)
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
