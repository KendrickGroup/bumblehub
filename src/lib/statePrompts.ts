import { CHART_ART_SPORTS, CHART_ART_WX } from "@/lib/radio/chart-art";
import { RANCH_CITY, US_STATE_NAMES } from "@/lib/radio/ranch";
import type { RadioStation } from "@/lib/radio/types";

export type StateLore = {
  nickname: string;
  capital: string;
  landmarks: string[];
};

/** Pictorial-map lore for every US state plus DC. */
export const STATE_LORE: Record<string, StateLore> = {
  AL: {
    nickname: "Heart of Dixie",
    capital: "Montgomery",
    landmarks: [
      "a Saturn V rocket labeled 'HUNTSVILLE' at Huntsville",
      "the iron statue of Vulcan labeled 'VULCAN' at Birmingham",
      "a gulf shrimp boat labeled 'MOBILE BAY' at Mobile",
      "a cotton boll",
      "a yellowhammer bird",
    ],
  },
  AK: {
    nickname: "The Last Frontier",
    capital: "Juneau",
    landmarks: [
      "the snowy peak of Denali labeled 'DENALI'",
      "a totem pole labeled 'SITKA' at Sitka",
      "an oil pipeline labeled 'PIPELINE'",
      "a sled-dog team",
      "a leaping salmon",
    ],
  },
  AZ: {
    nickname: "The Grand Canyon State",
    capital: "Phoenix",
    landmarks: [
      "the Grand Canyon rim labeled 'GRAND CANYON'",
      "Monument Valley mittens labeled 'MONUMENT VALLEY'",
      "Sedona red-rock buttes labeled 'SEDONA'",
      "a saguaro cactus",
      "a roadrunner",
    ],
  },
  AR: {
    nickname: "The Natural State",
    capital: "Little Rock",
    landmarks: [
      "rising steam squiggles labeled 'HOT SPRINGS'",
      "a diamond labeled 'CRATER OF DIAMONDS'",
      "a riverboat on the Arkansas labeled 'MISSISSIPPI'",
      "a razorback hog",
      "a pine tree",
    ],
  },
  CA: {
    nickname: "The Golden State",
    capital: "Sacramento",
    landmarks: [
      "the Golden Gate Bridge labeled 'GOLDEN GATE' at San Francisco",
      "the Hollywood sign labeled 'HOLLYWOOD' at Los Angeles",
      "a cable car labeled 'SAN FRANCISCO'",
      "a California grizzly bear",
      "a towering redwood",
    ],
  },
  CO: {
    nickname: "The Centennial State",
    capital: "Denver",
    landmarks: [
      "snow-capped peaks labeled 'ROCKIES'",
      "cliff dwellings labeled 'MESA VERDE'",
      "red sandstone fins labeled 'GARDEN OF THE GODS'",
      "a bighorn sheep",
      "a columbine blossom",
    ],
  },
  CT: {
    nickname: "The Constitution State",
    capital: "Hartford",
    landmarks: [
      "the Charter Oak labeled 'CHARTER OAK'",
      "a whaling ship labeled 'MYSTIC'",
      "a lighthouse labeled 'NEW LONDON'",
      "a wooden nutmeg",
      "a sperm whale",
    ],
  },
  DE: {
    nickname: "The First State",
    capital: "Dover",
    landmarks: [
      "a colonial courthouse labeled 'NEW CASTLE'",
      "a boardwalk pavilion labeled 'REHOBOTH'",
      "a peach",
      "a blue hen chicken",
    ],
  },
  DC: {
    nickname: "The Nation's Capital",
    capital: "Washington",
    landmarks: [
      "the Capitol dome labeled 'THE CAPITOL'",
      "the Washington Monument obelisk labeled 'WASHINGTON MONUMENT'",
      "the Lincoln Memorial labeled 'LINCOLN MEMORIAL'",
      "cherry blossoms",
      "a bald eagle",
    ],
  },
  FL: {
    nickname: "The Sunshine State",
    capital: "Tallahassee",
    landmarks: [
      "a space shuttle labeled 'CAPE CANAVERAL'",
      "art-deco hotels labeled 'MIAMI BEACH'",
      "a palm cluster labeled 'KEY WEST'",
      "an orange",
      "an alligator",
    ],
  },
  GA: {
    nickname: "The Peach State",
    capital: "Atlanta",
    landmarks: [
      "historic squares labeled 'SAVANNAH' at Savannah",
      "the carved mountain labeled 'STONE MOUNTAIN'",
      "a peanut plant labeled 'PLAINS'",
      "a peach",
      "a live oak draped in Spanish moss",
    ],
  },
  HI: {
    nickname: "The Aloha State",
    capital: "Honolulu",
    landmarks: [
      "Diamond Head crater labeled 'DIAMOND HEAD'",
      "a volcano labeled 'KILAUEA'",
      "a hibiscus flower",
      "a sea turtle",
    ],
  },
  ID: {
    nickname: "The Gem State",
    capital: "Boise",
    landmarks: [
      "a waterfall labeled 'SHOSHONE FALLS'",
      "jagged peaks labeled 'SAWTOOTHS'",
      "cinder cones labeled 'CRATERS OF THE MOON'",
      "a russet potato",
      "a leaping trout",
    ],
  },
  IL: {
    nickname: "Land of Lincoln",
    capital: "Springfield",
    landmarks: [
      "a skyscraper skyline labeled 'CHICAGO' at Chicago",
      "a riverboat labeled 'MISSISSIPPI'",
      "Abraham Lincoln's stovepipe hat",
      "a corn stalk",
    ],
  },
  IN: {
    nickname: "The Hoosier State",
    capital: "Indianapolis",
    landmarks: [
      "a race car labeled 'INDIANAPOLIS'",
      "a covered bridge labeled 'PARKE COUNTY'",
      "a basketball",
      "a limestone block",
    ],
  },
  IA: {
    nickname: "The Hawkeye State",
    capital: "Des Moines",
    landmarks: [
      "a baseball diamond labeled 'FIELD OF DREAMS'",
      "a covered bridge labeled 'MADISON COUNTY'",
      "a corn stalk",
      "a tractor",
    ],
  },
  KS: {
    nickname: "The Sunflower State",
    capital: "Topeka",
    landmarks: [
      "a grain elevator labeled 'WHEAT COUNTRY'",
      "a cowboy labeled 'DODGE CITY' at Dodge City",
      "a sunflower",
      "a bison",
    ],
  },
  KY: {
    nickname: "The Bluegrass State",
    capital: "Frankfort",
    landmarks: [
      "twin spires labeled 'CHURCHILL DOWNS'",
      "a cave mouth labeled 'MAMMOTH CAVE'",
      "a bourbon barrel labeled 'BOURBON'",
      "a thoroughbred horse",
      "a horseshoe",
    ],
  },
  LA: {
    nickname: "The Pelican State",
    capital: "Baton Rouge",
    landmarks: [
      "a jazz trumpet labeled 'NEW ORLEANS' at New Orleans",
      "a steamboat labeled 'MISSISSIPPI'",
      "oak and Spanish moss labeled 'BAYOU'",
      "a pelican",
      "a crawfish",
    ],
  },
  ME: {
    nickname: "The Pine Tree State",
    capital: "Augusta",
    landmarks: [
      "a lighthouse labeled 'PORTLAND HEAD'",
      "rocky peaks labeled 'ACADIA'",
      "a lobster",
      "a moose",
    ],
  },
  MD: {
    nickname: "The Old Line State",
    capital: "Annapolis",
    landmarks: [
      "a skipjack sailboat labeled 'CHESAPEAKE'",
      "a fort and flag labeled 'FORT MCHENRY'",
      "wild ponies labeled 'ASSATEAGUE'",
      "a blue crab",
      "an oriole",
    ],
  },
  MA: {
    nickname: "The Bay State",
    capital: "Boston",
    landmarks: [
      "the Mayflower labeled 'PLYMOUTH'",
      "a lantern labeled 'BOSTON' at Boston",
      "the hooked cape labeled 'CAPE COD'",
      "a codfish",
      "a cranberry bog scoop",
    ],
  },
  MI: {
    nickname: "The Great Lakes State",
    capital: "Lansing",
    landmarks: [
      "a motorcar labeled 'DETROIT' at Detroit",
      "a long bridge labeled 'MACKINAC'",
      "dunes labeled 'SLEEPING BEAR'",
      "a cherry",
      "a Great Lakes freighter",
    ],
  },
  MN: {
    nickname: "The North Star State",
    capital: "Saint Paul",
    landmarks: [
      "lake squiggles labeled '10,000 LAKES'",
      "Paul Bunyan and Babe labeled 'BEMIDJI'",
      "a loon",
      "a canoe",
    ],
  },
  MS: {
    nickname: "The Magnolia State",
    capital: "Jackson",
    landmarks: [
      "a riverboat labeled 'MISSISSIPPI RIVER'",
      "a blues guitar labeled 'DELTA BLUES'",
      "a lighthouse labeled 'BILOXI'",
      "a magnolia blossom",
      "a catfish",
    ],
  },
  MO: {
    nickname: "The Show-Me State",
    capital: "Jefferson City",
    landmarks: [
      "the Gateway Arch labeled 'THE ARCH' at St. Louis",
      "a whitewashed fence labeled 'HANNIBAL'",
      "a mule",
      "a riverboat",
    ],
  },
  MT: {
    nickname: "Big Sky Country",
    capital: "Helena",
    landmarks: [
      "glacier peaks labeled 'GLACIER'",
      "a battlefield marker labeled 'LITTLE BIGHORN'",
      "a bison",
      "a leaping trout",
    ],
  },
  NE: {
    nickname: "The Cornhusker State",
    capital: "Lincoln",
    landmarks: [
      "a spire of rock labeled 'CHIMNEY ROCK'",
      "sandhill cranes labeled 'PLATTE RIVER'",
      "a covered wagon labeled 'OREGON TRAIL'",
      "a corn stalk",
      "a tractor",
    ],
  },
  NV: {
    nickname: "The Silver State",
    capital: "Carson City",
    landmarks: [
      "a dam labeled 'HOOVER DAM'",
      "a mountain lake labeled 'TAHOE'",
      "a silver pickaxe",
      "a desert tortoise",
    ],
  },
  NH: {
    nickname: "The Granite State",
    capital: "Concord",
    landmarks: [
      "a stone profile labeled 'OLD MAN OF THE MOUNTAIN'",
      "a peak labeled 'MT WASHINGTON'",
      "a covered bridge",
      "a moose",
    ],
  },
  NJ: {
    nickname: "The Garden State",
    capital: "Trenton",
    landmarks: [
      "a lighthouse labeled 'CAPE MAY'",
      "a boardwalk labeled 'ATLANTIC CITY'",
      "pine woods labeled 'PINE BARRENS'",
      "a tomato",
      "a diner coffee cup",
    ],
  },
  NM: {
    nickname: "Land of Enchantment",
    capital: "Santa Fe",
    landmarks: [
      "an adobe pueblo labeled 'TAOS'",
      "white dunes labeled 'WHITE SANDS'",
      "a cave mouth labeled 'CARLSBAD'",
      "a roadrunner",
      "a chile pepper",
    ],
  },
  NY: {
    nickname: "The Empire State",
    capital: "Albany",
    landmarks: [
      "the Statue of Liberty labeled 'LIBERTY' at New York",
      "a waterfall labeled 'NIAGARA FALLS'",
      "peaks labeled 'ADIRONDACKS'",
      "a barge labeled 'ERIE CANAL'",
      "an apple",
      "a beaver",
    ],
  },
  NC: {
    nickname: "The Tar Heel State",
    capital: "Raleigh",
    landmarks: [
      "the Wright Flyer labeled 'KITTY HAWK'",
      "a striped lighthouse labeled 'CAPE HATTERAS'",
      "a cabin in the folds labeled 'SMOKIES'",
      "a dogwood blossom",
      "a black bear",
    ],
  },
  ND: {
    nickname: "The Peace Garden State",
    capital: "Bismarck",
    landmarks: [
      "a garden gate labeled 'PEACE GARDEN'",
      "rugged buttes labeled 'BADLANDS'",
      "a bison",
      "a prairie rose",
    ],
  },
  OH: {
    nickname: "The Buckeye State",
    capital: "Columbus",
    landmarks: [
      "a biplane labeled 'DAYTON'",
      "a roller coaster labeled 'CEDAR POINT'",
      "a freighter labeled 'LAKE ERIE'",
      "a buckeye nut",
      "a cardinal",
    ],
  },
  OK: {
    nickname: "The Sooner State",
    capital: "Oklahoma City",
    landmarks: [
      "a highway shield labeled 'ROUTE 66'",
      "an oil derrick labeled 'OIL COUNTRY'",
      "a bison",
      "a scissor-tailed flycatcher",
    ],
  },
  OR: {
    nickname: "The Beaver State",
    capital: "Salem",
    landmarks: [
      "a round lake labeled 'CRATER LAKE'",
      "a waterfall labeled 'MULTNOMAH FALLS'",
      "a covered wagon labeled 'OREGON TRAIL'",
      "a beaver",
      "a leaping salmon",
    ],
  },
  PA: {
    nickname: "The Keystone State",
    capital: "Harrisburg",
    landmarks: [
      "the Liberty Bell labeled 'LIBERTY BELL' at Philadelphia",
      "Independence Hall labeled 'INDEPENDENCE HALL'",
      "cannons labeled 'GETTYSBURG'",
      "a keystone",
      "an Amish buggy",
    ],
  },
  RI: {
    nickname: "The Ocean State",
    capital: "Providence",
    landmarks: [
      "a gilded statue labeled 'INDEPENDENT MAN'",
      "a mansion labeled 'NEWPORT'",
      "a lighthouse labeled 'BLOCK ISLAND'",
      "a Rhode Island Red hen",
      "a sailboat",
    ],
  },
  SC: {
    nickname: "The Palmetto State",
    capital: "Columbia",
    landmarks: [
      "a brick fort labeled 'FORT SUMTER'",
      "a battery promenade labeled 'CHARLESTON'",
      "a palmetto tree",
      "a sweetgrass basket",
    ],
  },
  SD: {
    nickname: "The Mount Rushmore State",
    capital: "Pierre",
    landmarks: [
      "carved presidents labeled 'MOUNT RUSHMORE'",
      "striped buttes labeled 'BADLANDS'",
      "a bison",
      "a pheasant",
    ],
  },
  TN: {
    nickname: "The Volunteer State",
    capital: "Nashville",
    landmarks: [
      "a guitar labeled 'NASHVILLE' at Nashville",
      "a music-note gate labeled 'MEMPHIS' at Memphis",
      "a cabin in the folds labeled 'SMOKIES'",
      "a Tennessee walking horse",
      "an iris blossom",
    ],
  },
  TX: {
    nickname: "The Lone Star State",
    capital: "Austin",
    landmarks: [
      "the Alamo facade labeled 'THE ALAMO' at San Antonio",
      "canyons labeled 'BIG BEND'",
      "a mission-control dish labeled 'HOUSTON'",
      "a longhorn steer",
      "a bluebonnet",
    ],
  },
  UT: {
    nickname: "The Beehive State",
    capital: "Salt Lake City",
    landmarks: [
      "a sandstone arch labeled 'DELICATE ARCH'",
      "cliffs labeled 'ZION'",
      "a salt lake labeled 'GREAT SALT LAKE'",
      "a beehive",
      "a sego lily",
    ],
  },
  VT: {
    nickname: "The Green Mountain State",
    capital: "Montpelier",
    landmarks: [
      "ridges labeled 'GREEN MOUNTAINS'",
      "a covered bridge labeled 'WOODSTOCK'",
      "a sugar maple with sap buckets",
      "a dairy cow",
    ],
  },
  VA: {
    nickname: "The Old Dominion",
    capital: "Richmond",
    landmarks: [
      "a colonial street labeled 'WILLIAMSBURG'",
      "a hilltop house labeled 'MONTICELLO'",
      "wild ponies labeled 'CHINCOTEAGUE'",
      "a cardinal",
      "a dogwood blossom",
    ],
  },
  WA: {
    nickname: "The Evergreen State",
    capital: "Olympia",
    landmarks: [
      "a snowy volcano labeled 'MT RAINIER'",
      "a needle tower labeled 'SEATTLE' at Seattle",
      "an apple",
      "an orca",
    ],
  },
  WV: {
    nickname: "The Mountain State",
    capital: "Charleston",
    landmarks: [
      "an arching bridge labeled 'NEW RIVER GORGE'",
      "folded ridges labeled 'APPALACHIANS'",
      "a black bear",
      "a rhododendron",
    ],
  },
  WI: {
    nickname: "The Badger State",
    capital: "Madison",
    landmarks: [
      "a lighthouse labeled 'DOOR COUNTY'",
      "northwoods labeled 'NORTHWOODS'",
      "a badger",
      "a dairy cow",
    ],
  },
  WY: {
    nickname: "The Cowboy State",
    capital: "Cheyenne",
    landmarks: [
      "a geyser labeled 'OLD FAITHFUL'",
      "a stone tower labeled 'DEVILS TOWER'",
      "sharp peaks labeled 'TETONS'",
      "a cowboy on a bucking horse",
      "a bison",
    ],
  },
};

