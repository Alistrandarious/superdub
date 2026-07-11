// Dub's gender is a cosmetic choice, stored client-side like species/colour.
// Default is 'he' (Dub has always been informally "he"). Changing it fires
// 'superdub:mascot-changed', the same event species/colour use, so live surfaces
// refresh. This helper is the single place third-person Dub copy reads pronouns.

export type DubGender = 'he' | 'she' | 'they';
export const DUB_GENDER_KEY = 'superdub.dubGender';

export function getDubGender(): DubGender {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(DUB_GENDER_KEY) : null;
  return v === 'she' || v === 'they' ? v : 'he';
}

export interface Pronouns {
  subject: string;     // he / she / they  ("… what he found")
  object: string;      // him / her / them
  possessive: string;  // his / her / their
  isPlural: boolean;   // they → plural verb agreement
}

const TABLE: Record<DubGender, Pronouns> = {
  he:   { subject: 'he',   object: 'him',  possessive: 'his',   isPlural: false },
  she:  { subject: 'she',  object: 'her',  possessive: 'her',   isPlural: false },
  they: { subject: 'they', object: 'them', possessive: 'their', isPlural: true },
};

export function dubPronouns(gender: DubGender = getDubGender()): Pronouns {
  return TABLE[gender];
}

// Small helper for "he has / they have" style agreement.
export function dubHas(gender: DubGender = getDubGender()): string {
  return TABLE[gender].isPlural ? 'have' : 'has';
}
