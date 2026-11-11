// What can befall a person: wounds, death, banishment, the funeral that follows
// a death, and who steps into an empty post.
import { pick } from './rng.js';
import { DAY, log, note, route, nodeNear, nextAt, tally } from './core.js';
import { closeEstate, healer } from './economy.js';

const NOTABLE = new Set(['lord', 'mayor', 'captain', 'elder', 'priest', 'innkeeper', 'steward']);
const PLAIN = new Set(['labourer', 'homemaker', 'retired', 'child', 'trader']);
export const isNotable = (p) => NOTABLE.has(p.job);
export const fullName = (p) => `${p.name} ${p.fam}`;

/** Walk to building bid from wherever the person stands, dropping what they were doing. */
export function sendTo(S, L, p, bid, act, until) {
  const b = L.blds[bid];
  if (!b) return;
  if (p.in === bid) { p.act = act; p.until = until; p.route = null; return; }
  const from = p.in >= 0 ? { x: L.blds[p.in].dx, y: L.blds[p.in].dy, n: L.blds[p.in].n } : { x: p.x, y: p.y, n: nodeNear(L, p.x, p.y) };
  p.x = from.x; p.y = from.y; p.in = -1; p.seat = -1;
  p.route = route(L, from, { x: b.dx, y: b.dy, n: b.n });
  Object.assign(p, { ri: 0, db: b.id, dn: b.n, na: act, nu: until, nd: 0, act: 'walk', wild: false, cart: false, load: 0, q: -1 });
}
export const sendHome = (S, L, p, act, until) => sendTo(S, L, p, p.home, act, until);

export function wound(S, L, p, days, why) {
  if (!p.alive) return;
  p.hurt = S.t + days * DAY;
  note(S, p, why);
  healer(S, L, p);
  if (p.home >= 0 && p.jail <= S.t) sendHome(S, L, p, 'rest', S.t + 120);
}

/** Someone without a trade of their own takes over the work of `p`. */
export function replaceWorker(S, p) {
  if (PLAIN.has(p.job)) return null;
  if (p.work >= 0 && S.biz[p.work] && S.biz[p.work].closed) return null;
  const cand = S.people.filter((q) => q.alive && !q.away && q.site === p.site && q.job === 'labourer' && q.age >= 16 && q.age < 55 && !(q.jail > S.t));
  if (!cand.length) return null;
  const q = pick(S, cand);
  Object.assign(q, { job: p.job, work: p.work, shift: p.shift, post: p.post, fi: p.fi, farm: p.farm });
  if (!q.route) q.until = Math.min(q.until, S.t + 1); // start the new trade at the next decision
  note(S, q, `Took over as ${p.job} after ${fullName(p)}.`);
  return q;
}

/** Take a person out of their household (death or banishment) and close it if no adult is left. */
function leaveHousehold(S, p) {
  if (p.spouse >= 0) { const sp = S.people[p.spouse]; sp.spouse = -1; note(S, sp, `Lost ${p.name}.`); p.spouse = -1; }
  const hh = S.households[p.hh];
  if (!hh) return;
  hh.m = hh.m.filter((id) => id !== p.id);
  leaveEmpty(S, hh);
}

/** The family and friends gather at the temple, the chapel or the house the next morning. */
function funeral(S, L, p) {
  const site = L.sites[p.site];
  if (!site) return;
  const hh = S.households[p.hh], b = site.temple >= 0 ? site.temple : hh && hh.m.length ? hh.home : -1;
  if (b < 0) return;
  const ids = new Set();
  for (const id of hh ? hh.m : []) if (S.people[id].age >= 6) ids.add(id);
  for (const id of [p.spouse, p.mom, p.dad, ...p.friends]) if (id >= 0 && S.people[id] && S.people[id].alive && !S.people[id].away && S.people[id].site === p.site) ids.add(id);
  for (const q of S.people) if ((q.mom === p.id || q.dad === p.id) && q.alive && !q.away && q.site === p.site) ids.add(q.id);
  ids.delete(p.id);
  if (!ids.size) return;
  S.rites.push({ t: nextAt(S.t + 12 * 60, 10 * 60 + (p.id % 5) * 12), b, who: p.id, ids: [...ids].slice(0, 16) });
}

/**
 * Death. `kind` is the cause counted in the yearly tally: old age, illness,
 * infancy, hunger, cold, childbirth, accident, wolves, boar, quest, murder,
 * brawl or hanged.
 */
export function die(S, L, p, cause, imp = 0, kind = 'illness') {
  if (!p.alive) return;
  p.alive = false;
  p.died = S.t;
  p.route = null;
  S.died++;
  tally(S, 'deaths', kind);
  note(S, p, `Died: ${cause}.`);
  const where = L.sites[p.site] ? L.sites[p.site].name : 'the road';
  const heir = replaceWorker(S, p);
  log(S, kind === 'murder' || kind === 'hanged' ? 'crime' : 'life', Math.max(imp, isNotable(p) ? 2 : 0), `${fullName(p)}, ${p.job} of ${where}, ${cause} at ${p.age}.${heir && isNotable(p) ? ` ${fullName(heir)} takes the post.` : ''}`, p.x, p.y, p.id);
  if (kind !== 'hanged') funeral(S, L, p);
  leaveHousehold(S, p);
}

/** A person leaves the region for good: banished by a court, or fled. Their family stays. */
export function banish(S, L, p, why, text) {
  if (!p.alive) return;
  p.alive = false;
  p.gone = true;
  p.route = null;
  replaceWorker(S, p);
  note(S, p, why);
  log(S, 'crime', 1, text, p.x, p.y, p.id);
  leaveHousehold(S, p);
}

/** Close a household that has no adults left; children go to neighbours. */
export function leaveEmpty(S, hh) {
  if (hh.m.some((id) => S.people[id].age >= 15)) return;
  const hosts = S.households.filter((h) => h.site === hh.site && h.id !== hh.id && h.m.length > 0 && h.m.length < 6 && h.m.some((id) => S.people[id].age >= 20));
  let heir = null;
  for (const id of hh.m) {
    const kid = S.people[id], host = hosts.length ? pick(S, hosts) : null;
    if (!host) continue;
    kid.hh = host.id; kid.home = host.home;
    host.m.push(kid.id);
    heir ||= host;
    note(S, kid, `Taken in by the ${host.fam} household.`);
  }
  if (hosts.length || !hh.m.length) { hh.m = []; delete S.occ[hh.home]; closeEstate(S, hh, heir); }
}
