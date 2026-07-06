// Weight-unit preference + conversions.
//
// IMPORTANT: storage and ALL plan-engine math are always in kilograms. This
// module only converts at the input/display boundary so a user can log and
// read weights in their preferred unit without changing the healthy-loss math.
import { useState, useEffect } from 'react';

export type WeightUnit = 'kg' | 'lbs' | 'st';

const KEY = 'superdub.weightUnit';
const CHANGE_EVENT = 'superdub:weight-unit-changed';
const LBS_PER_KG = 2.20462;

export function getWeightUnit(): WeightUnit {
  const u = localStorage.getItem(KEY);
  return u === 'lbs' || u === 'st' ? u : 'kg';
}

export function setWeightUnit(unit: WeightUnit): void {
  localStorage.setItem(KEY, unit);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Re-renders the caller whenever the preference changes (same tab or another).
export function useWeightUnit(): WeightUnit {
  const [unit, setUnit] = useState<WeightUnit>(getWeightUnit);
  useEffect(() => {
    const sync = () => setUnit(getWeightUnit());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync); // other tabs
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return unit;
}

export const kgToLbs = (kg: number): number => kg * LBS_PER_KG;
export const lbsToKg = (lbs: number): number => lbs / LBS_PER_KG;

// Stone is conventionally two parts: whole stone + remaining pounds (0–13.9).
export function kgToStLb(kg: number): { st: number; lb: number } {
  const totalLbs = kg * LBS_PER_KG;
  let st = Math.floor(totalLbs / 14);
  let lb = Math.round((totalLbs - st * 14) * 10) / 10;
  if (lb >= 14) { st += 1; lb = 0; } // rounding edge: 13.97 lb → next stone
  return { st, lb };
}
export const stLbToKg = (st: number, lb: number): number => lbsToKg(st * 14 + lb);

export const unitLabel = (unit: WeightUnit = getWeightUnit()): string =>
  unit === 'lbs' ? 'lb' : unit === 'st' ? 'st' : 'kg';

// Read-only display for a canonical kg value (chart labels, "current weight").
export function formatWeightKg(kg: number, unit: WeightUnit = getWeightUnit()): string {
  if (!kg || kg <= 0) return '—';
  if (unit === 'lbs') return `${Math.round(kgToLbs(kg) * 10) / 10} lb`;
  if (unit === 'st') { const { st, lb } = kgToStLb(kg); return `${st} st ${lb} lb`; }
  return `${Math.round(kg * 10) / 10} kg`;
}
