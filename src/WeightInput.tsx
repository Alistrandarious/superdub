// A weight entry field that speaks the user's chosen unit but reports kg.
//
// value/onChange are ALWAYS canonical kg (string, '' = empty). Internally it
// shows kg, lb, or st+lb; conversion happens only here so callers never touch
// unit math. Stone renders two inputs (st + lb) — the conventional format.
import { useState, useEffect } from 'react';
import { WeightUnit, kgToLbs, lbsToKg, kgToStLb, stLbToKg } from './weightUnit';

interface Props {
  valueKg: string;                     // canonical kg ('' allowed)
  onChangeKg: (kg: string) => void;
  unit: WeightUnit;
  inputClassName?: string;
  wrapClassName?: string;              // extra class on the wrapper (e.g. block layout)
  id?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  ariaLabel?: string;
}

const clean = (s: string) => s.replace(/[^0-9.]/g, '');
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function WeightInput({
  valueKg, onChangeKg, unit, inputClassName, wrapClassName, id, autoFocus, onEnter, ariaLabel,
}: Props) {
  // Local display strings so partial typing (e.g. "8.") isn't clobbered by
  // round-tripping through kg on every keystroke.
  const [single, setSingle] = useState('');
  const [st, setSt] = useState('');
  const [lb, setLb] = useState('');

  // Re-hydrate display when the canonical value or unit changes externally
  // (prefill, unit toggle) — but not from our own edits, which already match.
  useEffect(() => {
    const kg = parseFloat(valueKg);
    if (!valueKg || isNaN(kg)) { setSingle(''); setSt(''); setLb(''); return; }
    if (unit === 'kg') setSingle(String(round1(kg)));
    else if (unit === 'lbs') setSingle(String(round1(kgToLbs(kg))));
    else { const s = kgToStLb(kg); setSt(String(s.st)); setLb(String(s.lb)); }
  }, [valueKg, unit]);

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); onEnter?.(); }
  };

  if (unit === 'st') {
    const emit = (stVal: string, lbVal: string) => {
      const s = parseFloat(stVal) || 0;
      const l = parseFloat(lbVal) || 0;
      onChangeKg(s === 0 && l === 0 && stVal === '' && lbVal === '' ? '' : String(round1(stLbToKg(s, l))));
    };
    return (
      <span className={`weight-input-st${wrapClassName ? ' ' + wrapClassName : ''}`}>
        <input
          className={inputClassName} inputMode="decimal" value={st} id={id} autoFocus={autoFocus}
          aria-label={ariaLabel ? `${ariaLabel} (stone)` : 'Weight (stone)'}
          onChange={e => { const v = clean(e.target.value); setSt(v); emit(v, lb); }}
          onKeyDown={key} placeholder="0" />
        <span className="weight-input-unit">st</span>
        <input
          className={inputClassName} inputMode="decimal" value={lb}
          aria-label={ariaLabel ? `${ariaLabel} (pounds)` : 'Weight (pounds)'}
          onChange={e => { const v = clean(e.target.value); setLb(v); emit(st, v); }}
          onKeyDown={key} placeholder="0" />
        <span className="weight-input-unit">lb</span>
      </span>
    );
  }

  const emitSingle = (v: string) => {
    if (v === '') { onChangeKg(''); return; }
    const n = parseFloat(v);
    if (isNaN(n)) { onChangeKg(''); return; }
    onChangeKg(String(round1(unit === 'lbs' ? lbsToKg(n) : n)));
  };
  return (
    <span className={`weight-input-single${wrapClassName ? ' ' + wrapClassName : ''}`}>
      <input
        className={inputClassName} inputMode="decimal" value={single} id={id} autoFocus={autoFocus}
        aria-label={ariaLabel ?? 'Weight'}
        onChange={e => { const v = clean(e.target.value); setSingle(v); emitSingle(v); }}
        onKeyDown={key} placeholder="0" />
      <span className="weight-input-unit">{unit === 'lbs' ? 'lb' : 'kg'}</span>
    </span>
  );
}
