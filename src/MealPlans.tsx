import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipe {
  id: number;
  title: string;
  image: string | null;
  sourceUrl: string | null;
  servings: number;
  diets: string[];
}

interface MealEntry {
  slot: string;
  targetCal: number;
  recipe: Recipe | null;
  scale: number;
  isShake?: boolean;
  macros: { calories: number; protein: number; carbs: number; fat: number };
}

interface PlanTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface GeneratedPlan {
  meals: MealEntry[];
  totals: PlanTotals;
  targets: PlanTotals;
}

interface SavedPlan {
  id: string;
  label: string;
  meals: MealEntry[];
  totals: PlanTotals;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIET_FILTERS = [
  { key: 'vegetarian',  label: 'Vegetarian' },
  { key: 'vegan',       label: 'Vegan' },
  { key: 'gluten free', label: 'Gluten-Free' },
  { key: 'dairy free',  label: 'Dairy-Free' },
  { key: 'ketogenic',   label: 'Keto' },
  { key: 'paleo',       label: 'Paleo' },
];

const SHAKE_MACROS = { calories: 150, protein: 30, carbs: 5, fat: 2 };

const THEME = {
  '--theme': '#00e5ff',
  '--theme-dim': '#00e5ff66',
  '--theme-glow': '#00e5ff33',
} as React.CSSProperties;

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroPill({ label, value, unit = 'g', target, color }: {
  label: string; value: number; unit?: string; target?: number; color: string;
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null;
  return (
    <div className="mp-macro-pill">
      <div className="mp-macro-bar-track">
        <div
          className="mp-macro-bar-fill"
          style={{ width: pct !== null ? `${pct}%` : '0%', background: color }}
        />
      </div>
      <span className="mp-macro-label">{label}</span>
      <span className="mp-macro-val">{value}{unit}</span>
    </div>
  );
}

function MealCard({
  entry,
  onSwap,
  swapping,
}: {
  entry: MealEntry;
  onSwap: (entry: MealEntry) => void;
  swapping: boolean;
}) {
  const { slot, recipe, scale, macros, isShake } = entry;

  if (isShake) {
    return (
      <div className="mp-meal-card mp-meal-card--shake">
        <div className="mp-meal-slot">Protein Shake</div>
        <div className="mp-meal-body">
          <div className="mp-shake-icon">🥛</div>
          <div className="mp-meal-info">
            <div className="mp-meal-title">Whey protein shake</div>
            <div className="mp-meal-serving">1 scoop with water (~240ml)</div>
            <div className="mp-meal-macros">
              <span className="mp-meal-cal">{macros.calories} kcal</span>
              <span className="mp-meal-macro">P {macros.protein}g</span>
              <span className="mp-meal-macro">C {macros.carbs}g</span>
              <span className="mp-meal-macro">F {macros.fat}g</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) return null;

  const servingNote = scale !== 1
    ? `${scale.toFixed(2)}× serving${recipe.servings > 1 ? `s (recipe makes ${recipe.servings})` : ''}`
    : `1 serving`;

  return (
    <div className={`mp-meal-card${swapping ? ' mp-meal-card--swapping' : ''}`}>
      <div className="mp-meal-slot">{slot}</div>
      <div className="mp-meal-body">
        {recipe.image && (
          <img className="mp-meal-img" src={recipe.image} alt={recipe.title} loading="lazy" />
        )}
        <div className="mp-meal-info">
          <div className="mp-meal-title">
            {recipe.sourceUrl ? (
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="mp-meal-link">
                {recipe.title}
              </a>
            ) : recipe.title}
          </div>
          <div className="mp-meal-serving">{servingNote}</div>
          <div className="mp-meal-macros">
            <span className="mp-meal-cal">{macros.calories} kcal</span>
            <span className="mp-meal-macro">P {macros.protein}g</span>
            <span className="mp-meal-macro">C {macros.carbs}g</span>
            <span className="mp-meal-macro">F {macros.fat}g</span>
          </div>
          {recipe.diets.length > 0 && (
            <div className="mp-meal-diets">
              {recipe.diets.slice(0, 3).map(d => (
                <span key={d} className="mp-diet-tag">{d}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button className="mp-swap-btn" onClick={() => onSwap(entry)} disabled={swapping}>
        {swapping ? '…' : '↺ Swap'}
      </button>
    </div>
  );
}

function SavedPlanCard({
  plan,
  onDelete,
}: {
  plan: SavedPlan;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mp-saved-card">
      <div className="mp-saved-header" onClick={() => setOpen(o => !o)}>
        <div className="mp-saved-title">{plan.label}</div>
        <div className="mp-saved-summary">
          {plan.totals.calories} kcal · P {plan.totals.protein}g · C {plan.totals.carbs}g · F {plan.totals.fat}g
        </div>
        <span className="mp-saved-chevron">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="mp-saved-meals">
          {plan.meals.map(m => (
            <div key={m.slot} className="mp-saved-meal-row">
              <span className="mp-saved-meal-slot">{m.slot}</span>
              <span className="mp-saved-meal-name">{m.recipe.title}</span>
              <span className="mp-saved-meal-cal">{m.macros.calories} kcal</span>
            </div>
          ))}
          <button className="mp-delete-btn" onClick={() => onDelete(plan.id)}>
            Delete plan
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MealPlans: React.FC = () => {
  const navigate = useNavigate();

  const [tab, setTab]                 = useState<'generate' | 'saved'>('generate');
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [seeding, setSeeding]         = useState(false);
  const [seedError, setSeedError]     = useState<string | null>(null);

  // Generator form state
  const [mealCount, setMealCount]       = useState(3);
  const [diets, setDiets]               = useState<string[]>([]);
  const [includeShake, setIncludeShake] = useState(false);
  const [halal, setHalal]               = useState(false);

  // Plan state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]     = useState<string | null>(null);
  const [plan, setPlan]             = useState<GeneratedPlan | null>(null);
  const [swappingSlot, setSwappingSlot] = useState<string | null>(null);

  // Save state
  const [saveMode, setSaveMode]     = useState(false);
  const [planName, setPlanName]     = useState('');
  const [saving, setSaving]         = useState(false);

  // Saved plans
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // ── Load recipe count on mount
  useEffect(() => {
    api.getMealPlanRecipeCount()
      .then((r: any) => setRecipeCount(r.count))
      .catch(() => setRecipeCount(0));
  }, []);

  // ── Load saved plans when tab switches
  useEffect(() => {
    if (tab !== 'saved') return;
    setLoadingSaved(true);
    api.getDietPlans()
      .then((rows: any[]) => setSavedPlans(rows as SavedPlan[]))
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, [tab]);

  // ── Seed recipes
  const handleSeed = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      const r: any = await api.seedMealPlanRecipes();
      setRecipeCount(prev => (prev ?? 0) + r.seeded);
    } catch (err: any) {
      setSeedError(err.message ?? 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  // ── Generate plan
  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    setPlan(null);
    setSaveMode(false);
    try {
      const result: any = await api.generateMealPlan({
        mealCount,
        diets,
        excludeIds: [],
        includeShake,
        halal,
      });
      setPlan(result as GeneratedPlan);
    } catch (err: any) {
      setGenError(err.message ?? 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Swap a single meal
  const handleSwap = useCallback(async (entry: MealEntry) => {
    if (!plan) return;
    setSwappingSlot(entry.slot);
    try {
      const excludeIds = plan.meals
        .filter(m => m.slot !== entry.slot)
        .map(m => m.recipe.id);

      const swapped: any = await api.swapMeal({
        slotName:   entry.slot,
        targetCal:  entry.targetCal,
        diets,
        excludeIds,
        halal,
      });

      setPlan(prev => {
        if (!prev) return prev;
        const meals = prev.meals.map(m => m.slot === entry.slot ? swapped : m);
        const totals = meals.reduce(
          (acc, m) => ({
            calories: acc.calories + m.macros.calories,
            protein:  acc.protein  + m.macros.protein,
            carbs:    acc.carbs    + m.macros.carbs,
            fat:      acc.fat      + m.macros.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        return {
          ...prev,
          meals,
          totals: {
            calories: Math.round(totals.calories),
            protein:  Math.round(totals.protein  * 10) / 10,
            carbs:    Math.round(totals.carbs    * 10) / 10,
            fat:      Math.round(totals.fat      * 10) / 10,
          },
        };
      });
    } catch {
      // silent — old meal stays
    } finally {
      setSwappingSlot(null);
    }
  }, [plan, diets]);

  // ── Save plan
  const handleSave = async () => {
    if (!plan || !planName.trim()) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      await api.createDietPlan({
        id,
        label: planName.trim(),
        meals: plan.meals,
        totals: plan.totals,
      });
      setSaveMode(false);
      setPlanName('');
      setTab('saved');
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // ── Delete saved plan
  const handleDelete = async (id: string) => {
    await api.deleteDietPlan(id).catch(() => {});
    setSavedPlans(prev => prev.filter(p => p.id !== id));
  };

  // ── Toggle diet filter
  const toggleDiet = (key: string) => {
    setDiets(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const dbReady = recipeCount !== null && recipeCount > 0;

  return (
    <div className="app" style={THEME}>
      <header className="header">
        <div className="header-left">
          <Link to="/diet" className="back-link">← Back</Link>
        </div>
        <h1 className="title">Meal Plans</h1>
      </header>

      {/* Tab bar */}
      <div className="mp-tab-bar">
        <button
          className={`mp-tab${tab === 'generate' ? ' mp-tab--active' : ''}`}
          onClick={() => setTab('generate')}
        >Generate</button>
        <button
          className={`mp-tab${tab === 'saved' ? ' mp-tab--active' : ''}`}
          onClick={() => setTab('saved')}
        >Saved Plans</button>
      </div>

      <div className="page-content" style={{ padding: '16px 16px 100px' }}>

        {/* ── Setup banner ─────────────────────────────────────────────── */}
        {tab === 'generate' && (
          <div className="mp-setup-banner">
            {recipeCount === null ? (
              <span className="mp-setup-loading">Checking recipe database…</span>
            ) : recipeCount === 0 ? (
              <>
                <span className="mp-setup-label">Recipe database is empty.</span>
                <button className="mp-setup-btn" onClick={handleSeed} disabled={seeding}>
                  {seeding ? 'Fetching recipes…' : 'Load recipes'}
                </button>
                {seedError && <span className="mp-setup-error">{seedError}</span>}
              </>
            ) : (
              <span className="mp-setup-count">
                {recipeCount} recipes loaded
                <button className="mp-setup-refresh" onClick={handleSeed} disabled={seeding}>
                  {seeding ? '…' : '+ More'}
                </button>
              </span>
            )}
          </div>
        )}

        {/* ── Generate tab ─────────────────────────────────────────────── */}
        {tab === 'generate' && (
          <>
            {/* Form */}
            <div className="mp-form-card">
              {/* Meal count */}
              <div className="mp-form-row">
                <span className="mp-form-label">Meals per day</span>
                <div className="mp-count-btns">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className={`mp-count-btn${mealCount === n ? ' mp-count-btn--active' : ''}`}
                      onClick={() => setMealCount(n)}
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Diet filters */}
              <div className="mp-form-row mp-form-row--wrap">
                <span className="mp-form-label">Dietary filters</span>
                <div className="mp-diet-pills">
                  {DIET_FILTERS.map(f => (
                    <button
                      key={f.key}
                      className={`mp-diet-pill${diets.includes(f.key) ? ' mp-diet-pill--active' : ''}`}
                      onClick={() => toggleDiet(f.key)}
                    >{f.label}</button>
                  ))}
                </div>
              </div>

              {/* Toggles row */}
              <div className="mp-toggles-row">
                <button
                  className={`mp-toggle-btn${includeShake ? ' mp-toggle-btn--active' : ''}`}
                  onClick={() => setIncludeShake(v => !v)}
                >
                  🥛 Protein Shake
                </button>
                <button
                  className={`mp-toggle-btn${halal ? ' mp-toggle-btn--active' : ''}`}
                  onClick={() => setHalal(v => !v)}
                >
                  ☪️ Halal
                </button>
              </div>

              <button
                className="mp-generate-btn"
                onClick={handleGenerate}
                disabled={generating || !dbReady}
              >
                {generating ? 'Generating…' : !dbReady ? 'Load recipes first' : 'Generate Plan'}
              </button>

              {genError && <p className="mp-gen-error">{genError}</p>}
            </div>

            {/* Generated plan */}
            {plan && (
              <>
                {/* Totals vs targets */}
                <div className="mp-totals-card">
                  <div className="mp-totals-title">Today's plan</div>
                  <MacroPill
                    label="Calories"
                    value={plan.totals.calories}
                    unit=" kcal"
                    target={plan.targets.calories}
                    color="#00e5ff"
                  />
                  <MacroPill
                    label="Protein"
                    value={plan.totals.protein}
                    target={plan.targets.protein}
                    color="#a78bfa"
                  />
                  <MacroPill
                    label="Carbs"
                    value={plan.totals.carbs}
                    target={plan.targets.carbs}
                    color="#34d399"
                  />
                  <MacroPill
                    label="Fat"
                    value={plan.totals.fat}
                    target={plan.targets.fat}
                    color="#fb923c"
                  />
                </div>

                {/* Meal cards */}
                <div className="mp-meals-list">
                  {plan.meals.map(entry => (
                    <MealCard
                      key={entry.slot}
                      entry={entry}
                      onSwap={handleSwap}
                      swapping={swappingSlot === entry.slot}
                    />
                  ))}
                </div>

                {/* Save controls */}
                {!saveMode ? (
                  <button className="mp-save-plan-btn" onClick={() => setSaveMode(true)}>
                    Save this plan
                  </button>
                ) : (
                  <div className="mp-save-row">
                    <input
                      className="mp-save-input"
                      placeholder="Plan name…"
                      value={planName}
                      onChange={e => setPlanName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      autoFocus
                    />
                    <button
                      className="mp-save-confirm"
                      onClick={handleSave}
                      disabled={saving || !planName.trim()}
                    >
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className="mp-save-cancel" onClick={() => setSaveMode(false)}>
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Saved tab ────────────────────────────────────────────────── */}
        {tab === 'saved' && (
          <>
            {loadingSaved ? (
              <div className="mp-loading">Loading saved plans…</div>
            ) : savedPlans.length === 0 ? (
              <div className="mp-empty">
                <div className="mp-empty-icon">📋</div>
                <div className="mp-empty-title">No saved plans yet</div>
                <div className="mp-empty-sub">Generate a plan and tap "Save this plan" to keep it here.</div>
                <button className="mp-empty-btn" onClick={() => setTab('generate')}>
                  Generate a plan →
                </button>
              </div>
            ) : (
              <div className="mp-saved-list">
                {savedPlans.map(p => (
                  <SavedPlanCard key={p.id} plan={p} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MealPlans;
