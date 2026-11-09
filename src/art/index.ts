// John Tenniel's engravings for Alice's Adventures in Wonderland (1865) and
// Through the Looking-Glass (1871). Public domain. Scanned by Standard Ebooks
// and converted to line art (ink as alpha) so the app can tint them.
export const ART = {
  'cheshire-cat': { source: require('./cheshire-cat.png'), ratio: 0.6929 },
  'drink-me': { source: require('./drink-me.png'), ratio: 0.6828 },
  'herald-rabbit': { source: require('./herald-rabbit.png'), ratio: 0.7281 },
  'little-door': { source: require('./little-door.png'), ratio: 0.9514 },
  'mirror-other-side': { source: require('./mirror-other-side.png'), ratio: 0.8614 },
  'mirror-this-side': { source: require('./mirror-this-side.png'), ratio: 0.8971 },
  'red-queen-race': { source: require('./red-queen-race.png'), ratio: 1.6194 },
  'tall-alice': { source: require('./tall-alice.png'), ratio: 0.3769 },
  'white-queen': { source: require('./white-queen.png'), ratio: 0.7314 },
  'white-rabbit-watch': { source: require('./white-rabbit-watch.png'), ratio: 0.6391 },
} as const;

export type ArtName = keyof typeof ART;
