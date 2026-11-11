// Not everyone is good. Pickpockets, shoplifters and burglars; brawlers and the
// odd murderer; drunkards and gamblers who ruin their families; officials who
// skim the treasury, watchmen who take bribes and extort the market, a captain
// who jails the poor and a lord who squeezes his people. The watch catches some
// of them, and the courts fine, jail, banish or hang.
//
// Character comes from the three traits every person has, so nothing extra is
// stored: honesty() and temper() are worked out when needed. Records live in
// S.law, keyed by person id, only for people who have done something.
import { randInt, randRange, pick, chance } from './rng.js';
import { DAY, dayOf, nextAt, log, note, tally } from './core.js';
import { moveMoney } from './economy.js';
import { die, wound, fullName, banish, sendTo, replaceWorker } from './fate.js';

const HONEST = { kind: 1.5, generous: 1.2, devout: 1, humble: 0.8, patient: 0.5, diligent: 0.4, cautious: 0.3, sly: -1.6, greedy: -1.4, cynical: -0.8, lazy: -0.5, proud: -0.3, 'hot-tempered': -0.3 };
const TEMPER = { 'hot-tempered': 1.5, proud: 0.6, brave: 0.4, stubborn: 0.4, cynical: 0.3, patient: -1, kind: -0.8, shy: -0.5, cautious: -0.5, humble: -0.4 };
const sum = (p, w) => p.traits.reduce((a, t) => a + (w[t] || 0), 0);
export const honesty = (p) => sum(p, HONEST);
export const temper = (p) => sum(p, TEMPER);
export const corrupt = (p) => honesty(p) <= -1.2;
export const gambler = (p) => p.traits.includes('sly') || (p.traits.includes('dreamy') && honesty(p) < 0);
export const drunkard = (p) => p.traits.includes('lazy') && ['cynical', 'hot-tempered', 'proud', 'greedy', 'sly'].some((t) => p.traits.includes(t));

/** A person's record with the law (created on first need). */
export const recOf = (S, p) => (S.law[p.id] ||= { n: 0, u: 0, jail: 0, stolen: 0, skim: 0, foe: -1, foeT: 0 });
const siteName = (L, p) => (L.sites[p.site] ? L.sites[p.site].name : 'the region');
const bldName = (L, b) => b.name || (b.k === 'shop' ? `the ${b.trade}'s workshop` : `the ${b.k}`);

function grudge(S, p, against) {
  if (!p || !against || !p.alive || p.id === against.id) return;
  const r = recOf(S, p);
  r.foe = against.id;
  r.foeT = dayOf(S.t);
}

/** How tempted a person is to steal: 0 for the honest who are not desperate, more for the sly, the greedy and the hungry. */
export function temptation(S, p) {
  if (p.age < 14 || p.age > 70 || p.jail > S.t || p.job === 'trader') return 0;
  const hh = S.households[p.hh];
  if (!hh) return 0;
  const need = (p.miss >= 3 ? 2 : 0) + (hh.coins / Math.max(1, hh.m.length) < 6 ? 1 : 0) + (hh.arrears >= 2 ? 1 : 0);
  return (Math.max(0, 0.5 - honesty(p)) + (need >= 2 ? 0.3 : 0)) * (1 + need);
}

// ---- the watch and the courts --------------------------------------------------------

/** Who deals with a culprit: a watchman in the city, the elder in a village. */
function officer(S, L, p) {
  const job = p.site > 0 ? 'elder' : 'guard';
  const list = S.people.filter((q) => q.alive && !q.away && q.job === job && (job === 'guard' || q.site === p.site) && q.id !== p.id && !(q.jail > S.t));
  return list.length ? pick(S, list) : null;
}

function caught(S, L, p, base) {
  const r = S.law[p.id];
  return chance(S, Math.min(0.85, base * (p.site === 0 ? 1 : 0.75) + (r ? r.u * 0.04 + r.n * 0.03 : 0)));
}

/** Locked in the cells of the barracks for some days. */
export function imprison(S, L, p, days, why) {
  p.jail = S.t + Math.round(days * DAY);
  recOf(S, p).jail++;
  tally(S, 'justice', 'jailed');
  note(S, p, why);
  p.plan = null;
  sendTo(S, L, p, L.sites[0].barracks, 'jail', Math.min(p.jail, S.t + 240));
}