const OPENING_STYLE = (stateName: string) =>
  `A densely illustrated vintage pictorial map of ${stateName}, hand-drawn in the style of mid-century national park posters and hand-lettered souvenir travel t-shirts. Single dark umber brown ink on aged cream parchment, with small red accents. The state outline is drawn loose and wobbly, and the interior is filled with charming little monoline doodles and hand lettering.`;

const COMPOSITION_DISCIPLINE =
  "COMPOSITION DISCIPLINE: moderately detailed, not crowded — about two-thirds the density of a fully-packed souvenir map. Generous breathing room around the central script and around the red radio tower (nothing within a wide margin of the tower — it stands alone and prominent). Limit background filler: only occasional small pine trees and hill squiggles, never repeated in dense clusters. One decorative doodle per open region, not several. Every label must remain large enough to read at small sizes; omit any element that would crowd a label. No text or doodles outside the state outline — the surrounding parchment stays clean.";

const CLOSING =
  "Mixed hand lettering throughout: flowing script for region names, small bold condensed capitals for towns and landmarks — the lettering is part of the artwork. Uniform monoline stroke weight, flat screen-print style, no shading, no gradients, no border, no compass, no roads. Playful, warm. Landscape 4:3.";

type TowerTown = { city: string; label: string };

function townFromLabel(cityLabel: string): string {
  const trimmed = cityLabel.trim();
  if (!trimmed) return "";
  return trimmed.split(",")[0]?.trim() || trimmed;
}

