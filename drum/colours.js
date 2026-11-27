// The drum page's colours in firmware V2.2.0: ten families of styles, each with its own 4 x 4 grid.
// Its cells get darker with the strength and the variation, evenly enough to keep only the corners.
//
// cells 1.1, 1.4, 4.1, 4.4, then the family's bright colour (the selected cell 4.1 on the pedal)
const FAMILIES = {
  ROCK: ["7c4847", "5f2623", "652d2b", "4a0806", "f78f8e"],
  POP: ["7c5c3c", "55371d", "5c3e23", "391e04", "f8b778"],
  BLUES: ["587a79", "2b4b56", "36575f", "062b3c", "b0f3f2"],
  FUNK: ["6a467d", "432357", "4d2c60", "28053b", "d38bf9"],
  REGGAE: ["4f7c4e", "264e25", "30592f", "052f05", "9df89c"],
  CTRY: ["3b3c7c", "19205b", "212762", "020644", "7677f7"],
  JAZZ: ["38617c", "1a3957", "21425f", "031d3c", "70c1f8"],
  BALD: ["7d7c42", "525221", "5b5b28", "313103", "f9f883"],
  METAL: ["7c4b7c", "522551", "5b2d5a", "320533", "f895f8"],
  ELEC: ["553d7c", "34205c", "3c2764", "1d0545", "aa79f7"],
};

const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// A family's cell: 0 to 15, as cellName (styles.js) numbers them.
export function cellColour(family, part) {
  const corners = FAMILIES[family].slice(0, 4).map(rgb);
  const right = (part & 3) / 3;
  const up = (part >> 2) / 3;
  const mix = (a, b, t) => a + (b - a) * t;
  const channel = (i) => {
    const [c11, c14, c41, c44] = corners.map((c) => c[i]);
    return Math.round(mix(mix(c11, c14, right), mix(c41, c44, right), up));
  };
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

export const brightColour = (family) => `#${FAMILIES[family][4]}`;
