// Procedural 8-bit characters. Pure data → pixel grid; no DOM here so the
// same code renders in the app and in tests.

export const SPRITE_W = 16
export const SPRITE_H = 20

// Left half of a front-facing body; the right half is its mirror.
const BODY = [
  '........', '........', '........',
  '....OOOO', '...OHHHH', '..OHHHHH', '..OHSSSS', '..OSSESS', '..OSSSSS',
  '...OSSSs', '....OOOO',
  '...OPPAA', '..OPPPPA', '.OPOPPPP', '.OPOPPPP', '.OSOpppp',
  '..OOpppO', '...OpppO', '...ODDDO', '...OOOOO',
]

// Fixed material colours; the agent's palette supplies P/p/A/S/H.
const FIXED = {
  O: '#120e18', W: '#fdfbff', M: '#c7cfdd', m: '#7c8599', B: '#8b5a2b',
  b: '#5c3a1a', D: '#2b2433', Y: '#ffd447', G: '#9fd8ff', K: '#000000',
}

// Class gear: [x, y, rows] stamps over the body. ' ' leaves a pixel alone.
const GEAR = {
  Guardian: [
    [3, 1, ['    AA    ', '   OAAO   ', ' OOMMMMOO ', 'OMMMMMMMMO', 'OMmMMMMmMO']],
    [0, 12, ['OOOO', 'OAMO', 'OMAO', 'OAMO', ' OO ']],
    [13, 7, [' W', ' W', ' W', ' W', ' W', 'YYY', ' B']],
  ],
  Scholar: [
    [2, 2, ['OOOOOOOOOOOO', ' OppppppppO ', '  OppppppO  ']],
    [11, 1, ['A', ' ']],
    [3, 7, [' MOM  MOM ']],
    [11, 13, ['OOOO', 'OAWO', 'OAWO', 'OOOO']],
  ],
  Artist: [
    [4, 1, ['    O   ', '  OPPPP ', ' OPPPPPPO', 'OPPPPPPPPO']],
    [0, 13, [' WW ', 'WAWP', ' WW ']],
    [13, 9, ['  A', ' B ', ' B ', 'B  ', 'B  ']],
  ],
  Mechanic: [
    [3, 2, ['  OppppO  ', ' OPPPPPPO ', 'OPPPPPPPPOO', '  OGOOGO  ']],
    [12, 10, ['OMO', 'OMO', ' M ', ' M ', ' m ']],
    [5, 12, ['   AA ']],
  ],
  Bard: [
    [9, 0, ['  A', ' AA', ' A ']],
    [3, 2, ['  OPPPPO  ', 'OPPPPPPPPO']],
    [11, 9, ['   B', '  B ', ' Bb ', 'BBBB', 'BbBB', 'BBBB', ' BB ']],
  ],
  Ranger: [
    [3, 2, ['   OOOO   ', '  OPPPPO  ', ' OPPPPPPO ', 'OPPPHHPPPO', 'OPP    PPO', 'OP      PO', 'OP      PO', 'OPP    PPO']],
    [0, 8, [' B', 'BW', 'BW', 'BW', 'BW', 'BW', 'BW', ' B']],
    [14, 7, ['A', 'B', 'B', 'B']],
  ],
  Merchant: [
    [1, 2, ['   OppppppO   ', '  OpppppppppO ', 'OOppppppppppOO']],
    [12, 13, [' OO ', 'OAAO', 'OAYO', ' OO ']],
    [5, 11, ['  YY  ']],
  ],
}

// Monochrome class emblems for the strip (9×9, '#' = on).
export const EMBLEMS = {
  Guardian: ['.#######.', '#.......#', '#..###..#', '#..#.#..#', '#..###..#', '.#.....#.', '..#...#..', '...#.#...', '....#....'],
  Scholar: ['.........', '.###.###.', '#...#...#', '#.#.#.#.#', '#...#...#', '#.#.#.#.#', '#...#...#', '.###.###.', '....#....'],
  Artist: ['......##.', '.....###.', '....###..', '...###...', '..##.....', '.##......', '###......', '##.......', '.........'],
  Mechanic: ['.##...##.', '.#.#.#.#.', '..#####..', '...###...', '...###...', '...###...', '..#####..', '.#.#.#.#.', '.##...##.'],
  Bard: ['.....###.', '.....#.#.', '.....#...', '.....#...', '..###....', '.#####...', '.#####...', '..###....', '.........'],
  Ranger: ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '#########', '...#.#...', '..#...#..', '.#.....#.', '#.......#'],
  Merchant: ['...###...', '..#...#..', '.#.###.#.', '.#.#...#.', '.#.###.#.', '.#...#.#.', '.#.###.#.', '..#...#..', '...###...'],
}

