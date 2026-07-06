// A weight entry field that speaks the user's chosen unit but reports kg.
//
// value/onChange are ALWAYS canonical kg (string, '' = empty). Internally it
// shows a single decimal in kg, lb, or st (stone as a decimal, e.g. 15.8);
// conversion happens only here so callers never touch unit math.
import { useState, useEffect } from 'react';
import { WeightUnit, kgToUnitValue, unitValueToKg, unitLabel } from './weightUnit';

interface Props {
  valueKg: string;                     // canonical kg ('' allowed)
  onChangeKg: (kg: string) => void;
  unit: WeightUnit;
  inputClassName?: string;
  wrapClassName?: string;              // extra class on the wrapper (e.g. block layout)
  hideUnit?: boolean;                  // suppress the trailing unit label (dense grids)
  id?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  ariaLabel?: string;
}

const clean = (s: string) => s.replace(/[^0-9.]/g, '');
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function WeightInput({
  valueKg, onChangeKg, unit, inputClassName, wrapClassName, hideUnit, id, autoFocus, onEnter, ariaLabel,
}: Props) {
  // Local display string so partial typing (e.g. "8.") isn't clobbered by
  // round-tripping through kg on every keystroke.
  const [display, setDisplay] = useState('');

  // Re-hydrate display when the canonical value or unit changes externally
  // (prefill, unit toggle) — our own edits already match, so this is a no-op then.
  useEffect(() => {
    const kg = parseFloat(valueKg);
    setDisplay(!valueKg || isNaN(kg) ? '' : String(round1(kgToUnitValue(kg, unit))));
  }, [valueKg, unit]);

  const onChange = (raw: string) => {
    const v = clean(raw);
    setDisplay(v);
    if (v === '') { onChangeKg(''); return; }
    const n = parseFloat(v);
    onChangeKg(isNaN(n) ? '' : String(round1(unitValueToKg(n, unit))));
  };

  return (
    <span className={`weight-input-single${wrapClassName ? ' ' + wrapClassName : ''}`}>
      <input
        className={inputClassName} inputMode="decimal" value={display} id={id} autoFocus={autoFocus}
        aria-label={ariaLabel ?? 'Weight'}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); onEnter?.(); } }}
        placeholder="0" />
      {!hideUnit && <span className="weight-input-unit">{unitLabel(unit)}</span>}
    </span>
  );
}
