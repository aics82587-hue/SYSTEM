export interface Holiday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode?: string;
  fixed?: boolean;
  global?: boolean;
  types?: string[];
}

/**
 * Returns fixed and estimated Philippine national holidays for any given year.
 * Used as fallback if the external Nager API is unreachable.
 */
function getFallbackHolidays(year: number): Holiday[] {
  // Easter Sunday calculation (Meeus/Jones/Butcher algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

  const easterDate = new Date(Date.UTC(year, easterMonth - 1, easterDay));
  const maundyThursday = new Date(easterDate);
  maundyThursday.setUTCDate(easterDate.getUTCDate() - 3);
  const goodFriday = new Date(easterDate);
  goodFriday.setUTCDate(easterDate.getUTCDate() - 2);
  const blackSaturday = new Date(easterDate);
  blackSaturday.setUTCDate(easterDate.getUTCDate() - 1);

  // Last Monday of August for National Heroes Day
  const aug31 = new Date(Date.UTC(year, 7, 31));
  const dayOfWeekAug31 = aug31.getUTCDay(); // 0 = Sun, 1 = Mon...
  const daysToSubtract = (dayOfWeekAug31 + 6) % 7; // days since last Monday
  const heroesDay = new Date(Date.UTC(year, 7, 31 - daysToSubtract));

  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  return [
    { date: `${year}-01-01`, localName: "Bagong Taon", name: "New Year's Day" },
    { date: `${year}-02-25`, localName: "Araw ng Rebolusyon sa EDSA", name: "EDSA Revolution Anniversary" },
    { date: toISO(maundyThursday), localName: "Huwebes Santo", name: "Maundy Thursday" },
    { date: toISO(goodFriday), localName: "Biyernes Santo", name: "Good Friday" },
    { date: toISO(blackSaturday), localName: "Sabado de Gloria", name: "Black Saturday" },
    { date: `${year}-04-09`, localName: "Araw ng Kagitingan", name: "Day of Valor (Araw ng Kagitingan)" },
    { date: `${year}-05-01`, localName: "Araw ng Paggawa", name: "Labor Day" },
    { date: `${year}-06-12`, localName: "Araw ng Kalayaan", name: "Independence Day" },
    { date: `${year}-08-21`, localName: "Araw ng Kabayanihan ni Ninoy Aquino", name: "Ninoy Aquino Day" },
    { date: toISO(heroesDay), localName: "Araw ng mga Bayani", name: "National Heroes Day" },
    { date: `${year}-11-01`, localName: "Undas / Araw ng mga Patay", name: "All Saints' Day" },
    { date: `${year}-11-02`, localName: "Araw ng mga Kaluluwa", name: "All Souls' Day" },
    { date: `${year}-11-30`, localName: "Araw ni Bonifacio", name: "Bonifacio Day" },
    { date: `${year}-12-08`, localName: "Kapistahan ng Kalinis-linisang Paglilihi", name: "Feast of the Immaculate Conception" },
    { date: `${year}-12-24`, localName: "Bisperas ng Pasko", name: "Christmas Eve" },
    { date: `${year}-12-25`, localName: "Araw ng Pasko", name: "Christmas Day" },
    { date: `${year}-12-30`, localName: "Araw ni Rizal", name: "Rizal Day" },
    { date: `${year}-12-31`, localName: "Bisperas ng Bagong Taon", name: "New Year's Eve" },
  ];
}

/**
 * Fetch Philippine holidays from Nager API with reliable fallback.
 */
export async function getPhilippineHolidays(year: number): Promise<Holiday[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`, {
      signal: controller.signal,
      next: { revalidate: 86400 }, // Cache on server for 24 hours
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: Record<string, unknown>) => ({
          date: String(item.date),
          localName: String(item.localName || item.name),
          name: String(item.name || item.localName),
          countryCode: String(item.countryCode || "PH"),
          types: Array.isArray(item.types) ? (item.types as string[]) : [],
        }));
      }
    }
  } catch {
    // Network failure, timeout, or abort — silently fall back
  }

  return getFallbackHolidays(year);
}
