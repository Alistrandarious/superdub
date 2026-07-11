// Runnable self-check for Dub's pronoun helper. Run: npx tsx src/dubPronouns.check.ts
import assert from 'assert';
import { dubPronouns, dubHas } from './dubPronouns';

const she = dubPronouns('she');
assert(she.subject === 'she' && she.object === 'her' && she.possessive === 'her' && !she.isPlural, 'she');

const he = dubPronouns('he');
assert(he.subject === 'he' && he.object === 'him' && he.possessive === 'his' && !he.isPlural, 'he');

const they = dubPronouns('they');
assert(they.subject === 'they' && they.object === 'them' && they.possessive === 'their' && they.isPlural, 'they');

assert(dubHas('he') === 'has' && dubHas('she') === 'has' && dubHas('they') === 'have', 'verb agreement');

console.log('✓ dubPronouns checks passed');
