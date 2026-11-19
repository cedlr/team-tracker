export type SiteId = "web" | "docs" | "status";
export type MetricKey = "visitors" | "pageviews" | "signups" | "bounce" | "duration";
export type Dim = "page" | "entry" | "source" | "campaign" | "country" | "city" | "device" | "browser" | "os";
export type LogoId = "google" | "x" | "github" | "linkedin" | "youtube" | "bluesky" | "substack" | "hackernews" | "direct" | "web";
export type RangeKey = "7d" | "30d" | "90d" | "mtd" | "lastMonth" | "custom";

export interface Row {
  id: string;
  label: string;
  /** Fraction of the site's visitors who match this row. */
  share: number;
  logo?: LogoId;
  /** Country code for countries, and the country of a city. */
  code?: string;
  conv?: number;
  bounce?: number;
  duration?: number;
}

export interface Filter { dim: Dim; id: string }

export interface Metric { key: MetricKey; label: string; unit: "count" | "percent" | "seconds"; lowerIsBetter?: boolean }

export const metrics: Metric[] = [
  { key: "visitors", label: "Visitors", unit: "count" },
  { key: "pageviews", label: "Page views", unit: "count" },
  { key: "signups", label: "Signups", unit: "count" },
  { key: "bounce", label: "Bounce rate", unit: "percent", lowerIsBetter: true },
  { key: "duration", label: "Visit duration", unit: "seconds" },
];

export const dimLabel: Record<Dim, string> = {
  page: "Page", entry: "Entry page", source: "Source", campaign: "Campaign", country: "Country", city: "City", device: "Device", browser: "Browser", os: "OS",
};

export interface Site { id: SiteId; name: string; detail: string; base: number; growth: number; ppv: number; conv: number; bounce: number; duration: number; weekend: number }

export const sites: Site[] = [
  { id: "web", name: "halden.io", detail: "Marketing site", base: 1380, growth: 2.1, ppv: 2.9, conv: 3.6, bounce: 41, duration: 148, weekend: .74 },
  { id: "docs", name: "docs.halden.io", detail: "Developer docs", base: 760, growth: 1.4, ppv: 4.6, conv: 1.1, bounce: 29, duration: 262, weekend: .52 },
  { id: "status", name: "status.halden.io", detail: "Status page", base: 210, growth: .3, ppv: 1.6, conv: .2, bounce: 63, duration: 71, weekend: .86 },
];

const pagesBySite: Record<SiteId, Row[]> = {
  web: [
    { id: "/", label: "/", share: .58 },
    { id: "/pricing", label: "/pricing", share: .27, conv: 2.1, bounce: .7 },
    { id: "/product/invoicing", label: "/product/invoicing", share: .16, conv: 1.3 },
    { id: "/signup", label: "/signup", share: .12, conv: 4.2, bounce: .4 },
    { id: "/blog/net-30-is-dead", label: "/blog/net-30-is-dead", share: .094, conv: .4, bounce: 1.5, duration: 1.6 },
    { id: "/customers", label: "/customers", share: .081, conv: 1.2 },
    { id: "/changelog", label: "/changelog", share: .066, duration: 1.3 },
    { id: "/integrations/stripe", label: "/integrations/stripe", share: .052, conv: 1.4 },
    { id: "/blog/eu-vat-rules-2027", label: "/blog/eu-vat-rules-2027", share: .044, conv: .5, bounce: 1.4, duration: 1.7 },
    { id: "/about", label: "/about", share: .031 },
    { id: "/careers", label: "/careers", share: .024, conv: .1 },
    { id: "/security", label: "/security", share: .019, conv: 1.6 },
  ],
  docs: [
    { id: "/", label: "/", share: .46 },
    { id: "/quickstart", label: "/quickstart", share: .31, conv: 1.8 },
    { id: "/api/invoices", label: "/api/invoices", share: .22, duration: 1.3 },
    { id: "/api/webhooks", label: "/api/webhooks", share: .17, duration: 1.4 },
    { id: "/guides/recurring-billing", label: "/guides/recurring-billing", share: .12, duration: 1.5 },
    { id: "/sdks/node", label: "/sdks/node", share: .1 },
    { id: "/api/authentication", label: "/api/authentication", share: .089 },
    { id: "/guides/tax", label: "/guides/tax", share: .061, duration: 1.4 },
    { id: "/changelog", label: "/changelog", share: .052 },
    { id: "/sdks/python", label: "/sdks/python", share: .047 },
    { id: "/errors", label: "/errors", share: .038, bounce: .8 },
    { id: "/guides/migrate-from-stripe-billing", label: "/guides/migrate-from-stripe-billing", share: .029, conv: 2.4 },
  ],
  status: [
    { id: "/", label: "/", share: .81 },
    { id: "/incidents/2026-11-04-api-latency", label: "/incidents/2026-11-04-api-latency", share: .24, duration: 1.4 },
    { id: "/history", label: "/history", share: .12 },
    { id: "/incidents/2026-10-21-webhook-delays", label: "/incidents/2026-10-21-webhook-delays", share: .09 },
    { id: "/subscribe", label: "/subscribe", share: .046, conv: 6 },
    { id: "/uptime", label: "/uptime", share: .041 },
  ],
};

