// The pedal's drum styles in firmware V2.2.0, in the order of its drum page: the name as the pedal
// shows it, the kit, tempo and length of (most of) its parts, and the family whose colours its page
// has (colours.js). Names and numbers only, written out here; the parts themselves stay on the pedal.
//
// [name, kit, tempo, bars, family]
const STYLES_44 = [
  ["ROCK-1", 1, 90, 8, "ROCK"],
  ["ROCK-2", 5, 120, 8, "ROCK"],
  ["ROCK-3", 3, 80, 8, "ROCK"],
  ["ROCK-4", 0, 85, 8, "ROCK"],
  ["ROCK-5", 6, 96, 8, "ROCK"],
  ["BACK BEAT", 1, 120, 8, "ROCK"],
  ["POP-1", 1, 108, 8, "POP"],
  ["POP-2", 0, 100, 8, "POP"],
  ["BLUES SHUFFLE-1", 3, 96, 8, "BLUES"],
  ["BLUES SHUFFLE-2", 8, 120, 8, "BLUES"],
  ["FUNK-1", 3, 100, 8, "FUNK"],
  ["FUNK-2", 3, 114, 8, "FUNK"],
  ["FUNK-3", 3, 130, 8, "FUNK"],
  ["DH_JW_FUNK", 3, 91, 4, "FUNK"],
  ["REGGAE-1", 8, 75, 8, "REGGAE"],
  ["REGGAE-2", 6, 90, 8, "REGGAE"],
  ["BALLAD", 1, 85, 8, "CTRY"],
  ["COUNTRY SALLY", 8, 90, 4, "CTRY"],
  ["JAZZ", 6, 130, 8, "JAZZ"],
  ["CUMBIA", 6, 90, 8, "BALD"],
  ["BOSSA", 6, 120, 8, "BALD"],
  ["LATIN", 2, 95, 8, "BALD"],
  ["PUNK", 9, 180, 8, "ROCK"],
  ["METAL", 7, 120, 8, "METAL"],
  ["WEST COAST", 3, 90, 8, "POP"],
  ["ELECTRONIC-1", 4, 80, 8, "ELEC"],
  ["ELECTRONIC-2", 4, 120, 8, "ELEC"],
  ["ELECTRONIC-3", 4, 120, 8, "ELEC"],
  ["ELEC-TRIPLET-4", 4, 80, 8, "ELEC"],
];
const STYLES_34 = [
  ["ROCK-1", 6, 120, 8, "ROCK"],
  ["ROCK-2", 3, 80, 8, "ROCK"],
  ["ROCK-3", 0, 85, 8, "ROCK"],
  ["ROCK-4", 6, 120, 8, "ROCK"],
  ["POP-1", 9, 112, 8, "POP"],
  ["POP-2", 0, 120, 8, "POP"],
  ["BLUES", 1, 180, 8, "BLUES"],
  ["FUNK", 3, 100, 8, "FUNK"],
  ["JAZZ", 6, 130, 8, "JAZZ"],
  ["ELECTRONIC", 4, 80, 8, "ELEC"],
  ["METAL", 1, 150, 8, "METAL"],
  ["LATIN", 2, 95, 8, "JAZZ"],
  ["WALTZ", 6, 120, 8, "BALD"],
];

const list = (rows) =>
  rows.map(([name, kit, tempo, bars, family], i) => ({ style: i + 1, name, kit, tempo, bars, family }));

// Per meter (beats per bar): [{style (from 1), name, kit, tempo, bars, family}].
export const STYLES = { 4: list(STYLES_44), 3: list(STYLES_34) };

// Both meters' styles as one list, by name: [{name, styles: {4: style, 3: style}}], a meter
// missing where the style has none. The 4/4 order, each 3/4-only style before the first 4/4 style of
// its family (BLUES before BLUES SHUFFLE-1), at the end without one (WALTZ).
export const STYLE_LIST = (() => {
  const out = STYLES[4].map((s) => ({ name: s.name, styles: { 4: s.style } }));
  for (const s of STYLES[3]) {
    const same = out.find((e) => e.name === s.name);
    if (same) {
      same.styles[3] = s.style;
      continue;
    }
    const family = out.findIndex((e) => e.name.startsWith(s.name));
    out.splice(family < 0 ? out.length : family, 0, { name: s.name, styles: { 3: s.style } });
  }
  return out;
})();

// A cell of a style's grid: part = 4 x (strength - 1) + (variation - 1), as the pedal numbers them.
export const cellName = (part) => `${(part >> 2) + 1}.${(part & 3) + 1}`;

// A cell's pattern as a file.
export const clipName = (style, meter, part) => `${style}-${meter}4-${cellName(part)}.mid`;

// The cells whose stock part plays kit 0 instead of its style's kit: meter -> style name -> cells.
const KIT_0_CELLS = {
  4: {
    "FUNK-3": ["1.3"],
    "REGGAE-2": ["1.3", "2.3"],
    JAZZ: ["1.2", "2.2", "2.3", "2.4", "3.2", "3.3", "3.4"],
  },
  3: {
    JAZZ: ["1.2", "2.2", "2.3", "2.4", "3.2", "3.3", "3.4"],
    WALTZ: ["1.1"],
  },
};

// The kit and tempo of a cell's stock part: a user part there takes both.
export function stockPart(meter, style, part) {
  const { name, kit, tempo } = STYLES[meter][style - 1];
  const cell = cellName(part);
  return {
    kit: KIT_0_CELLS[meter][name]?.includes(cell) ? 0 : kit,
    tempo: name === "DH_JW_FUNK" && cell === "1.3" ? 90 : tempo, // the one cell off its style's tempo
  };
}