function samePlace(a: string, b: string): boolean {
  const fold = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\bst\.?\s+/g, "saint ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return fold(a) === fold(b);
}

function towerTownsForState(
  stateCode: string,
  stations: RadioStation[],
): TowerTown[] {
  const seen = new Set<string>();
  const towns: TowerTown[] = [];
  for (const station of stations) {
    if (!station.is_visible) continue;
    if (station.station_type !== "stream") continue;
    if (station.band !== "fm" && station.band !== "am") continue;
    const code = station.state_code?.trim().toUpperCase() ?? "";
    if (code !== stateCode) continue;
    const city = townFromLabel(station.city_label);
    if (!city) continue;
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    towns.push({ city, label: city.toUpperCase() });
  }
  return towns;
}

function towerParagraph(towns: TowerTown[], capital: string): string | null {
  if (towns.length === 0) return null;
  const capitalOnTower = towns.some((town) => samePlace(town.city, capital));
  const capitalCity =
    towns.find((town) => samePlace(town.city, capital))?.city ?? capital;
  const beside =
    capitalOnTower
      ? ` Directly beside the tower, a bold five-pointed star (${capitalCity} is the capital).`
      : "";

  if (towns.length === 1) {
    const town = towns[0]!;
    return `THE STAR OF THE MAP, in red: a small lattice RADIO TRANSMISSION TOWER at ${town.city}, with curved radio broadcast waves radiating from its top, labeled '${town.label}' in typewriter capitals — the only red elements on the map besides tiny accents.${beside}`;
  }

  const list = towns
    .map((town) => `${town.city} labeled '${town.label}'`)
    .join(", ");
  return `THE STAR OF THE MAP, in red: small lattice RADIO TRANSMISSION TOWERS with broadcast waves (the only red) at: ${list}.${beside}`;
}

