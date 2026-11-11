// The daily timetable of every inhabitant: when the sun rises and sets, when a
// person wakes, works, eats and goes to bed. Farmers and bakers rise in the dark
// and sleep early; tavern folk and the night watch keep late hours; winter nights
// are long and summer nights short. A late night leaves a sleep debt that is
// paid back by going to bed earlier, or by sleeping in on the rest day.
import { DAY, WEEK, YEAR_DAYS, dayOf } from './core.js';
import { jobOf } from './people.js';

const H = 60;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAWN = new Set(['farmer', 'shepherd']);
const EARLY = { baker: 30, fisher: 45, hunter: 45 }; // minutes between waking and leaving
const LATE = new Set(['innkeeper', 'tavern hand']);

/** Hours of daylight and the times of sunrise and sunset (minutes of the day). The longest day falls in mid-summer. */
export function sunOf(t) {
  const phase = ((dayOf(t) % YEAR_DAYS) + 0.5) / YEAR_DAYS;
  const len = 12.25 + 3.75 * Math.cos(2 * Math.PI * (phase - 0.375));
  return { len, rise: Math.round((12.75 - len / 2) * H), set: Math.round((12.75 + len / 2) * H) };
}

/** Minutes of sleep a grown person needs: about 7½ hours in summer, 9 in mid-winter. */
const needOf = (sun, age) => Math.round((8.25 - (sun.len - 12.25) * 0.25) * H + (age < 15 ? 2.5 * H : 0));

/** The usual bedtime of the season for people with no early trade: two hours or so after dark. */
const bedOf = (sun) => clamp(sun.set + 2.25 * H, 20.25 * H, 22 * H);

/**
 * The plan of a person's day: s and e are the working hours; wake and bed the
 * times they get up and go to sleep (minutes of the day, possibly past
 * midnight); need is the sleep they want. All derived from state, nothing stored.
 */
export function planOf(S, p, J, spouse = true) {
  const t = S.t, m = t % DAY, day = dayOf(t), sun = sunOf(t), need = needOf(sun, p.age);
  const wakeDay = m >= 12 * H ? day + 1 : day, bedDay = m < 12 * H ? day - 1 : day;
  const restMorning = wakeDay % WEEK === WEEK - 1, restEve = bedDay % WEEK === WEEK - 2;
  const tr = p.traits, off = p.off;
  if (p.shift === 1) return { s: 18 * H, e: 30 * H, wake: 14.5 * H + off, bed: 7.2 * H + off, need };
  let s = (J.s ?? 7) * H, e = (J.e ?? 17) * H, lead = EARLY[p.job] || 60;
  if (DAWN.has(p.job)) { s = clamp(sun.rise - 15, 5 * H, 7.25 * H); e = clamp(sun.set - 30, 16.5 * H, 19.5 * H); lead = 45; } else if (p.job === 'fisher' || p.job === 'hunter') s = clamp(sun.rise - 30, 4.5 * H, 7 * H);
  else if (p.job === 'woodcutter') { s = Math.max(s, sun.rise); e = Math.min(e, sun.set - 30); } else if (J.t === 'in' || J.t === 'stall' || J.t === 'labour') {
    // workshops work by daylight: a later start and an earlier end in the dark months
    if (sun.rise > 7.5 * H) s += 30;
    if (!LATE.has(p.job)) e = Math.max(s + 7 * H, Math.min(e, sun.set + 45));
  }
  let bed = bedOf(sun), wake;
  const works = J.t !== 'none' && J.t !== 'home' && J.t !== 'trade';
  if (LATE.has(p.job)) { bed = e + 30; wake = bed + need; } else if (works) {
    wake = s - lead;
    bed = Math.max(19 * H, Math.min(bed, wake - need + DAY), e + 75);
    if (p.job === 'adventurer') { bed = bedOf(sun) + 75; wake = Math.max(wake, bed + need - DAY); }
    if (p.job === 'lord' || p.job === 'mayor') bed += 50; // candles are cheap for them
  } else if (p.age < 4) { bed = 19 * H; wake = bed + 11 * H - DAY; } else if (p.age < 15) {
    bed = 19.75 * H + (p.age - 4) * 7;
    wake = bed + need - (p.age - 4) * 6 - DAY;
  } else {
    // homemakers rise first to make the breakfast and go to bed with their spouse
    const sp = spouse && p.spouse >= 0 ? S.people[p.spouse] : null;
    if (sp && sp.alive && sp.hh === p.hh && !sp.away) {
      const q = planOf(S, sp, jobOf(sp), false);
      bed = q.bed; wake = q.wake - 20;
    } else {
      // the old go to bed early and are up before dawn
      if (p.age > 62 && sun.len > 12.25) bed -= 30;
      wake = bed + need - DAY;
    }
  }
  // character and the week: the lazy lie in, night owls sit up, the rest day is for sleeping
  if (tr.includes('lazy')) wake += 15;
  if (tr.includes('diligent')) wake -= 15;
  if (tr.includes('dreamy') || tr.includes('curious')) bed += 20;
  if (restEve && !LATE.has(p.job)) bed += 45;
  if (restMorning && !DAWN.has(p.job) && !LATE.has(p.job) && p.job !== 'baker' && J.t !== 'guard') wake += 70 + Math.min(120, p.debt || 0);
  bed -= Math.min(90, (p.debt || 0) * 0.5);
  wake = Math.max(wake, bed + 6.5 * H - DAY);
  return { s, e, wake: Math.round(wake + off), bed: Math.round(bed + off), need };
}

/**
 * Is a meal due? Three meals in the waking day: on rising, around the middle of
 * the day and a supper a couple of hours before bed. `ate` is when the last
 * meal ended. A long fast always makes one due.
 */
export function mealDue(t, plan, ate) {
  const m = t % DAY, awake = (((plan.bed - plan.wake) % DAY) + DAY) % DAY, a = (((m - plan.wake) % DAY) + DAY) % DAY;
  if (t - ate > 420) return true;
  if (a > awake) return false;
  const slot = a >= awake - 150 ? awake - 150 : a >= Math.round(awake / 2) - 40 ? Math.round(awake / 2) - 40 : 0;
  return ate < t - (a - slot);
}

/** Absolute time of the next meal after t, used to break work for dinner. */
export function nextMeal(t, plan) {
  const m = t % DAY, awake = (((plan.bed - plan.wake) % DAY) + DAY) % DAY, a = (((m - plan.wake) % DAY) + DAY) % DAY;
  for (const slot of [Math.round(awake / 2) - 40, awake - 150]) if (a < slot) return t + slot - a;
  return t + DAY;
}