/** The watch has caught p: a bribe, restitution, a fine, the cells, banishment or the gallows. */
function justice(S, L, p, crime, value, victim, text) {
  if (!p.alive) return;
  const r = recOf(S, p), hh = S.households[p.hh], site = S.sites[p.site] || S.sites[0];
  const judge = officer(S, L, p), bribe = Math.round(Math.max(8, value * 2 + 6));
  if (crime !== 'murder' && crime !== 'manslaughter' && judge && corrupt(judge) && hh && hh.coins > bribe + 10 && chance(S, 0.7)) {
    moveMoney(hh, S.households[judge.hh], bribe);
    tally(S, 'abuses', 'bribes taken');
    note(S, judge, `Took ${bribe} coins from ${fullName(p)} to look away.`);
    log(S, 'crime', 0, `${text} ${fullName(p)} slipped ${bribe} coins to ${fullName(judge)} and walked free.`, p.x, p.y, p.id);
    return;
  }
  r.n++;
  tally(S, 'justice', 'caught');
  if (victim && value > 0 && hh) moveMoney(hh, victim, value); // what was taken goes back where it can
  let sentence;
  if (crime === 'murder') {
    if (chance(S, 0.65)) {
      S.gallows.push({ id: p.id, t: nextAt(S.t + 6 * 60, 12 * 60) });
      imprison(S, L, p, 1, 'Condemned to hang for murder.');
      sentence = 'condemned to hang';
    } else { banish(S, L, p, 'Banished from the region for a killing.', `${text} ${fullName(p)} was banished from the region.`); return; }
  } else if (crime === 'manslaughter') {
    if (victim && hh) moveMoney(hh, victim, 40);
    imprison(S, L, p, 8, 'Jailed for a killing in a brawl.');
    sentence = 'jailed for eight days and made to pay blood money';
  } else if (r.n >= 4 || (crime !== 'brawl' && crime !== 'evasion' && r.n >= 3 && crime !== 'pickpocket' && crime !== 'shoplift')) {
    tally(S, 'justice', 'banished');
    banish(S, L, p, 'Banished from the region after too many crimes.', `${text} After ${r.n} crimes, ${fullName(p)} was banished from the region.`);
    return;
  } else if (crime === 'burglary' || crime === 'assault') {
    imprison(S, L, p, crime === 'assault' ? 5 : 3, `Jailed for ${crime}.`);
    sentence = `jailed for ${crime === 'assault' ? 'five' : 'three'} days`;
  } else {
    const fine = crime === 'brawl' ? 4 : 5 + value, paid = hh ? moveMoney(hh, site, fine) : 0;
    if (paid < fine * 0.98 || r.n >= 2) { imprison(S, L, p, r.n >= 2 ? 2 : 1, `Jailed for ${crime === 'brawl' ? 'brawling' : 'theft'}.`); sentence = `fined and jailed for ${r.n >= 2 ? 'two days' : 'a day'}`; } else sentence = `fined ${Math.round(fine)} coins`;
  }
  // a hot-tempered watchman may beat a prisoner
  if (judge && judge.job === 'guard' && temper(judge) >= 1 && p.jail > S.t && chance(S, 0.2)) {
    p.hurt = S.t + 2 * DAY;
    tally(S, 'abuses', 'beatings');
    note(S, p, `Beaten by ${fullName(judge)} in the cells.`);
    grudge(S, p, judge);
  }
  log(S, 'crime', crime === 'murder' ? 2 : crime === 'burglary' || crime === 'manslaughter' || crime === 'assault' ? 1 : 0, `${text} ${fullName(p)} was ${sentence}.`, p.x, p.y, p.id);
}

function crime(S, L, p, kind, value, victim, text, base) {
  tally(S, 'crimes', kind);
  const r = recOf(S, p);
  r.stolen = Math.round((r.stolen + value) * 100) / 100;
  if (caught(S, L, p, base)) justice(S, L, p, kind, value, victim, text); else r.u++;
}

/** The condemned hang at noon. */
export function gallows(S, L) {
  if (!S.gallows.length) return;
  S.gallows = S.gallows.filter((g) => {
    if (S.t < g.t) return true;
    const p = S.people[g.id];
    if (p && p.alive) { tally(S, 'justice', 'hanged'); die(S, L, p, 'was hanged for murder', 2, 'hanged'); }
    return false;
  });
}

// ---- crimes of the day ------------------------------------------------------------------