const entryBySite: Record<SiteId, Row[]> = {
  web: [
    { id: "/", label: "/", share: .44 },
    { id: "/blog/net-30-is-dead", label: "/blog/net-30-is-dead", share: .13, conv: .4, bounce: 1.5 },
    { id: "/pricing", label: "/pricing", share: .11, conv: 2.1 },
    { id: "/product/invoicing", label: "/product/invoicing", share: .07, conv: 1.3 },
    { id: "/blog/eu-vat-rules-2027", label: "/blog/eu-vat-rules-2027", share: .05, conv: .5, bounce: 1.4 },
    { id: "/integrations/stripe", label: "/integrations/stripe", share: .04, conv: 1.4 },
    { id: "/customers", label: "/customers", share: .03 },
    { id: "/changelog", label: "/changelog", share: .025 },
  ],
  docs: [
    { id: "/quickstart", label: "/quickstart", share: .29, conv: 1.8 },
    { id: "/", label: "/", share: .24 },
    { id: "/api/webhooks", label: "/api/webhooks", share: .12 },
    { id: "/api/invoices", label: "/api/invoices", share: .1 },
    { id: "/errors", label: "/errors", share: .06 },
    { id: "/guides/migrate-from-stripe-billing", label: "/guides/migrate-from-stripe-billing", share: .04, conv: 2.4 },
  ],
  status: [
    { id: "/", label: "/", share: .71 },
    { id: "/incidents/2026-11-04-api-latency", label: "/incidents/2026-11-04-api-latency", share: .19 },
    { id: "/incidents/2026-10-21-webhook-delays", label: "/incidents/2026-10-21-webhook-delays", share: .07 },
  ],
};

const sources: Row[] = [
  { id: "direct", label: "Direct", share: .36, logo: "direct" },
  { id: "google", label: "Google", share: .27, logo: "google", conv: 1.2, bounce: .9 },
  { id: "x", label: "X", share: .085, logo: "x", conv: .6, bounce: 1.25 },
  { id: "hackernews", label: "Hacker News", share: .062, logo: "hackernews", conv: .5, bounce: 1.35, duration: .8 },
  { id: "github", label: "GitHub", share: .048, logo: "github", conv: 1.4, duration: 1.3 },
  { id: "linkedin", label: "LinkedIn", share: .041, logo: "linkedin", conv: 1.1 },
  { id: "substack", label: "Substack", share: .033, logo: "substack", conv: 1.6, duration: 1.4 },
  { id: "youtube", label: "YouTube", share: .022, logo: "youtube", duration: 1.2 },
  { id: "bluesky", label: "Bluesky", share: .018, logo: "bluesky", conv: .8 },
  { id: "chatgpt.com", label: "chatgpt.com", share: .015, logo: "web", conv: 1.9 },
  { id: "producthunt.com", label: "producthunt.com", share: .012, logo: "web", bounce: 1.2 },
];

