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

export const unitLabel = (unit: WeightUnit = getWeightUnit()): string =>
  unit === 'lbs' ? 'lb' : unit === 'st' ? 'st' : 'kg';

// Numeric value of a kg amount in the chosen unit (stone as a decimal, e.g. 15.8).
// Linear through the origin, so it's also correct for deltas (e.g. "3.2 kg to go").
export const kgToUnitValue = (kg: number, unit: WeightUnit = getWeightUnit()): number =>
  unit === 'lbs' ? kgToLbs(kg) : unit === 'st' ? kgToLbs(kg) / 14 : kg;

// Inverse: a value the user typed in their unit → canonical kg.
export const unitValueToKg = (value: number, unit: WeightUnit = getWeightUnit()): number =>
  unit === 'lbs' ? lbsToKg(value) : unit === 'st' ? lbsToKg(value * 14) : value;

// Read-only display of a canonical kg value: a single decimal + unit ("15.8 st").
export function formatWeightKg(kg: number, unit: WeightUnit = getWeightUnit()): string {
  if (!kg || kg <= 0) return '—';
  return `${Math.round(kgToUnitValue(kg, unit) * 10) / 10} ${unitLabel(unit)}`;
}
