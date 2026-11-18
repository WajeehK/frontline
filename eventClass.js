// Confirmed-event + animation classifier (keyword + tense rules, no AI).
// Port of scripts/event_class.py — keep the two in sync. Used so already-stored
// headlines get the same animation gate as newly fetched ones.
const SPECULATIVE = /\b(weighs?|weighing|consider(?:s|ed|ing)?|mulls?|mulling|options?|optionally|could|would|may|might|should|warns?|warning|threatened|threatens?|vows?|vow(?:ed|ing)|plans? to|planning to|prepar(?:e|es|ed|ing) to|ready to|ready for|seeks?|seeking|calls? (?:for|on)|urg(?:e|es|ed|ing)|wants?|demands?|asks? (?:for|to)|predicts?|expects?|expected to|likely to|possible|possibility|potential(?:ly)?|hypothetical|scenario|in case|if necessary|to (?:strike|attack|bomb|hit|invade|launch|target))\b/i;
const CONTEXT_OK = /\b(after|amid|following|in the wake of|despite)\b/i;
const COMPLETED = /\b(struck|strikes|striking|hit|hits|hitting|attacked|attacks|attacking|attack|bombed|bombs|bombing|shelled|shells|shelling|pounded|pounds|launched|launches|launching|fired|fires|firing|killed|kills|killing|wounded|injured|dead|intercepted|intercepts|intercepting|intercept|shot down|shoots down|shooting down|downed|downs|captured|captures|capturing|seized|seizes|seizing|boarded|boards|destroyed|destroys|destroying|damaged|damages|exploded|explodes|explosion|explosions|blasts?|ablaze|caught fire|catch(?:es)? fire|sank|sinks|sunk|raided|raids|agreed|agrees|agree|signed|signs|takes effect|took effect|declared|declares|advanc(?:e|es|ed|ing)|deployed|deploys|clashed|clashes|fighting|hacked|hacks|breached|breaches)\b/i;
const COMMENTARY = /(\b(analysis|opinion|op-?ed|explainer|column|commentary|podcast|editorial)\b|\?$|^\s*(what|why|how|who is|could|will|is)\b)/i;
const QUOTED = /^\s*['"‘“]/;
const DENIAL = /\b(denies|denied|deny|false|fake|no evidence|hoax|debunk\w*|rumou?rs?)\b/i;
const CEASEFIRE = /\b(cease[- ]?fire|truce|armistice)\b.*\b(agreed|agrees|agree|signed|signs|takes effect|took effect|declared|declares|announced|announces|reached|in effect|holds|held)\b|\b(agreed|agrees|agree|signed|signs|declared|announced|reached)\b.*\b(cease[- ]?fire|truce|armistice)\b/i;
const DRONE = /\b(drones?|uavs?|shaheds?|unmanned (?:aerial )?vehicles?|loitering munitions?)\b/i;
const CAPTURE = /\b(captured|captures|capturing|shot down|shoots down|downed|downs|intercepted|intercepts|intercept|forced down|force down|forced landing|recovered|secures?|secured)\b/i;
const TANKER = /\b(tankers?|oil tankers?|crude carriers?|merchant (?:ship|vessel)s?|cargo ships?|bulk carriers?)\b/i;
const SHIP = /\b(ships?|vessels?|boats?|warships?|frigates?|destroyers?)\b/i;
const SEIZE = /\b(seized|seizes|seizing|seizure|boarded|boards|boarding|impounded|detained at sea)\b/i;
const MISSILE = /\b(missiles?|ballistic|cruise missile|rockets?|hypersonic|icbm|iskanders?|kinzhals?)\b/i;
const AIR = /\b(air ?strikes?|airstrikes?|air raids?|warplanes?|fighter jets?|\bjets\b|bombers?)\b/i;
const ARTY = /\b(artillery|shelling|howitzers?|grad |mlrs|rocket barrage|pounded|pounds)\b/i;
const TROOP = /\b(troops?|convoy|soldiers?|ground (?:forces|offensive|assault|incursion)|advanc(?:e|es|ed|ing)|deploy(?:s|ed|ment)|mobili[sz]\w+)\b/i;
const CYBER = /\b(cyber[- ]?attacks?|\bcyber\b|hack(?:ed|ers|ing)?|data breach)\b/i;
const NUKE_SITE = /\b(nuclear (?:site|facility|plant|reactor|complex)|enrichment|natanz|fordow|bushehr|zaporizhzhia nuclear|dimona)\b/i;
const FACILITY = /\b(bases?|air ?bases?|airfields?|facilit(?:y|ies)|refiner(?:y|ies)|depots?|ports?|headquarters|\bhq\b|barracks|installations?|compounds?|plants?|terminals?|power station|substations?|radar)\b/i;
const BLAST = /\b(explosions?|blasts?|blew up|blows up)\b/i;
const NO_ANIM = new Set(['statement', 'threat', 'legal', 'sanctions', 'diplomacy']);

export function isSpeculative(title) {
  const t = String(title || '').trim();
  if (!t) return true;
  if (COMMENTARY.test(t) || DENIAL.test(t) || QUOTED.test(t)) return true;
  if (SPECULATIVE.test(t) && !(CONTEXT_OK.test(t) && COMPLETED.test(t))) return true;
  return false;
}
export function isConfirmed(title, typ) {
  const t = String(title || '').trim();
  if (!t || isSpeculative(t)) return false;
  if (typ === 'diplomacy' && CEASEFIRE.test(t)) return true;
  if ((typ === 'cyber' || typ === 'deploy') && COMPLETED.test(t)) return true;
  if (NO_ANIM.has(typ)) return false;
  return COMPLETED.test(t);
}
export function animOf(title, typ) {
  const t = title || '';
  if (!isConfirmed(t, typ)) return 'none';
  if (CEASEFIRE.test(t)) return 'ceasefire';
  if (DRONE.test(t) && CAPTURE.test(t)) return 'drone_capture';
  if (SEIZE.test(t) && (TANKER.test(t) || SHIP.test(t))) return 'seizure';
  if (TANKER.test(t) && (COMPLETED.test(t) || BLAST.test(t))) return 'tanker';
  if (NUKE_SITE.test(t) && (COMPLETED.test(t) || BLAST.test(t))) return 'nuclear_site';
  if (MISSILE.test(t)) return 'missile';
  if (AIR.test(t)) return 'air';
  if (DRONE.test(t)) return 'drone';
  if (ARTY.test(t)) return 'artillery';
  if (typ === 'cyber' || CYBER.test(t)) return 'cyber';
  if (typ === 'deploy' || (TROOP.test(t) && (typ === 'deploy' || typ === 'ground' || typ == null || typ === 'naval'))) return 'troop';
  if (typ === 'ground' || ARTY.test(t)) return ARTY.test(t) ? 'artillery' : 'troop';
  if ((FACILITY.test(t) || typ === 'blast') && (BLAST.test(t) || COMPLETED.test(t))) return 'facility';
  if (typ === 'naval') return TANKER.test(t) ? 'tanker' : SEIZE.test(t) ? 'seizure' : 'blast';
  if (typ === 'mine') return TANKER.test(t) ? 'tanker' : 'blast';
  if (['missile', 'drone', 'air', 'ground', 'blast'].includes(typ)) return typ === 'ground' ? 'artillery' : typ;
  if (BLAST.test(t)) return 'blast';
  return 'none';
}
export function annotateEvent(e) {
  if (!e) return e;
  if (e.anim && e.anim !== 'none' && e.confirmed != null) return e;
  // If the pipeline already stored a value, keep it; otherwise classify from the headline.
  if (e.anim == null || e.confirmed == null) {
    const anim = e.anim && e.anim !== 'none' ? e.anim : animOf(e.title, e.type);
    const confirmed = e.confirmed != null ? !!e.confirmed : anim !== 'none';
    e.anim = anim; e.confirmed = confirmed;
  } else {
    e.confirmed = !!e.confirmed;
  }
  return e;
}
