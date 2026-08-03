import React from 'react';

export interface CadencePanel {
  key: string;
  label: string;
  color: string;
  /** How many habits sit under this cadence, shown on the tab. */
  count?: number;
  content: React.ReactNode;
}

// Cadence switcher: a visible segmented control, one tab per cadence.
//
// This replaced a swipe carousel with a dot row. The gesture worked, but the
// cadence you were on — and the fact that there were four others — was only
// discoverable by trying it. A tab you can see is a tab you can reach, and the
// per-tab count means the shape of your habits reads without switching at all.
//
// Tabs are mutually exclusive by design: a daily habit lives only under Daily.
// Choosing Weekly is choosing to look at the weekly ones.
const CadenceTabs: React.FC<{
  panels: CadencePanel[];
  active: string;
  onSelect: (key: string) => void;
  /** The cadence section is pinned to the top — pull the XP bar up beside the tabs. */
  compact?: boolean;
  header?: React.ReactNode;
}> = ({ panels, active, onSelect, compact = false, header }) => {
  const current = panels.find(p => p.key === active) ?? panels[0];
  return (
    <div className={`cadt${compact ? ' cadt--compact' : ''}`}>
      <div className="cadt-bar">
        <div className="cadt-tabs" role="tablist" aria-label="Habit cadence">
          {panels.map(p => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={p.key === active}
              className={`cadt-tab${p.key === active ? ' active' : ''}`}
              style={{ ['--chip' as any]: p.color }}
              onClick={() => onSelect(p.key)}
            >
              <span className="cadt-tab-lbl">{p.label}</span>
              {p.count != null && p.count > 0 && <span className="cadt-n">{p.count}</span>}
            </button>
          ))}
        </div>
        {compact && header && <div className="cadt-xp">{header}</div>}
      </div>
      {/* Keyed on the cadence so switching replays the cards' entrance animation,
          which is what the swipe used to give you for free. */}
      <div key={current.key} className="cadt-panel" role="tabpanel">
        {current.content}
      </div>
    </div>
  );
};

export default CadenceTabs;