function victimNear(S, p, hh) {
  for (let i = 0; i < 6; i++) {
    const h = S.households[randInt(S, 0, S.households.length - 1)];
    if (h.site === p.site && h.m.length && h.id !== hh.id && h.id !== S.lord && h.coins > 20) return h;
  }
  return null;
}

/** After a trip to the market a light-fingered shopper may cut a purse. */
export function atMarket(S, L, p, hh) {
  const k = temptation(S, p);
  if (!k || !chance(S, 0.008 * k)) return;
  const v = victimNear(S, p, hh);
  if (!v) return;
  const n = moveMoney(v, hh, Math.min(v.coins * 0.08, randInt(S, 2, 9)));
  note(S, p, 'Cut a purse at the market.');
  crime(S, L, p, 'pickpocket', n, v, `Caught cutting a purse at the market of ${siteName(L, p)},`, 0.22);
}

/** At a workshop counter: something slipped under a cloak. */
export function atCounter(S, L, p, hh, bid) {
  const shop = S.biz[bid], k = temptation(S, p);
  if (!shop || shop.stock < 2 || !k || !chance(S, 0.015 * k)) return;
  shop.stock--; hh.goods++;
  note(S, p, `Stole from ${bldName(L, L.blds[bid])}.`);
  crime(S, L, p, 'shoplift', shop.price, shop, `Caught stealing from ${bldName(L, L.blds[bid])},`, 0.3);
}

/** An evening at the tavern: drink beyond one's means, dice, a fight, a missing purse. */
export function atTavern(S, L, p, hh, bid) {
  const tav = S.biz[bid];
  if (!tav || !hh) return;
  if (drunkard(p)) {
    const n = moveMoney(hh, tav, 2 * randInt(S, 1, 3));
    tav.sales += n; S.econ.wk.drink += n;
    if (n) tally(S, 'vice', 'drinking bouts');
  }
  if (gambler(p) && hh.coins > 6 && chance(S, 0.4)) {
    const stake = Math.min(hh.coins * 0.15, 25);
    if (chance(S, 0.45)) moveMoney(tav, hh, stake); else { moveMoney(hh, tav, stake); tav.sales += stake; }
    tally(S, 'vice', 'games of dice');
    if (stake >= 15) note(S, p, 'Lost or won a heavy stake at dice.');
  }
  const tp = temper(p);
  if (tp >= 1 && chance(S, 0.008 * tp * (drunkard(p) ? 2 : 1))) brawl(S, L, p, bid);
  const k = temptation(S, p);
  if (k && chance(S, 0.004 * k)) {
    const v = victimNear(S, p, hh);
    if (v) {
      const n = moveMoney(v, hh, Math.min(v.coins * 0.06, randInt(S, 2, 7)));
      note(S, p, 'Lifted a purse at the tavern.');
      crime(S, L, p, 'pickpocket', n, v, `Caught lifting a purse at ${bldName(L, L.blds[bid])},`, 0.25);
    }
  }
}

function brawl(S, L, p, bid) {
  let foe = null;
  for (const q of S.people) if (q !== p && q.alive && q.in === bid && q.act === 'drink' && q.age >= 16) { foe = q; if (chance(S, 0.4)) break; }
  if (!foe) return;
  tally(S, 'crimes', 'brawl');
  const lose = chance(S, Math.max(0.15, Math.min(0.85, 0.5 + (temper(p) - temper(foe)) * 0.1))) ? foe : p, win = lose === p ? foe : p;
  const where = bldName(L, L.blds[bid]);
  grudge(S, lose, win);
  if (chance(S, 0.015)) {
    die(S, L, lose, `was killed in a brawl with ${fullName(win)} at ${where}`, 2, 'brawl');
    justice(S, L, win, 'manslaughter', 0, S.households[lose.hh], `${fullName(win)} killed ${fullName(lose)} in a brawl at ${where};`);
    return;
  }
  wound(S, L, lose, randInt(S, 1, 3), `Beaten in a brawl with ${fullName(win)}.`);
  const text = `${fullName(p)} and ${fullName(foe)} came to blows at ${where}; ${fullName(lose)} came off worse.`;
  if (chance(S, p.site === 0 ? 0.5 : 0.3)) justice(S, L, p, 'brawl', 0, null, text); else log(S, 'crime', 0, text, p.x, p.y, p.id);
}

