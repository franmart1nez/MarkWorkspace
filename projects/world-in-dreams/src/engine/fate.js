// What can befall a person: wounds, death, and who steps into an empty post.
import { pick } from './rng.js';
import { DAY, log, note, route, nodeNear } from './core.js';

const NOTABLE = new Set(['lord', 'mayor', 'captain', 'elder', 'priest', 'innkeeper', 'steward']);
const PLAIN = new Set(['labourer', 'homemaker', 'retired', 'child', 'trader']);
export const isNotable = (p) => NOTABLE.has(p.job);
export const fullName = (p) => `${p.name} ${p.fam}`;

/** Walk home from wherever the person stands, dropping what they were doing. */
export function sendHome(S, L, p, act, until) {
  const b = L.blds[p.home];
  if (!b) return;
  if (p.in === p.home) { p.act = act; p.until = until; p.route = null; return; }
  const from = p.in >= 0 ? { x: L.blds[p.in].dx, y: L.blds[p.in].dy, n: L.blds[p.in].n } : { x: p.x, y: p.y, n: nodeNear(L, p.x, p.y) };
  p.x = from.x; p.y = from.y; p.in = -1;
  p.route = route(L, from, { x: b.dx, y: b.dy, n: b.n });
  Object.assign(p, { ri: 0, db: b.id, dn: b.n, na: act, nu: until, nd: 0, act: 'walk', wild: false, cart: false, load: 0, q: -1 });
}

export function wound(S, L, p, days, why) {
  if (!p.alive) return;
  p.hurt = S.t + days * DAY;
  note(S, p, why);
  if (p.home >= 0) sendHome(S, L, p, 'rest', S.t + 120);
}

/** Someone without a trade of their own takes over the work of `p`. */
export function replaceWorker(S, p) {
  if (PLAIN.has(p.job)) return null;
  const cand = S.people.filter((q) => q.alive && !q.away && q.site === p.site && q.job === 'labourer' && q.age >= 16 && q.age < 55);
  if (!cand.length) return null;
  const q = pick(S, cand);
  Object.assign(q, { job: p.job, work: p.work, shift: p.shift, post: p.post, fi: p.fi, farm: p.farm });
  note(S, q, `Took over as ${p.job} after ${fullName(p)}.`);
  return q;
}

export function die(S, L, p, cause, imp = 0) {
  if (!p.alive) return;
  p.alive = false;
  p.died = S.t;
  p.route = null;
  S.died++;
  note(S, p, `Died: ${cause}.`);
  const where = L.sites[p.site] ? L.sites[p.site].name : 'the road';
  const heir = replaceWorker(S, p);
  log(S, 'life', Math.max(imp, isNotable(p) ? 2 : 0), `${fullName(p)}, ${p.job} of ${where}, ${cause} at ${p.age}.${heir && isNotable(p) ? ` ${fullName(heir)} takes the post.` : ''}`, p.x, p.y, p.id);
  if (p.spouse >= 0) { const sp = S.people[p.spouse]; sp.spouse = -1; note(S, sp, `Lost ${p.name}.`); p.spouse = -1; }
  const hh = S.households[p.hh];
  if (!hh) return;
  hh.m = hh.m.filter((id) => id !== p.id);
  leaveEmpty(S, hh);
}

/** Close a household that has no adults left; children go to neighbours. */
export function leaveEmpty(S, hh) {
  if (hh.m.some((id) => S.people[id].age >= 15)) return;
  const hosts = S.households.filter((h) => h.site === hh.site && h.id !== hh.id && h.m.length > 0 && h.m.length < 6 && h.m.some((id) => S.people[id].age >= 20));
  for (const id of hh.m) {
    const kid = S.people[id], host = hosts.length ? pick(S, hosts) : null;
    if (!host) continue;
    kid.hh = host.id; kid.home = host.home;
    host.m.push(kid.id);
    note(S, kid, `Taken in by the ${host.fam} household.`);
  }
  if (hosts.length || !hh.m.length) { hh.m = []; delete S.occ[hh.home]; }
}
