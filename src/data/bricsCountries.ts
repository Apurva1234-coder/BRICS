export type BricsCountry = {
  name: string;
  iso3: string;
  flag: string;
  center: [number, number];
  zoom: number;
  bricsMember: true;
};

const BRICS_COUNTRY_DATA: Omit<BricsCountry, "bricsMember">[] = [
  { name: "Brazil", iso3: "BRA", flag: "🇧🇷", center: [-10.8, -52.9], zoom: 4 },
  { name: "Russia", iso3: "RUS", flag: "🇷🇺", center: [61.5, 105.3], zoom: 3 },
  { name: "India", iso3: "IND", flag: "🇮🇳", center: [22.9, 79.1], zoom: 5 },
  { name: "China", iso3: "CHN", flag: "🇨🇳", center: [35.9, 104.2], zoom: 4 },
  { name: "South Africa", iso3: "ZAF", flag: "🇿🇦", center: [-30.6, 22.9], zoom: 5 },
  { name: "Egypt", iso3: "EGY", flag: "🇪🇬", center: [26.8, 30.8], zoom: 6 },
  { name: "Ethiopia", iso3: "ETH", flag: "🇪🇹", center: [9.1, 40.5], zoom: 6 },
  { name: "Indonesia", iso3: "IDN", flag: "🇮🇩", center: [-2.5, 118.0], zoom: 5 },
  { name: "Iran", iso3: "IRN", flag: "🇮🇷", center: [32.4, 53.7], zoom: 6 },
  { name: "United Arab Emirates", iso3: "ARE", flag: "🇦🇪", center: [24.3, 54.4], zoom: 7 },
  { name: "Saudi Arabia", iso3: "SAU", flag: "🇸🇦", center: [23.9, 45.1], zoom: 6 }
];

export const BRICS_COUNTRIES: BricsCountry[] = BRICS_COUNTRY_DATA.map((country) => ({ ...country, bricsMember: true as const }));

export const BRICS_COUNTRY_BY_ISO = Object.fromEntries(
  BRICS_COUNTRIES.map((country) => [country.iso3, country])
) as Record<string, BricsCountry>;
