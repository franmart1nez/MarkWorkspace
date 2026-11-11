// Syllable name generators per cultural style.
import { pick } from './rng.js';

const ST = {
  human: {
    a: ['Al', 'Ber', 'Ced', 'Ed', 'Gar', 'Hal', 'Jor', 'Lu', 'Mar', 'Ro', 'Sig', 'Wil', 'Ther', 'Os', 'Ra', 'Bren', 'Dor', 'Fen'],
    m: ['ric', 'mund', 'win', 'bert', 'ald', 'an', 'ius', 'en', 'ard'],
    f: ['a', 'ia', 'lyn', 'eth', 'ina', 'elle', 'wen', 'is', 'ora'],
    p: ['Ash', 'Oak', 'Stone', 'River', 'Gold', 'Raven', 'Wolf', 'Green', 'High', 'Red', 'White', 'Black', 'Mill', 'Elder', 'King', 'Fair', 'Thorn', 'Iron'],
    s: ['ford', 'haven', 'bury', 'stead', 'field', 'bridge', 'wick', 'mere', 'gate', 'holm', 'dale', 'ton', 'watch', 'crest'],
  },
  elf: {
    p: ['Sil', 'Lae', 'Ael', 'Thal', 'Myr', 'Elen', 'Nim', 'Ith', 'Vael', 'Lor', 'Cael', 'Fae'],
    s: ['dor', 'thil', 'ion', 'wen', 'anor', 'ethel', 'rien', 'lond', 'mir', 'riel', 'las'],
  },
  dwarf: {
    p: ['Kaz', 'Dur', 'Bal', 'Thor', 'Grim', 'Bar', 'Khar', 'Mor', 'Dun', 'Brok', 'Gim', 'Nar'],
    s: ['ak', 'dum', 'grim', 'hold', 'gar', 'dar', 'heim', 'burk', 'zan', 'in', 'li'],
  },
  orc: {
    p: ['Grak', 'Urz', 'Mog', 'Dush', 'Krag', 'Bolg', 'Zug', 'Nar', 'Ghash', 'Thrak', 'Shag', 'Lur'],
    s: ['gor', 'uk', 'dur', 'mok', 'nak', 'ghul', 'zar', 'rok', 'ash', 'bag'],
  },
  goblin: {
    p: ['Snik', 'Grub', 'Nok', 'Zit', 'Mug', 'Skab', 'Rik', 'Gnash', 'Blix', 'Krik', 'Pog', 'Yip'],
    s: ['nik', 'gob', 'rat', 'snot', 'wort', 'it', 'ak', 'fang', 'yap', 'tik'],
  },
  halfling: {
    a: ['Bil', 'Fro', 'Sam', 'Pip', 'Mer', 'Ros', 'Dai', 'Pop', 'Tol', 'Mil'],
    m: ['bo', 'do', 'wise', 'pin', 'ry', 'man', 'fast'],
    f: ['ie', 'sy', 'py', 'la', 'bell', 'a'],
    p: ['Apple', 'Bramble', 'Butter', 'Clover', 'Honey', 'Mallow', 'Pudding', 'Thistle', 'Willow', 'Barley'],
    s: ['bottom', 'brook', 'hollow', 'wick', 'down', 'mead', 'burrow', 'hill'],
  },
  beast: {
    p: ['Mira', 'Sha', 'Kuro', 'Tama', 'Fen', 'Ruka', 'Aki', 'Nya', 'Yuki', 'Haru', 'Kon', 'Usa', 'Shiro', 'Rin'],
    s: ['ri', 'ko', 'na', 'mi', 'to', 'ra', 'shi', 'ya', 'ha', 'ne'],
  },
  lizard: {
    p: ['Ssar', 'Zith', 'Xal', 'Tla', 'Iss', 'Qez', 'Sek', 'Zha', 'Vess', 'Nax'],
    s: ['ith', 'ax', 'otl', 'ess', 'ar', 'ukk', 'is', 'ara', 'il'],
  },
  sea: {
    p: ['Thal', 'Ner', 'Mar', 'Cora', 'Pel', 'Lir', 'Ondi', 'Sere', 'Kall', 'Aell', 'Chir', 'Okyr'],
    s: ['assa', 'eia', 'ine', 'ora', 'ys', 'elle', 'une', 'on', 'os', 'ia'],
  },
  fey: {
    p: ['Pip', 'Tink', 'Bri', 'Lum', 'Fen', 'Dew', 'Moth', 'Thim', 'Wisp', 'Peri', 'Nib', 'Glim'],
    s: ['a', 'kin', 'ble', 'wick', 'lo', 'belle', 'drop', 'nel', 'bit', 'sy'],
  },
  dark: {
    p: ['Mal', 'Vor', 'Zar', 'Bel', 'Az', 'Mor', 'Lil', 'Nyx', 'Drav', 'Sang', 'Kael', 'Ver'],
    s: ['ak', 'ith', 'goth', 'ial', 'eth', 'ara', 'mor', 'ius', 'ina', 'ax', 'yra'],
  },
  holy: {
    p: ['Sera', 'Uri', 'Gabr', 'Mich', 'Raph', 'Auri', 'Cael', 'Zad', 'Ana', 'Sar'],
    s: ['el', 'iel', 'ael', 'phina', 'ion', 'ia', 'iah'],
  },
  giant: {
    p: ['Bor', 'Hrun', 'Ymr', 'Thrum', 'Gor', 'Mog', 'Skar', 'Dolg', 'Aster', 'Brun'],
    s: ['gar', 'nir', 'ulf', 'mund', 'ok', 'ir', 'ion', 'hild'],
  },
};