const campaigns: Row[] = [
  { id: "launch-week-26", label: "launch-week-26", share: .048, conv: 1.5 },
  { id: "bf-early-access", label: "bf-early-access", share: .021, conv: 2.2 },
  { id: "halden-weekly-nov", label: "halden-weekly-nov", share: .019, conv: 1.6 },
  { id: "x-ads-q4", label: "x-ads-q4", share: .017, conv: .7, bounce: 1.3 },
  { id: "linkedin-cfo-series", label: "linkedin-cfo-series", share: .011, conv: 1.3 },
  { id: "partner-stripe", label: "partner-stripe", share: .008, conv: 1.8 },
];

const countries: Row[] = [
  { id: "US", label: "United States", code: "US", share: .34 },
  { id: "DE", label: "Germany", code: "DE", share: .11, conv: 1.1 },
  { id: "GB", label: "United Kingdom", code: "GB", share: .09 },
  { id: "CH", label: "Switzerland", code: "CH", share: .06, conv: 1.3 },
  { id: "FR", label: "France", code: "FR", share: .05 },
  { id: "NL", label: "Netherlands", code: "NL", share: .04, conv: 1.2 },
  { id: "CA", label: "Canada", code: "CA", share: .04 },
  { id: "IN", label: "India", code: "IN", share: .035, conv: .6, bounce: 1.2 },
  { id: "AU", label: "Australia", code: "AU", share: .025 },
  { id: "SE", label: "Sweden", code: "SE", share: .02, conv: 1.2 },
  { id: "ES", label: "Spain", code: "ES", share: .018 },
  { id: "BR", label: "Brazil", code: "BR", share: .015, conv: .7 },
];

const cities: Row[] = [
  { id: "san-francisco", label: "San Francisco", code: "US", share: .07, conv: 1.2 },
  { id: "new-york", label: "New York", code: "US", share: .065 },
  { id: "london", label: "London", code: "GB", share: .055 },
  { id: "berlin", label: "Berlin", code: "DE", share: .04, conv: 1.1 },
  { id: "zurich", label: "Zürich", code: "CH", share: .032, conv: 1.3 },
  { id: "austin", label: "Austin", code: "US", share: .03 },
  { id: "paris", label: "Paris", code: "FR", share: .028 },
  { id: "seattle", label: "Seattle", code: "US", share: .028 },
  { id: "amsterdam", label: "Amsterdam", code: "NL", share: .025 },
  { id: "munich", label: "Munich", code: "DE", share: .022 },
  { id: "toronto", label: "Toronto", code: "CA", share: .02 },
  { id: "bengaluru", label: "Bengaluru", code: "IN", share: .018 },
  { id: "hamburg", label: "Hamburg", code: "DE", share: .016 },
  { id: "sydney", label: "Sydney", code: "AU", share: .014 },
  { id: "geneva", label: "Geneva", code: "CH", share: .012 },
  { id: "manchester", label: "Manchester", code: "GB", share: .012 },
  { id: "stockholm", label: "Stockholm", code: "SE", share: .011 },
  { id: "madrid", label: "Madrid", code: "ES", share: .009 },
  { id: "lyon", label: "Lyon", code: "FR", share: .008 },
  { id: "sao-paulo", label: "São Paulo", code: "BR", share: .008 },
];

const devices: Row[] = [
  { id: "desktop", label: "Desktop", share: .63, conv: 1.3, bounce: .85, duration: 1.2 },
  { id: "mobile", label: "Mobile", share: .34, conv: .55, bounce: 1.3, duration: .7 },
  { id: "tablet", label: "Tablet", share: .03, conv: .8 },
];

const browsers: Row[] = [
  { id: "chrome", label: "Chrome", share: .52 },
  { id: "safari", label: "Safari", share: .27 },
  { id: "firefox", label: "Firefox", share: .07, conv: 1.1 },
  { id: "edge", label: "Edge", share: .06 },
  { id: "arc", label: "Arc", share: .05, conv: 1.4 },
  { id: "brave", label: "Brave", share: .02 },
  { id: "samsung", label: "Samsung Internet", share: .01, conv: .6 },
];

