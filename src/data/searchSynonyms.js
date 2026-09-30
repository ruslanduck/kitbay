// Words the crew uses for the same gear. Each group is ONE meaning: a query word
// or phrase that is in a group also finds the group's other entries — "mic"
// finds a Microphone, "century stand" a C-Stand, "shot bag" a Sandbag,
// "quarter" a 1/4 silk or a quarter apple box.
//
// Plain lower-case text. The search already normalises spelling details on its
// own (lib/search.js): case, hyphens and spaces inside a word ("C-Stand" =
// "c stand" = "cstand"), plurals, sizes (6×6 = 6x6 = 6' x 6'), and the inch /
// foot marks — so none of those need an entry here.
//
// Built from the studio's own register (276 items, 30 Sep 2026: Lightbank and
// Octabank beside Softbox, Shot Bag beside Sandbag, Applebox Eighth/Quarter/
// Half, Para, Transceiver, Cube Tap…) plus the usual film and photo slang.
// Add to it freely: a wrong entry can only widen a search, never hide an item,
// and a direct match always ranks above one reached through a synonym.
export const SEARCH_SYNONYMS = [
  // ── Grip
  ['c-stand', 'c+ stand', 'century stand'],
  ['applebox', 'apple box', 'apple crate'],
  ['eighth', '1/8', 'pancake'],
  ['quarter', '1/4'],
  ['half', '1/2'],
  ['sandbag', 'sand bag', 'shot bag', 'shotbag', 'weight bag', 'weight'],
  ['a-clamp', 'spring clamp', 'pony clamp'],
  ['super clamp', 'superclamp', 'mafer'],
  ['cardellini', 'end jaw'],
  ['duckbill', 'duck bill', 'platypus'],
  ['grip head', 'gobo head', 'knuckle'],
  ['meat axe', 'meataxe'],
  ['highboy', 'high boy', 'hi boy'],
  ['lowboy', 'low boy'],
  ['baby pin', 'spud'],
  ['speedrail', 'speed rail', 'pipe'],
  ['sawhorse', 'saw horse'],
  ['flag', 'cutter'],
  ['butterfly', 'overhead', 'overhead frame'],
  ['foamcore', 'foam core', 'foam board'],
  ['bead board', 'beadboard', 'styro', 'styrofoam'],
  ['bounce', 'ultrabounce', 'fill card'],
  ['backdrop', 'background', 'muslin', 'seamless'],
  ['cart', 'magliner', 'trolley'],
  ['ladder', 'step ladder', 'stepladder'],
  ['tripod', 'sticks', 'legs'],

  // ── Lighting
  ['softbox', 'soft box', 'lightbank', 'light bank', 'octabank', 'octa bank', 'octa', 'octobox'],
  ['para', 'parabolic'],
  ['grid', 'honeycomb', 'egg crate', 'eggcrate'],
  ['strobe', 'flash', 'monolight', 'monoblock'],
  ['pack', 'power pack', 'generator'],
  ['trigger', 'transceiver', 'transmitter', 'remote', 'pocketwizard', 'pocket wizard'],
  ['light meter', 'meter', 'flash meter'],
  ['tungsten', 'hot light', 'incandescent'],
  ['open face', 'openface', 'redhead'],
  ['lantern', 'china ball', 'chinese lantern', 'paper lantern'],
  ['diffusion', 'diff'],
  ['gel', 'filter'],
  ['umbrella', 'brolly'],

  // ── Camera, capture and computers
  ['camera', 'cam', 'camera body', 'body'],
  ['lens', 'glass'],
  ['mark iv', 'mark 4', 'mk4', 'mkiv', 'mk iv'],
  ['battery', 'batt'],
  ['charger', 'power adapter', 'power supply', 'psu'],
  ['ups', 'battery backup', 'battery back up'],
  ['tether', 'tethering', 'tether cable'],
  ['repeater', 'booster', 'extender', 'tetherboost'],
  ['hub', 'dock', 'docking station'],
  ['adapter', 'adaptor', 'dongle', 'converter'],
  ['laptop', 'notebook', 'macbook'],
  ['mbp', 'macbook pro'],
  ['monitor', 'display', 'screen'],
  ['kb', 'keyboard'],
  ['mousepad', 'mouse pad'],
  ['tablet', 'pen tablet', 'wacom'],
  ['hard drive', 'hdd', 'external drive', 'drive', 'ssd'],
  ['cf', 'compactflash', 'compact flash', 'cf card'],
  ['sd card', 'sd'],
  ['card reader', 'reader'],
  ['colorchecker', 'color checker', 'colour checker', 'color chart'],
  ['calibrator', 'calibration', 'colorimeter'],

  // ── Cables and power
  ['usb c', 'usbc', 'type c', 'typec'],
  ['usb a', 'usba', 'type a'],
  ['ethernet', 'lan', 'network cable', 'rj45', 'cat6', 'cat5'],
  ['cable', 'cord', 'lead', 'wire'],
  ['extension cord', 'stinger', 'extension cable', 'extension lead'],
  ['power strip', 'powerstrip', 'power bar', 'surge protector'],
  ['cube tap', 'triple tap', 'splitter'],

  // ── Set, tools and studio
  ['level', 'spirit level', 'bubble level'],
  ['measure', 'tape measure', 'measuring tape'],
  ['box cutter', 'utility knife', 'razor knife'],
  ['microfiber', 'microfibre', 'lens cloth'],
  ['steamer', 'steam', 'garment steamer'],
  ['changing room', 'dressing room', 'partition'],
  ['table', 'tabletop', 'desk'],
  ['fan', 'wind machine'],
  ['plywood', 'ply'],

  // ── Sizes, the way they are abbreviated on labels
  ['extra small', 'xs', 'x small'],
  ['small', 'sm'],
  ['medium', 'med', 'md'],
  ['large', 'lg'],
  ['extra large', 'xl', 'x large'],

  // ── Spelling and units
  ['grey', 'gray'],
  ['color', 'colour'],
  ['in', 'inch', 'inches'],
  ['ft', 'foot', 'feet'],
  ['lb', 'lbs', 'pound', 'pounds'],
  ['w', 'watt', 'watts'],
  ['mm', 'millimeter', 'millimetre'],
]