export function personName(s, style, sex) {
  const t = ST[style] || ST.human;
  if (t.a) return pick(s, t.a) + pick(s, sex === 'f' ? t.f : t.m);
  return pick(s, t.p) + pick(s, t.s);
}

export function placeName(s, style, taken) {
  const t = ST[style] || ST.human;
  for (let i = 0; i < 12; i++) {
    const n = pick(s, t.p) + pick(s, t.s);
    if (!taken || !taken.has(n)) { taken?.add(n); return n; }
  }
  const base = pick(s, t.p) + pick(s, t.s);
  for (let k = 2; ; k++) {
    const n = `${base} ${k}`;
    if (!taken || !taken.has(n)) { taken?.add(n); return n; }
  }
}

export const ARCHETYPES = [
  'tsundere', 'kuudere', 'genki', 'stoic veteran', 'scheming noble', 'gentle healer', 'boastful rival', 'shy bookworm',
  'motherly innkeeper', 'loyal knight', 'greedy merchant', 'mysterious wanderer', 'airhead', 'chuunibyou mage',
  'lazy genius', 'battle maniac', 'devout zealot', 'mischievous trickster', 'cold strategist', 'big-hearted brute',
  'doting older sibling', 'clumsy apprentice', 'world-weary drunk', 'honest fool',
];

export const GOALS = [
  'find a worthy rival', 'pay off a family debt', 'open their own tavern', 'avenge a fallen sibling', 'see the ocean',
  'forge a legendary blade', 'win the ruler\'s favor', 'collect rare secrets', 'protect their home', 'become the strongest',
  'find true love', 'escape their duty', 'amass a fortune', 'explore an ancient ruin', 'earn their ancestors\' respect',
  'master a forbidden spell', 'slay a dragon', 'live quietly and be left alone', 'taste every dish in the world',
  'restore their family name',
];

export const TRADES = [
  'tavern keeper', 'tavern maid', 'blacksmith', 'merchant', 'priest', 'healer', 'hunter', 'scholar', 'bard',
  'hedge witch', 'guildmaster', 'adventurer', 'alchemist', 'baker', 'stablehand',
];