// ---- crimes of the night -------------------------------------------------------------------

/** At midnight the tempted plan a burglary for the small hours, and old grudges may turn to murder. */
export function planNight(S, L) {
  const day = dayOf(S.t);
  for (const p of S.people) {
    if (!p.alive || p.away || p.plan || p.jail > S.t || p.sick > S.t || p.hurt > S.t || p.age < 15 || p.shift === 1 || p.job === 'trader') continue;
    const r = S.law[p.id];
    if (r && r.foe >= 0) {
      const q = S.people[r.foe];
      if (!q || !q.alive || q.away || day - r.foeT > 30) r.foe = -1;
      else if (q.site === p.site && q.hh !== p.hh && temper(p) >= 1.2 && honesty(p) <= -0.5 && chance(S, 0.008)) {
        p.plan = { k: 'murder', b: q.home, v: q.id, at: S.t + randInt(S, 60, 200) };
      }
    }
    if (!p.plan) {
      const k = temptation(S, p);
      if (!k || !chance(S, 0.0007 * k)) continue;
      const hh = S.households[p.hh];
      if (chance(S, 0.4)) {
        const shops = (L.sites[p.site] ? L.sites[p.site].shops.concat(L.sites[p.site].taverns) : []).filter((b) => S.biz[b] && !S.biz[b].closed && S.biz[b].coins > 30 && b !== p.work);
        if (shops.length) p.plan = { k: 'shop', b: pick(S, shops), v: -1, at: 0 };
      }
      if (!p.plan) {
        let best = null;
        for (let i = 0; i < 8; i++) { const h = victimNear(S, p, hh); if (h && h.coins > 40 && (!best || h.coins > best.coins)) best = h; }
        if (best) p.plan = { k: 'house', b: best.home, v: best.id, at: 0 };
      }
      if (!p.plan) continue;
      p.plan.at = S.t + randInt(S, 60, 210);
    }
    if (!p.route && p.act === 'sleep') p.until = Math.min(p.until, p.plan.at - 20);
  }
}

/** The deed itself, when the prowler has got inside. */
export function prowl(S, L, p) {
  const P = p.plan, hh = S.households[p.hh];
  p.plan = null;
  if (!P || !hh || p.in !== P.b) return;
  const b = L.blds[P.b], name = siteName(L, p);
  if (P.k === 'shop') {
    const B = S.biz[P.b];
    if (!B || B.closed) return;
    const n = moveMoney(B, hh, Math.min(B.coins * randRange(S, 0.15, 0.35), 70));
    note(S, p, `Broke into ${bldName(L, b)} at night and emptied the till.`);
    log(S, 'crime', n > 25 ? 1 : 0, `Thieves broke into ${bldName(L, b)} in ${name} in the night and took ${Math.round(n)} coins.`, b.x, b.y);
    crime(S, L, p, 'burglary', n, B, 'The night watch caught the thief:', 0.16);
    return;
  }
  if (P.k === 'house') {
    const v = S.households[P.v];
    if (!v || !v.m.length || v.home !== P.b) return;
    const inside = v.m.map((id) => S.people[id]).filter((q) => q.alive && q.in === P.b && q.age >= 15);
    if (inside.length && chance(S, 0.15)) {
      const q = pick(S, inside);
      if (temper(p) >= 1 && chance(S, 0.35)) {
        grudge(S, q, p);
        if (chance(S, 0.12)) {
          die(S, L, q, 'was killed by a burglar in the night', 2, 'murder');
          tally(S, 'crimes', 'murder');
          note(S, p, `Killed ${fullName(q)} during a burglary.`);
          crime(S, L, p, 'murder', 0, null, `${fullName(q)} was killed by a burglar in ${name}.`, 0.5);
        } else {
          wound(S, L, q, randInt(S, 2, 5), 'Struck down by a burglar in the night.');
          log(S, 'crime', 1, `A burglar struck down ${fullName(q)} in their own home in ${name}.`, b.x, b.y, q.id);
          crime(S, L, p, 'assault', 0, null, `The burglar who struck down ${fullName(q)} was found:`, 0.45);
        }
      } else {
        log(S, 'crime', 0, `${fullName(q)} woke and drove a burglar out of the house in ${name}.`, b.x, b.y, q.id);
        if (caught(S, L, p, 0.35)) justice(S, L, p, 'burglary', 0, null, `${fullName(q)} recognised the burglar:`);
      }
      return;
    }
    const n = moveMoney(v, hh, Math.min(v.coins * randRange(S, 0.1, 0.3), 60));
    for (const id of v.m) if (S.people[id].age >= 15) note(S, S.people[id], 'The house was robbed in the night.');
    note(S, p, `Robbed the house of the ${v.fam} family.`);
    log(S, 'crime', n > 25 ? 1 : 0, `Thieves broke into the house of the ${v.fam} family in ${name} and took ${Math.round(n)} coins.`, b.x, b.y);
    crime(S, L, p, 'burglary', n, v, `The burglar of the ${v.fam} house was caught:`, 0.12);
    return;
  }
  if (P.k === 'murder') {
    const q = S.people[P.v];
    if (!q || !q.alive || q.in !== P.b) return;
    const r = recOf(S, p);
    r.foe = -1;
    if (chance(S, q.act === 'sleep' ? 0.8 : 0.35)) {
      tally(S, 'crimes', 'murder');
      note(S, p, `Killed ${fullName(q)}.`);
      die(S, L, q, 'was murdered in the night', 2, 'murder');
      if (caught(S, L, p, 0.55)) justice(S, L, p, 'murder', 0, null, `${fullName(p)} was taken for the murder of ${fullName(q)} and`);
      else if (chance(S, 0.3)) banish(S, L, p, 'Fled the region after a killing.', `${fullName(p)} fled ${name} after the murder of ${fullName(q)}.`);
      else r.u += 2;
    } else {
      wound(S, L, q, randInt(S, 2, 6), `Attacked in the night by ${fullName(p)}.`);
      grudge(S, q, p);
      tally(S, 'crimes', 'assault');
      crime(S, L, p, 'assault', 0, null, `${fullName(p)} attacked ${fullName(q)} in the night;`, 0.6);
    }
  }
}