const oses: Row[] = [
  { id: "macos", label: "macOS", share: .46, conv: 1.3 },
  { id: "windows", label: "Windows", share: .24 },
  { id: "ios", label: "iOS", share: .19, conv: .6, bounce: 1.25 },
  { id: "android", label: "Android", share: .08, conv: .5, bounce: 1.3 },
  { id: "linux", label: "Linux", share: .03, conv: 1.2 },
];

export function rowsFor(site: SiteId, dim: Dim): Row[] {
  switch (dim) {
    case "page": return pagesBySite[site];
    case "entry": return entryBySite[site];
    case "source": return sources;
    case "campaign": return campaigns;
    case "country": return countries;
    case "city": return cities;
    case "device": return devices;
    case "browser": return browsers;
    case "os": return oses;
  }
}

/* ------------------------------------------------------------------ Daily series */

export const END = new Date(2026, 10, 11);
export const TOTAL_DAYS = 200;
const DAY = 864e5;
export const dateAt = (index: number) => new Date(END.getFullYear(), END.getMonth(), END.getDate() - (TOTAL_DAYS - 1 - index));
const indexOf = (date: Date) => TOTAL_DAYS - 1 - Math.round((END.getTime() - date.getTime()) / DAY);

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}
/** 0 to 1, stable for a key. */
export const rand = (key: string) => (hash(key) % 10000) / 10000;
const wave = (i: number, seed: number) => Math.sin(i * .9 + seed) * .5 + Math.sin(i * .23 + seed * 2) * .35 + Math.sin(i * 2.1 + seed * 3) * .15;

/** Launch week (3 to 7 Nov) and a Hacker News front page day (21 Oct) shape the marketing series. */
const events: { date: Date; lift: number; decay: number; site: SiteId[] }[] = [
  { date: new Date(2026, 9, 21), lift: 1.3, decay: .45, site: ["web", "docs"] },
  { date: new Date(2026, 10, 3), lift: .75, decay: .72, site: ["web", "docs"] },
  { date: new Date(2026, 10, 4), lift: 2.6, decay: .35, site: ["status"] },
  { date: new Date(2026, 9, 21), lift: 1.4, decay: .4, site: ["status"] },
];

export interface DayPoint { visitors: number; pageviews: number; signups: number; bounce: number; duration: number }

export interface Profile { factor: number; conv: number; bounce: number; duration: number; ppv: number; seed: number; key: string }

const siteSeries = new Map<SiteId, DayPoint[]>();
function baseSeries(siteId: SiteId) {
  const cached = siteSeries.get(siteId);
  if (cached) return cached;
  const site = sites.find(s => s.id === siteId)!;
  const seed = rand(siteId) * 10;
  const series = Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const weekday = dateAt(i).getDay();
    const weekend = weekday === 0 || weekday === 6 ? site.weekend : 1;
    let lift = 1;
    for (const event of events) {
      if (!event.site.includes(siteId)) continue;
      const since = i - indexOf(event.date);
      if (since >= 0) lift += event.lift * event.decay ** since;
    }
    const visitors = (site.base + i * site.growth) * weekend * lift * (1 + wave(i, seed) * .09);
    const conv = site.conv * (1 + wave(i, seed + 4) * .1) * (lift > 1.4 ? .82 : 1);
    return {
      visitors,
      pageviews: visitors * site.ppv * (1 + wave(i, seed + 2) * .05),
      signups: visitors * conv / 100,
      bounce: site.bounce * (1 + wave(i, seed + 7) * .05) * (lift > 1.4 ? 1.12 : 1),
      duration: site.duration * (1 + wave(i, seed + 9) * .07),
    };
  });
  siteSeries.set(siteId, series);
  return series;
}

