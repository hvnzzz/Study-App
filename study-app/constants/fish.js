const fishCatalog = [
  {
    id: 'carp',
    name: 'Carp',
    rarity: 'Common',
    flavorText: 'A calm river regular with a steady spirit.',
    image: require('../assets/fish/Carp.png'),
  },
  {
    id: 'bluegill',
    name: 'Bluegill',
    rarity: 'Common',
    flavorText: 'Tiny ripples follow this bright little friend.',
    image: require('../assets/fish/Bluegill.png'),
  },
  {
    id: 'perch',
    name: 'Perch',
    rarity: 'Common',
    flavorText: 'Striped and patient, perfect for a quiet break.',
    image: require('../assets/fish/Perch.png'),
  },
  {
    id: 'bass',
    name: 'Bass',
    rarity: 'Uncommon',
    flavorText: 'A strong pull that still feels gentle.',
    image: require('../assets/fish/Bass.png'),
  },
  {
    id: 'catfish',
    name: 'Catfish',
    rarity: 'Uncommon',
    flavorText: 'Whiskers twitch beneath the water line.',
    image: require('../assets/fish/Catfish.png'),
  },
  {
    id: 'pike',
    name: 'Pike',
    rarity: 'Uncommon',
    flavorText: 'Silent, quick, and surprisingly graceful.',
    image: require('../assets/fish/Pike.png'),
  },
  {
    id: 'koi',
    name: 'Koi',
    rarity: 'Rare',
    flavorText: 'A painted shimmer drifting through still water.',
    image: require('../assets/fish/Koi.png'),
  },
  {
    id: 'rainbow-trout',
    name: 'Rainbow Trout',
    rarity: 'Rare',
    flavorText: 'A flash of color, then quiet again.',
    image: require('../assets/fish/Rainbow Trout.png'),
  },
  {
    id: 'steelhead',
    name: 'Steelhead',
    rarity: 'Rare',
    flavorText: 'Cool silver scales with mountain-stream energy.',
    image: require('../assets/fish/Steelhead.png'),
  },
  {
    id: 'oarfish',
    name: 'Oarfish',
    rarity: 'Legendary',
    flavorText: 'A deep-sea ribbon gliding through your dreams.',
    image: require('../assets/fish/Oarfish.png'),
  },
  {
    id: 'shark',
    name: 'Shark',
    rarity: 'Legendary',
    flavorText: 'A rare shadow that turns into a story.',
    image: require('../assets/fish/Shark.png'),
  },
  {
    id: 'loch-ness-monster',
    name: 'Loch Ness Monster',
    rarity: 'Mythic',
    flavorText: 'Some say legend. You say proof.',
    image: require('../assets/fish/Loch Ness Monster.png'),
  },
];

const rarityWeights = [
  { rarity: 'Common', chance: 50 },
  { rarity: 'Uncommon', chance: 25 },
  { rarity: 'Rare', chance: 15 },
  { rarity: 'Legendary', chance: 8 },
  { rarity: 'Mythic', chance: 2 },
];

module.exports = {
  fishCatalog,
  rarityWeights,
};