// ---- those in power ---------------------------------------------------------------------

const SKIM = new Set(['mayor', 'clerk', 'granary keeper', 'elder', 'steward']);

function dismiss(S, L, p, days, why) {
  replaceWorker(S, p);
  Object.assign(p, { job: 'labourer', work: -1, post: -1, shift: 0 });
  imprison(S, L, p, days, why);
}

/** Once a week: skimming, extortion, false arrests and the lord's demands. */
export function lawWeek(S, L) {
  const day = dayOf(S.t), lordHh = S.households[S.lord];
  const captain = S.people.find((q) => q.alive && q.job === 'captain'), crooked = captain && corrupt(captain);
  for (const p of S.people) {
    if (!p.alive || p.away || p.jail > S.t || !corrupt(p)) continue;
    const hh = S.households[p.hh];
    if (!hh) continue;
    if (SKIM.has(p.job)) {
      const purse = p.job === 'steward' ? lordHh : S.sites[p.site];
      if (!purse || purse === hh) continue;
      const r = recOf(S, p), n = moveMoney(purse, hh, Math.min(purse.coins * 0.01, 30));
      r.skim = Math.round((r.skim + n) * 100) / 100;
      tally(S, 'abuses', 'coins embezzled', Math.round(n));
      if (chance(S, 0.04 + r.skim / 2500)) {
        const back = moveMoney(hh, purse, r.skim);
        log(S, 'crime', 2, `${fullName(p)}, ${p.job} of ${siteName(L, p)}, was found to have stolen ${Math.round(r.skim)} coins from ${p.job === 'steward' ? 'the lord' : 'the treasury'}; ${Math.round(back)} were recovered.`, p.x, p.y, p.id);
        r.skim = 0; r.n++;
        tally(S, 'justice', 'officials removed');
        dismiss(S, L, p, 4, 'Dismissed and jailed for embezzlement.');
      }
    } else if (p.job === 'guard' && chance(S, 0.5)) {
      // a watchman "protects" the market for a fee
      const stalls = L.sites[0].market.concat(L.sites[0].shops).filter((b) => S.biz[b] && !S.biz[b].closed && S.biz[b].coins > 15);
      if (!stalls.length) continue;
      const bid = pick(S, stalls), n = moveMoney(S.biz[bid], hh, randInt(S, 3, 8));
      if (crooked) moveMoney(hh, S.households[captain.hh], n * 0.3);
      tally(S, 'abuses', 'extortions');
      if (!crooked && captain && chance(S, 0.08)) {
        log(S, 'crime', 1, `Captain ${fullName(captain)} found that ${fullName(p)} of the watch was extorting the market, and threw him out.`, p.x, p.y, p.id);
        tally(S, 'justice', 'officials removed');
        recOf(S, p).n++;
        dismiss(S, L, p, 3, 'Dismissed from the watch for extortion.');
      }
    }
  }
  // a crooked captain throws a poor man in the cells and takes his coins
  if (crooked && chance(S, 0.05)) {
    const poor = S.people.filter((q) => q.alive && !q.away && q.site === 0 && q.age >= 16 && q.job === 'labourer' && !(q.jail > S.t) && S.households[q.hh] && S.households[q.hh].coins / S.households[q.hh].m.length < 10);
    if (poor.length) {
      const q = pick(S, poor), n = moveMoney(S.households[q.hh], S.households[captain.hh], 6);
      imprison(S, L, q, 2, `Jailed by Captain ${fullName(captain)} on a false charge.`);
      grudge(S, q, captain);
      tally(S, 'abuses', 'false arrests');
      log(S, 'crime', 1, `Captain ${fullName(captain)} threw ${fullName(q)} in the cells on a charge few believe${n ? `, and kept ${Math.round(n)} coins as a "fine"` : ''}.`, q.x, q.y, q.id);
    }
  }
  // a grasping lord short of money demands an extraordinary levy
  const lord = S.people.find((q) => q.alive && q.job === 'lord');
  if (lord && lordHh && (honesty(lord) <= -0.5 || lord.traits.includes('greedy') || lord.traits.includes('proud')) && lordHh.coins < 2200 && day - (S.levyDay ?? -99) > 24 && chance(S, 0.3)) {
    S.levyDay = day;
    let got = 0, short = 0;
    for (const h of S.households) {
      if (!h.m.length || h.id === S.lord) continue;
      const n = moveMoney(h, lordHh, 4);
      got += n;
      if (n < 3.9) { h.arrears++; short++; }
    }
    tally(S, 'abuses', 'levies');
    const k = L.blds[L.sites[0].keep];
    log(S, 'town', 2, `${fullName(lord)}, lord of ${L.sites[0].name}, demanded an extraordinary levy of 4 coins from every household and collected ${Math.round(got).toLocaleString('en-US')}${short ? `; ${short} households could not pay in full and fell into arrears` : ''}.`, k.x, k.y, lord.id);
  }
}