/** How a set of filters narrows and reshapes the traffic. Values in one dimension are ORed, dimensions are ANDed. */
export function profileFor(site: SiteId, filters: Filter[], excludeInternal: boolean): Profile {
  let factor = excludeInternal ? .968 : 1, conv = 1, bounce = 1, duration = 1, ppv = 1;
  const dims = [...new Set(filters.map(f => f.dim))];
  for (const dim of dims) {
    const rows = rowsFor(site, dim).filter(row => filters.some(f => f.dim === dim && f.id === row.id));
    const share = rows.reduce((sum, row) => sum + row.share, 0);
    if (!share) continue;
    factor *= Math.min(1, dim === "page" ? share * (rows.length > 1 ? .85 : 1) : share);
    const avg = (pick: (row: Row) => number | undefined) => rows.reduce((sum, row) => sum + (pick(row) ?? 1) * row.share, 0) / share;
    conv *= avg(r => r.conv);
    bounce *= avg(r => r.bounce);
    duration *= avg(r => r.duration);
    if (dim === "page") ppv *= .55;
  }
  bounce = Math.min(bounce, 1.9);
  const key = filters.map(f => `${f.dim}:${f.id}`).sort().join("|");
  return { factor, conv, bounce, duration, ppv, seed: (hash(site + key) % 1000) / 100, key };
}

export function seriesFor(site: SiteId, profile: Profile, variant = ""): DayPoint[] {
  const base = baseSeries(site);
  const filtered = profile.key !== "" || variant !== "";
  const seed = profile.seed + (variant ? rand(variant) * 9 : 0);
  return base.map((day, i) => {
    const shape = filtered ? 1 + wave(i, seed) * .14 : 1;
    const visitors = day.visitors * profile.factor * shape;
    return {
      visitors,
      pageviews: visitors * (day.pageviews / day.visitors) * profile.ppv,
      signups: day.signups * profile.factor * shape * profile.conv,
      bounce: Math.min(92, day.bounce * profile.bounce),
      duration: day.duration * profile.duration,
    };
  });
}

/* ------------------------------------------------------------------ Ranges */

export interface RangeSpan { start: number; end: number }

export const rangeOptions: { key: Exclude<RangeKey, "custom">; label: string; short: string }[] = [
  { key: "7d", label: "Last 7 days", short: "7 days" },
  { key: "30d", label: "Last 30 days", short: "30 days" },
  { key: "90d", label: "Last 90 days", short: "90 days" },
  { key: "mtd", label: "Month to date", short: "Nov" },
  { key: "lastMonth", label: "Last month", short: "Oct" },
];

export function spanFor(range: RangeKey, custom?: RangeSpan): RangeSpan {
  const last = TOTAL_DAYS - 1;
  switch (range) {
    case "7d": return { start: last - 6, end: last };
    case "30d": return { start: last - 29, end: last };
    case "90d": return { start: last - 89, end: last };
    case "mtd": return { start: indexOf(new Date(2026, 10, 1)), end: last };
    case "lastMonth": return { start: indexOf(new Date(2026, 9, 1)), end: indexOf(new Date(2026, 9, 31)) };
    case "custom": return custom ?? { start: last - 29, end: last };
  }
}

export const previousSpan = ({ start, end }: RangeSpan): RangeSpan => ({ start: start - (end - start + 1), end: start - 1 });

export function aggregate(days: DayPoint[], key: MetricKey) {
  if (!days.length) return 0;
  if (key === "visitors" || key === "pageviews" || key === "signups") return days.reduce((sum, d) => sum + d[key], 0);
  const weight = days.reduce((sum, d) => sum + d.visitors, 0) || 1;
  return days.reduce((sum, d) => sum + d[key] * d.visitors, 0) / weight;
}

export const slice = (series: DayPoint[], span: RangeSpan) => series.slice(Math.max(0, span.start), span.end + 1);

/* ------------------------------------------------------------------ Breakdowns */

export interface BreakdownRow extends Row { dim: Dim; visitors: number; pageviews: number; signups: number; bounce: number; duration: number; previous: number }

/**
 * Rows for one dimension under the active filters. A filtered dimension keeps only its chosen values; other dimensions
 * shift by a stable jitter per filter set, and cities follow a country filter.
 */