export const CLASS_FOR_CATEGORY = {
  'Code & QA': 'Mechanic', Research: 'Scholar', DevOps: 'Ranger',
  'Personal Assistant': 'Bard', 'Design & UX': 'Artist',
}

export function hashSeed(text) {
  let h = 2166136261
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)))
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')
}

function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// Every agent gets a character: its declared one, or one derived from its id.
export function characterFor(manifest) {
  const declared = manifest?.character
  if (declared?.class && declared?.palette) return declared
  const seed = hashSeed(manifest?.id || 'agent')
  const r = rng(seed)
  const hue = Math.floor(r() * 360)
  return {
    class: CLASS_FOR_CATEGORY[manifest?.category] || 'Bard',
    palette: {
      primary: hsl(hue, 0.72, 0.58), secondary: hsl(hue, 0.6, 0.28),
      accent: hsl((hue + 150) % 360, 0.85, 0.62), skin: ['#f2c79b', '#d9a37a', '#b5764f', '#8a5634'][Math.floor(r() * 4)],
      hair: ['#2a1a10', '#e8a23a', '#d9d2c5', '#5a3a1e'][Math.floor(r() * 4)],
    },
    sprite_seed: seed,
    superpowers: [],
  }
}

// Returns a SPRITE_W × SPRITE_H array of colours (null = transparent).
export function buildSprite(character, { blink = false } = {}) {
  const pal = character.palette
  const r = rng(character.sprite_seed || 1)
  const colors = {
    ...FIXED, P: pal.primary, p: pal.secondary, A: pal.accent,
    S: pal.skin, s: shade(pal.skin, -0.16), H: pal.hair || '#2a1a10', E: '#120e18',
  }
  const rows = BODY.map((half) => (half + [...half].reverse().join('')).split(''))
  // Seeded variation: fringe, eye shape, smile, sleeve trim.
  if (r() < 0.5) { rows[6][4] = 'H'; rows[6][11] = 'H' }
  if (r() < 0.4) { rows[6][5] = 'H'; rows[6][10] = 'H' }
  const tallEyes = r() < 0.5
  if (tallEyes) { rows[8][5] = 'E'; rows[8][10] = 'E' }
  if (r() < 0.5) { rows[9][6] = 's'; rows[9][9] = 's'; rows[9][7] = 'S'; rows[9][8] = 'S' }
  if (r() < 0.5) { rows[15][4] = 'A'; rows[15][11] = 'A' }
  rows[7][5] = 'E'; rows[7][10] = 'E'
  for (const [x, y, stamp] of GEAR[character.class] || []) {
    stamp.forEach((line, dy) => [...line].forEach((ch, dx) => {
      if (ch !== ' ' && rows[y + dy] && x + dx < SPRITE_W) rows[y + dy][x + dx] = ch
    }))
  }
  if (blink) {
    // Closed eyes: the lid line sits on the lower eye row, the upper row turns to skin.
    for (const x of [5, 10]) {
      if (rows[7][x] === 'E') rows[7][x] = 'S'
      rows[8][x] = 's'
      rows[8][x + (x === 5 ? -1 : 1)] = rows[8][x + (x === 5 ? -1 : 1)] === 'S' ? 's' : rows[8][x + (x === 5 ? -1 : 1)]
    }
  }
  return rows.map((row) => row.map((ch) => (ch === '.' ? null : colors[ch] || null)))
}

export const EFFECT_COLORS = (character) => [character.palette.accent, character.palette.primary, '#ffffff', '#ffd447']