// ---- taxes and gifts ------------------------------------------------------------------------

/** The person who answers for a household: its eldest working-age adult. */
function headOf(S, hh) {
  let best = null;
  for (const id of hh.m) { const q = S.people[id]; if (q.age >= 18 && (!best || (q.age < 65 && q.age > best.age) || best.age >= 65)) best = q; }
  return best;
}
/** Does this household hide what it owes from the tax collectors? */
export function dodger(S, hh) {
  const h = headOf(S, hh);
  return Boolean(h) && honesty(h) <= -1;
}
/** A household hid `amount` coins of tax this week: the collectors may find out. */
export function evade(S, L, hh, amount) {
  hh.owed = (hh.owed || 0) + amount;
  tally(S, 'crimes', 'coins of tax hidden', Math.round(amount));
  if (!chance(S, hh.site === 0 ? 0.05 : 0.035)) return;
  const site = S.sites[hh.site], fine = moveMoney(hh, site, hh.owed * 2), head = headOf(S, hh);
  if (head) { recOf(S, head).n++; note(S, head, `Fined ${Math.round(fine)} coins for hiding money from the tax collectors.`); }
  tally(S, 'justice', 'tax fines');
  log(S, 'crime', 0, `The tax collectors of ${L.sites[hh.site].name} found that the ${hh.fam} family had hidden ${Math.round(hh.owed)} coins of tax, and fined them ${Math.round(fine)}.`, L.blds[hh.home].x, L.blds[hh.home].y, head ? head.id : undefined);
  hh.owed = 0;
}

/** Share of a household's coins given at prayer: the devout and the generous give, the greedy keep theirs. */
export function generosity(p) {
  const h = honesty(p);
  if (p.traits.includes('greedy') || p.traits.includes('cynical') || h < -0.5) return 0;
  return p.traits.includes('devout') || p.traits.includes('generous') || p.traits.includes('kind') ? 0.05 : h > 0 ? 0.03 : 0.015;
}