export function breakdown(site: SiteId, dim: Dim, filters: Filter[], totals: { visitors: number; previous: number; ppv: number; bounce: number; duration: number; conv: number }, profileKey: string): BreakdownRow[] {
  let rows = rowsFor(site, dim);
  const own = filters.filter(f => f.dim === dim);
  if (own.length) rows = rows.filter(row => own.some(f => f.id === row.id));
  const countryFilter = filters.filter(f => f.dim === "country").map(f => f.id);
  if (dim === "city" && countryFilter.length) rows = rows.filter(row => countryFilter.includes(row.code ?? ""));
  const jitter = (row: Row) => profileKey ? .62 + rand(profileKey + dim + row.id) * .76 : 1;
  const raw = rows.map(row => row.share * jitter(row));
  const rawSum = raw.reduce((a, b) => a + b, 0) || 1;
  const originalSum = rows.reduce((sum, row) => sum + row.share, 0);
  // Inside a filtered dimension each chosen value's share is relative to the chosen set; cities scale to their countries.
  const scale = own.length ? 1 / Math.max(originalSum, .0001)
    : dim === "city" && countryFilter.length ? 1 / Math.max(.0001, countries.filter(c => countryFilter.includes(c.id)).reduce((s, c) => s + c.share, 0))
    : 1;
  return rows.map((row, i) => {
    const share = own.length ? row.share * scale : (raw[i] / rawSum) * originalSum * scale;
    const visitors = totals.visitors * Math.min(1, share);
    const drift = .88 + rand(row.id + dim + "prev") * .2;
    return {
      ...row,
      dim,
      share: Math.min(1, share),
      visitors,
      previous: totals.previous * Math.min(1, share) * drift,
      pageviews: visitors * (dim === "page" ? 1.34 : totals.ppv),
      signups: visitors * totals.conv * (row.conv ?? 1),
      // A stable per row spread, so rows without a modifier do not all repeat the site average.
      bounce: Math.min(92, totals.bounce * (row.bounce ?? 1) * (.88 + rand(row.id + dim + "bounce") * .24)),
      duration: totals.duration * (row.duration ?? 1) * (.84 + rand(row.id + dim + "time") * .32),
    };
  }).sort((a, b) => b.visitors - a.visitors);
}

/* ------------------------------------------------------------------ Goals */

export interface Goal { id: string; label: string; detail: string; rate: number; per: number; base: "signups" | "visitors" }

export const goals: Goal[] = [
  { id: "signed-up", label: "Signed up", detail: "Account created", rate: 1, per: 1, base: "signups" },
  { id: "invited", label: "Invited a teammate", detail: "From onboarding", rate: .61, per: 1.8, base: "signups" },
  { id: "first-invoice", label: "Sent first invoice", detail: "Within 7 days of signup", rate: .47, per: 1, base: "signups" },
  { id: "checkout", label: "Started checkout", detail: "Plan picker opened", rate: .42, per: 1.3, base: "signups" },
  { id: "upgraded", label: "Upgraded to Pro", detail: "Paid plan started", rate: .18, per: 1, base: "signups" },
  { id: "docs-search", label: "Searched docs", detail: "From the site header", rate: .09, per: 2.4, base: "visitors" },
];

/* ------------------------------------------------------------------ Formatting */

export const countFormat = new Intl.NumberFormat("en-US");
export const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
export const longDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export function formatMetric(metric: Metric, value: number) {
  if (metric.unit === "percent") return value.toFixed(1) + "%";
  if (metric.unit === "seconds") return formatDuration(value);
  return countFormat.format(Math.round(value));
}

export function formatAxis(metric: Metric, value: number) {
  if (metric.unit === "percent") return value.toFixed(0) + "%";
  if (metric.unit === "seconds") return formatDuration(value);
  return compactFormat.format(value);
}

export function spanLabel(span: RangeSpan) {
  return `${dayFormat.format(dateAt(span.start))} to ${dayFormat.format(dateAt(span.end))}`;
}
