export interface BricsCountryInfo {
  name: string;
  iso2: string;
  iso3: string;
  flag: string;
  openaqCountryId?: number;
  center: { lat: number; lng: number };
  zoom: number;
  majorCities: Array<{ city: string; state?: string; lat: number; lng: number }>;
}

export const BRICS_COUNTRIES_CONFIG: BricsCountryInfo[] = [
  {
    name: "Brazil",
    iso2: "BR",
    iso3: "BRA",
    flag: "🇧🇷",
    openaqCountryId: 45,
    center: { lat: -10.8, lng: -52.9 },
    zoom: 4,
    majorCities: [
      { city: "São Paulo", state: "São Paulo", lat: -23.5505, lng: -46.6333 },
      { city: "Rio de Janeiro", state: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
      { city: "Brasília", state: "Distrito Federal", lat: -15.7975, lng: -47.8919 },
      { city: "Salvador", state: "Bahia", lat: -12.9777, lng: -38.5016 },
      { city: "Fortaleza", state: "Ceará", lat: -3.7319, lng: -38.5267 },
      { city: "Belo Horizonte", state: "Minas Gerais", lat: -19.9167, lng: -43.9345 },
      { city: "Manaus", state: "Amazonas", lat: -3.1190, lng: -60.0217 },
      { city: "Curitiba", state: "Paraná", lat: -25.4290, lng: -49.2671 },
      { city: "Recife", state: "Pernambuco", lat: -8.0476, lng: -34.8770 },
      { city: "Porto Alegre", state: "Rio Grande do Sul", lat: -30.0346, lng: -51.2177 }
    ]
  },
  {
    name: "Russia",
    iso2: "RU",
    iso3: "RUS",
    flag: "🇷🇺",
    openaqCountryId: 48,
    center: { lat: 61.5, lng: 105.3 },
    zoom: 3,
    majorCities: [
      { city: "Moscow", state: "Moscow", lat: 55.7558, lng: 37.6173 },
      { city: "Saint Petersburg", state: "Saint Petersburg", lat: 59.9343, lng: 30.3351 },
      { city: "Novosibirsk", state: "Novosibirsk Oblast", lat: 55.0084, lng: 82.9357 },
      { city: "Yekaterinburg", state: "Sverdlovsk Oblast", lat: 56.8389, lng: 60.6057 },
      { city: "Kazan", state: "Tatarstan", lat: 55.8304, lng: 49.0661 },
      { city: "Nizhny Novgorod", state: "Nizhny Novgorod Oblast", lat: 56.2965, lng: 43.9361 },
      { city: "Chelyabinsk", state: "Chelyabinsk Oblast", lat: 55.1644, lng: 61.4368 },
      { city: "Samara", state: "Samara Oblast", lat: 53.2415, lng: 50.2212 },
      { city: "Omsk", state: "Omsk Oblast", lat: 54.9885, lng: 73.3242 },
      { city: "Rostov-on-Don", state: "Rostov Oblast", lat: 47.2357, lng: 39.7015 }
    ]
  },
  {
    name: "India",
    iso2: "IN",
    iso3: "IND",
    flag: "🇮🇳",
    openaqCountryId: 9,
    center: { lat: 22.9, lng: 79.1 },
    zoom: 5,
    majorCities: [
      { city: "Delhi", state: "Delhi", lat: 28.6139, lng: 77.2090 },
      { city: "Mumbai", state: "Maharashtra", lat: 19.0760, lng: 72.8777 },
      { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
      { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
      { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
      { city: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867 },
      { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
      { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
      { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
      { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
      { city: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lng: 80.3319 },
      { city: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
      { city: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
      { city: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
      { city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
      { city: "Srinagar", state: "Jammu and Kashmir", lat: 34.0837, lng: 74.7973 },
      { city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
      { city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
      { city: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
      { city: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lng: 83.2185 }
    ]
  },
  {
    name: "China",
    iso2: "CN",
    iso3: "CHN",
    flag: "🇨🇳",
    openaqCountryId: 10,
    center: { lat: 35.9, lng: 104.2 },
    zoom: 4,
    majorCities: [
      { city: "Beijing", state: "Beijing", lat: 39.9042, lng: 116.4074 },
      { city: "Shanghai", state: "Shanghai", lat: 31.2304, lng: 121.4737 },
      { city: "Guangzhou", state: "Guangdong", lat: 23.1291, lng: 113.2644 },
      { city: "Shenzhen", state: "Guangdong", lat: 22.5431, lng: 114.0579 },
      { city: "Chengdu", state: "Sichuan", lat: 30.5728, lng: 104.0668 },
      { city: "Wuhan", state: "Hubei", lat: 30.5928, lng: 114.3055 },
      { city: "Xi'an", state: "Shaanxi", lat: 34.3416, lng: 108.9398 },
      { city: "Chongqing", state: "Chongqing", lat: 29.5630, lng: 106.5516 },
      { city: "Tianjin", state: "Tianjin", lat: 39.3434, lng: 117.3616 },
      { city: "Hangzhou", state: "Zhejiang", lat: 30.2741, lng: 120.1551 },
      { city: "Nanjing", state: "Jiangsu", lat: 32.0603, lng: 118.7969 }
    ]
  },
  {
    name: "South Africa",
    iso2: "ZA",
    iso3: "ZAF",
    flag: "🇿🇦",
    openaqCountryId: 37,
    center: { lat: -30.6, lng: 22.9 },
    zoom: 5,
    majorCities: [
      { city: "Johannesburg", state: "Gauteng", lat: -26.2041, lng: 28.0473 },
      { city: "Cape Town", state: "Western Cape", lat: -33.9249, lng: 18.4241 },
      { city: "Durban", state: "KwaZulu-Natal", lat: -29.8587, lng: 31.0218 },
      { city: "Pretoria", state: "Gauteng", lat: -25.7479, lng: 28.2293 },
      { city: "Port Elizabeth", state: "Eastern Cape", lat: -33.9608, lng: 25.6022 },
      { city: "Bloemfontein", state: "Free State", lat: -29.0852, lng: 26.1596 },
      { city: "East London", state: "Eastern Cape", lat: -33.0153, lng: 27.9116 },
      { city: "Polokwane", state: "Limpopo", lat: -23.9045, lng: 29.4688 },
      { city: "Nelspruit", state: "Mpumalanga", lat: -25.4753, lng: 30.9694 }
    ]
  },
  {
    name: "Egypt",
    iso2: "EG",
    iso3: "EGY",
    flag: "🇪🇬",
    openaqCountryId: 162,
    center: { lat: 26.8, lng: 30.8 },
    zoom: 6,
    majorCities: [
      { city: "Cairo", state: "Cairo", lat: 30.0444, lng: 31.2357 },
      { city: "Alexandria", state: "Alexandria", lat: 31.2001, lng: 29.9187 },
      { city: "Giza", state: "Giza", lat: 30.0131, lng: 31.2089 },
      { city: "Port Said", state: "Port Said", lat: 31.2653, lng: 32.3019 },
      { city: "Suez", state: "Suez", lat: 29.9668, lng: 32.5498 },
      { city: "Mansoura", state: "Dakahlia", lat: 31.0409, lng: 31.3785 },
      { city: "Tanta", state: "Gharbia", lat: 30.7865, lng: 31.0004 },
      { city: "Asyut", state: "Asyut", lat: 27.1801, lng: 31.1837 },
      { city: "Luxor", state: "Luxor", lat: 25.6872, lng: 32.6396 },
      { city: "Aswan", state: "Aswan", lat: 24.0889, lng: 32.8998 }
    ]
  },
  {
    name: "Ethiopia",
    iso2: "ET",
    iso3: "ETH",
    flag: "🇪🇹",
    openaqCountryId: 14,
    center: { lat: 9.1, lng: 40.5 },
    zoom: 6,
    majorCities: [
      { city: "Addis Ababa", state: "Addis Ababa", lat: 9.0320, lng: 38.7480 },
      { city: "Dire Dawa", state: "Dire Dawa", lat: 9.5931, lng: 41.8661 },
      { city: "Mekelle", state: "Tigray", lat: 13.4967, lng: 39.4753 },
      { city: "Gondar", state: "Amhara", lat: 12.6000, lng: 37.4667 },
      { city: "Bahir Dar", state: "Amhara", lat: 11.5936, lng: 37.3908 },
      { city: "Hawassa", state: "Sidama", lat: 7.0504, lng: 38.4695 },
      { city: "Jimma", state: "Oromia", lat: 7.6734, lng: 36.8344 },
      { city: "Dessie", state: "Amhara", lat: 11.1333, lng: 39.6333 },
      { city: "Adama", state: "Oromia", lat: 8.5400, lng: 39.2700 }
    ]
  },
  {
    name: "Indonesia",
    iso2: "ID",
    iso3: "IDN",
    flag: "🇮🇩",
    openaqCountryId: 1,
    center: { lat: -2.5, lng: 118.0 },
    zoom: 5,
    majorCities: [
      { city: "Jakarta", state: "Jakarta", lat: -6.2088, lng: 106.8456 },
      { city: "Surabaya", state: "East Java", lat: -7.2575, lng: 112.7521 },
      { city: "Bandung", state: "West Java", lat: -6.9175, lng: 107.6191 },
      { city: "Medan", state: "North Sumatra", lat: 3.5952, lng: 98.6722 },
      { city: "Semarang", state: "Central Java", lat: -6.9667, lng: 110.4167 },
      { city: "Palembang", state: "South Sumatra", lat: -2.9909, lng: 104.7566 },
      { city: "Makassar", state: "South Sulawesi", lat: -5.1477, lng: 119.4327 },
      { city: "Denpasar", state: "Bali", lat: -8.6705, lng: 115.2126 },
      { city: "Yogyakarta", state: "Yogyakarta", lat: -7.7956, lng: 110.3695 }
    ]
  },
  {
    name: "Iran",
    iso2: "IR",
    iso3: "IRN",
    flag: "🇮🇷",
    center: { lat: 32.4, lng: 53.7 },
    zoom: 6,
    majorCities: [
      { city: "Tehran", state: "Tehran", lat: 35.6892, lng: 51.3890 },
      { city: "Mashhad", state: "Razavi Khorasan", lat: 36.2972, lng: 59.6067 },
      { city: "Isfahan", state: "Isfahan", lat: 32.6546, lng: 51.6680 },
      { city: "Karaj", state: "Alborz", lat: 35.8400, lng: 50.9391 },
      { city: "Shiraz", state: "Fars", lat: 29.5918, lng: 52.5837 },
      { city: "Tabriz", state: "East Azerbaijan", lat: 38.0800, lng: 46.2919 },
      { city: "Qom", state: "Qom", lat: 34.6401, lng: 50.8764 },
      { city: "Ahvaz", state: "Khuzestan", lat: 31.3183, lng: 48.6706 },
      { city: "Kermanshah", state: "Kermanshah", lat: 34.3277, lng: 47.0778 },
      { city: "Rasht", state: "Gilan", lat: 37.2808, lng: 49.5832 }
    ]
  },
  {
    name: "United Arab Emirates",
    iso2: "AE",
    iso3: "ARE",
    flag: "🇦🇪",
    openaqCountryId: 59,
    center: { lat: 24.3, lng: 54.4 },
    zoom: 7,
    majorCities: [
      { city: "Dubai", state: "Dubai", lat: 25.2048, lng: 55.2708 },
      { city: "Abu Dhabi", state: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
      { city: "Sharjah", state: "Sharjah", lat: 25.3463, lng: 55.4209 },
      { city: "Al Ain", state: "Abu Dhabi", lat: 24.2075, lng: 55.7447 },
      { city: "Ajman", state: "Ajman", lat: 25.4052, lng: 55.5136 },
      { city: "Ras Al Khaimah", state: "Ras Al Khaimah", lat: 25.6741, lng: 55.9804 },
      { city: "Fujairah", state: "Fujairah", lat: 25.1288, lng: 56.3265 }
    ]
  },
  {
    name: "Saudi Arabia",
    iso2: "SA",
    iso3: "SAU",
    flag: "🇸🇦",
    openaqCountryId: 106,
    center: { lat: 23.9, lng: 45.1 },
    zoom: 6,
    majorCities: [
      { city: "Riyadh", state: "Riyadh", lat: 24.7136, lng: 46.6753 },
      { city: "Jeddah", state: "Makkah", lat: 21.4858, lng: 39.1925 },
      { city: "Mecca", state: "Makkah", lat: 21.3891, lng: 39.8579 },
      { city: "Medina", state: "Al Madinah", lat: 24.5247, lng: 39.5692 },
      { city: "Dammam", state: "Eastern Province", lat: 26.4207, lng: 50.0888 },
      { city: "Khobar", state: "Eastern Province", lat: 26.2172, lng: 50.1971 },
      { city: "Tabuk", state: "Tabuk", lat: 28.3835, lng: 36.5662 },
      { city: "Buraidah", state: "Al-Qassim", lat: 26.3260, lng: 43.9750 },
      { city: "Khamis Mushait", state: "Asir", lat: 18.3000, lng: 42.7333 },
      { city: "Abha", state: "Asir", lat: 18.2164, lng: 42.5053 }
    ]
  }
];

export function findBricsCountry(query: string | undefined): BricsCountryInfo | undefined {
  if (!query) return undefined;
  const q = query.trim().toUpperCase();
  return BRICS_COUNTRIES_CONFIG.find(
    (c) =>
      c.iso2.toUpperCase() === q ||
      c.iso3.toUpperCase() === q ||
      c.name.toUpperCase() === q
  );
}