function alsoOnTheMap(
  lore: StateLore,
  capitalCombinedWithTower: boolean,
): string {
  const parts: string[] = [];
  if (!capitalCombinedWithTower) {
    parts.push(
      `a bold five-pointed star at ${lore.capital} labeled "${lore.capital.toUpperCase()}"`,
    );
  }
  parts.push(...lore.landmarks);
  const head = parts.join("; ");
  return `Also on the map: ${head}; and "${lore.nickname}" written LARGE in flowing hand-lettered script across the state.`;
}

/**
 * Assemble the pictorial-map image prompt for a chart-art slot key
 * (two-letter state / DC, or WX). Returns null for SPORTS or unknown codes.
 */
export function buildChartArtPrompt(
  stateCode: string,
  stations: RadioStation[] = [],
): string | null {
  const key = stateCode.trim().toUpperCase();
  if (!key || key === CHART_ART_SPORTS) return null;

  const loreKey = key === CHART_ART_WX ? "CA" : key;
  const lore = STATE_LORE[loreKey];
  const stateName = US_STATE_NAMES[loreKey];
  if (!lore || !stateName) return null;

  const towns: TowerTown[] =
    key === CHART_ART_WX
      ? [{ city: RANCH_CITY, label: "THE RANCH" }]
      : towerTownsForState(loreKey, stations);
  const capitalOnTower = towns.some((town) => samePlace(town.city, lore.capital));
  const tower = towerParagraph(towns, lore.capital);

  return [
    OPENING_STYLE(stateName),
    tower,
    COMPOSITION_DISCIPLINE,
    alsoOnTheMap(lore, capitalOnTower),
    CLOSING,
  ]
    .filter((paragraph): paragraph is string => Boolean(paragraph))
    .join("\n\n");
}
