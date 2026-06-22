import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
  id: number;
  name: string;
  original: string;
  amount: number;
  unit: string;
}

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

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DayPlan {
  day: string;
  meals: MealEntry[];
  totals: MacroTotals;
}

interface WeekPlan {
  days: DayPlan[];
  targets: MacroTotals;
}

interface SavedPlan {
  id: string;
  label: string;
  days: DayPlan[];
  totals: MacroTotals;
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

const THEME = {
  '--theme': '#2E8BFF',
  '--theme-dim': '#2E8BFF66',
  '--theme-glow': '#2E8BFF33',
} as React.CSSProperties;

// ─── IngredientPanel ──────────────────────────────────────────────────────────

function IngredientPanel({ recipeId, scale }: { recipeId: number; scale: number }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loaded, setLoaded]           = useState(false);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [added, setAdded]             = useState(false);
  const [fetchError, setFetchError]   = useState<string | null>(null);

  useEffect(() => {
    setIngredients([]);
    setLoaded(false);
    setFetchError(null);
    setSelected(new Set());
  }, [recipeId]);

  const fetchIngredients = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const r: any = await api.getRecipeIngredients(recipeId);
      setIngredients(r.ingredients ?? []);
      setSelected(new Set((r.ingredients ?? []).map((i: Ingredient) => i.id)));
    } catch (err: any) {
      setFetchError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const toggle = (id: number) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const addToList = async () => {
    const toAdd = ingredients.filter(i => selected.has(i.id));
    for (const ing of toAdd) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const scaled = scale !== 1
        ? `${(ing.amount * scale).toFixed(1).replace(/\.0$/, '')} ${ing.unit} ${ing.name}`
        : ing.original;
      await api.createShoppingItem(id, scaled).catch(() => {});
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  if (!loaded && !loading) {
    return (
      <button className="mp-ing-load-btn" onClick={fetchIngredients}>
        Show ingredients
      </button>
    );
  }
  if (loading) return <button className="mp-ing-load-btn" disabled>Loading...</button>;
  if (fetchError) return (
    <div>
      <p className="mp-ing-empty" style={{ color: '#FF5470' }}>Error: {fetchError}</p>
      <button className="mp-ing-load-btn" onClick={() => { setLoaded(false); fetchIngredients(); }}>Retry</button>
    </div>
  );
  if (ingredients.length === 0) return (
    <div>
      <p className="mp-ing-empty">No ingredients found.</p>
      <button className="mp-ing-load-btn" onClick={() => { setLoaded(false); fetchIngredients(); }}>Retry</button>
    </div>
  );

  return (
    <div className="mp-ing-panel">
      <div className="mp-ing-list">
        {ingredients.map(ing => (
          <label key={ing.id} className="mp-ing-row">
            <input
              type="checkbox"
              className="mp-ing-check"
              checked={selected.has(ing.id)}
              onChange={() => toggle(ing.id)}
            />
            <span className="mp-ing-text">
              {scale !== 1
                ? `${(ing.amount * scale).toFixed(1).replace(/\.0$/, '')} ${ing.unit} ${ing.name}`
                : ing.original}
            </span>
          </label>
        ))}
      </div>
      <button
        className="mp-ing-add-btn"
        onClick={addToList}
        disabled={selected.size === 0 || added}
      >
        {added ? 'Added to shopping list' : `Add ${selected.size} item${selected.size !== 1 ? 's' : ''} to list`}
      </button>
    </div>
  );
}

// ─── Detail Sheet (bottom-sheet modal) ───────────────────────────────────────

function DetailSheet({
  entry, dayName, onClose, onSwap, swapping,
}: {
  entry: MealEntry; dayName: string; onClose: () => void; onSwap: () => void; swapping: boolean;
}) {
  const { slot, recipe, scale, macros, isShake } = entry;
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div className="mp-detail-overlay" ref={backdropRef} onClick={handleBackdrop}>
      <div className="mp-detail-sheet">
        <button className="mp-detail-close" onClick={onClose}>x</button>
        <div className="mp-detail-day">{dayName} &middot; {slot}</div>

        {isShake ? (
          <>
            <div className="mp-detail-shake-icon">&#x1F95B;</div>
            <div className="mp-detail-title">Whey protein shake</div>
            <div className="mp-detail-serving">1 scoop with water (~240ml)</div>
          </>
        ) : recipe ? (
          <>
            {recipe.image && <img className="mp-detail-img" src={recipe.image} alt={recipe.title} />}
            <div className="mp-detail-title">
              {recipe.sourceUrl
                ? <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="mp-meal-link">{recipe.title}</a>
                : recipe.title}
            </div>
            <div className="mp-detail-serving">
              {scale !== 1
                ? `${scale.toFixed(2)}x serving${recipe.servings > 1 ? ` (recipe makes ${recipe.servings})` : ''}`
                : '1 serving'}
            </div>
          </>
        ) : null}

        <div className="mp-detail-macros">
          <div className="mp-detail-macro mp-detail-macro--cal">
            <span className="mp-detail-macro-val">{macros.calories}</span>
            <span className="mp-detail-macro-label">kcal</span>
          </div>
          <div className="mp-detail-macro">
            <span className="mp-detail-macro-val">{macros.protein}g</span>
            <span className="mp-detail-macro-label">protein</span>
          </div>
          <div className="mp-detail-macro">
            <span className="mp-detail-macro-val">{macros.carbs}g</span>
            <span className="mp-detail-macro-label">carbs</span>
          </div>
          <div className="mp-detail-macro">
            <span className="mp-detail-macro-val">{macros.fat}g</span>
            <span className="mp-detail-macro-label">fat</span>
          </div>
        </div>

        {recipe && !isShake && (
          <>
            {recipe.diets.length > 0 && (
              <div className="mp-meal-diets" style={{ marginBottom: 16 }}>
                {recipe.diets.slice(0, 4).map(d => <span key={d} className="mp-diet-tag">{d}</span>)}
              </div>
            )}
            <IngredientPanel recipeId={recipe.id} scale={scale} />
            <button className="mp-swap-btn" style={{ marginTop: 16, width: '100%' }} onClick={onSwap} disabled={swapping}>
              {swapping ? '...' : 'Swap meal'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Grid Cell ────────────────────────────────────────────────────────────────

function GridCell({ entry, onClick }: { entry: MealEntry; onClick: () => void }) {
  const { recipe, macros, isShake } = entry;
  if (isShake) {
    return (
      <div className="mp-grid-cell mp-grid-cell--shake" onClick={onClick}>
        <div className="mp-grid-cell-icon">&#x1F95B;</div>
        <div className="mp-grid-cell-name">Shake</div>
        <div className="mp-grid-cell-cal">{macros.calories} kcal</div>
      </div>
    );
  }
  if (!recipe) return <div className="mp-grid-cell mp-grid-cell--empty">-</div>;
  return (
    <div className="mp-grid-cell" onClick={onClick}>
      {recipe.image && <img className="mp-grid-cell-img" src={recipe.image} alt={recipe.title} loading="lazy" />}
      <div className="mp-grid-cell-name">{recipe.title}</div>
      <div className="mp-grid-cell-cal">{macros.calories} kcal</div>
    </div>
  );
}

// ─── MacroPill ───────────────────────────────────────────────────────────────

function MacroPill({ label, value, unit = 'g', target, color }: {
  label: string; value: number; unit?: string; target?: number; color: string;
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null;
  const ok  = pct !== null ? pct >= 80 && pct <= 120 : null;
  return (
    <div className="mp-macro-pill">
      <div className="mp-macro-bar-track">
        <div className="mp-macro-bar-fill" style={{ width: pct !== null ? `${pct}%` : '0%', background: color }} />
      </div>
      <span className="mp-macro-label">{label}</span>
      <span className="mp-macro-val">
        {value}{unit}
        {target != null && <span className="mp-macro-target"> / {target}{unit}</span>}
      </span>
      {ok !== null && <span className={ok ? 'mp-macro-ok' : 'mp-macro-warn'}>{ok ? '✓' : '⚠'}</span>}
    </div>
  );
}

// ─── SavedPlanCard ────────────────────────────────────────────────────────────

function SavedPlanCard({ plan, onDelete }: { plan: SavedPlan; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const totals = plan.totals ?? plan.days?.[0]?.totals;
  return (
    <div className="mp-saved-card">
      <div className="mp-saved-header" onClick={() => setOpen(o => !o)}>
        <div className="mp-saved-title">{plan.label}</div>
        <div className="mp-saved-summary">{plan.days?.length ?? 1}d &middot; {totals?.calories ?? '?'} kcal/day</div>
        <span className="mp-saved-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="mp-saved-meals">
          {(plan.days ?? []).map(d => (
            <div key={d.day} className="mp-saved-day-section">
              <div className="mp-saved-day-label">{d.day}</div>
              {d.meals.map(m => (
                <div key={m.slot} className="mp-saved-meal-row">
                  <span className="mp-saved-meal-slot">{m.slot}</span>
                  <span className="mp-saved-meal-name">{m.recipe?.title ?? 'Protein Shake'}</span>
                  <span className="mp-saved-meal-cal">{m.macros.calories} kcal</span>
                </div>
              ))}
            </div>
          ))}
          <div className="mp-saved-actions">
            <button className="mp-delete-btn" onClick={() => onDelete(plan.id)}>Delete plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MealPlans: React.FC = () => {
  const [tab, setTab]                 = useState<'generate' | 'saved'>('generate');
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [seeding, setSeeding]         = useState(false);
  const [seedError, setSeedError]     = useState<string | null>(null);
  const [dietTarget, setDietTarget]   = useState<{ calories: number; protein: number; carbs: number; fats: number } | null>(null);

  const [dayCount, setDayCount]         = useState(7);
  const [mealCount, setMealCount]       = useState(3);
  const [diets, setDiets]               = useState<string[]>([]);
  const [includeShake, setIncludeShake] = useState(false);
  const [halal, setHalal]               = useState(false);

  const [generating, setGenerating]     = useState(false);
  const [genError, setGenError]         = useState<string | null>(null);
  const [plan, setPlan]                 = useState<WeekPlan | null>(null);
  const [swappingCell, setSwappingCell] = useState<{ dayIdx: number; slot: string } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ dayIdx: number; entry: MealEntry } | null>(null);

  const [saveMode, setSaveMode]         = useState(false);
  const [planName, setPlanName]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [addedToList, setAddedToList]   = useState(false);

  const [savedPlans, setSavedPlans]     = useState<SavedPlan[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    api.getMealPlanRecipeCount().then((r: any) => setRecipeCount(r.count)).catch(() => setRecipeCount(0));
    api.getDietTarget().then((t: any) => setDietTarget(t)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'saved') return;
    setLoadingSaved(true);
    api.getDietPlans().then((rows: any[]) => setSavedPlans(rows as SavedPlan[])).catch(() => {}).finally(() => setLoadingSaved(false));
  }, [tab]);

  const handleSeed = async () => {
    setSeeding(true); setSeedError(null);
    try {
      const r: any = await api.seedMealPlanRecipes();
      setRecipeCount(prev => (prev ?? 0) + r.seeded);
    } catch (err: any) {
      setSeedError(err.message ?? 'Seed failed');
    } finally { setSeeding(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true); setGenError(null); setPlan(null); setSaveMode(false);
    try {
      const result: any = await api.generateMealPlan({ mealCount, days: dayCount, diets, excludeIds: [], includeShake, halal });
      setPlan(result as WeekPlan);
    } catch (err: any) {
      setGenError(err.message ?? 'Generation failed');
    } finally { setGenerating(false); }
  };

  const handleSwap = useCallback(async (dayIdx: number, entry: MealEntry) => {
    if (!plan) return;
    setSwappingCell({ dayIdx, slot: entry.slot });
    try {
      const excludeIds = plan.days[dayIdx].meals
        .filter(m => m.slot !== entry.slot && m.recipe !== null)
        .map(m => m.recipe!.id);
      const swapped: any = await api.swapMeal({ slotName: entry.slot, targetCal: entry.targetCal, diets, excludeIds, halal });
      setPlan(prev => {
        if (!prev) return prev;
        const days = prev.days.map((d, i) => {
          if (i !== dayIdx) return d;
          const meals = d.meals.map(m => m.slot === entry.slot ? swapped : m);
          const t = meals.reduce((acc, m) => ({
            calories: acc.calories + m.macros.calories, protein: acc.protein + m.macros.protein,
            carbs: acc.carbs + m.macros.carbs, fat: acc.fat + m.macros.fat,
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
          return { ...d, meals, totals: {
            calories: Math.round(t.calories), protein: Math.round(t.protein * 10) / 10,
            carbs: Math.round(t.carbs * 10) / 10, fat: Math.round(t.fat * 10) / 10,
          }};
        });
        return { ...prev, days };
      });
      setSelectedCell(prev => prev && prev.dayIdx === dayIdx && prev.entry.slot === entry.slot
        ? { dayIdx, entry: swapped } : prev);
    } catch { /* old meal stays */ } finally { setSwappingCell(null); }
  }, [plan, diets, halal]);

  const handleAddPlanToList = async () => {
    if (!plan) return;
    setAddingToList(true);
    try {
      for (const day of plan.days) {
        for (const meal of day.meals) {
          if (!meal.recipe || meal.isShake) continue;
          const r: any = await api.getRecipeIngredients(meal.recipe.id).catch(() => ({ ingredients: [] }));
          for (const ing of (r.ingredients ?? [])) {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const text = meal.scale !== 1
              ? `${(ing.amount * meal.scale).toFixed(1).replace(/\.0$/, '')} ${ing.unit} ${ing.name} (${day.day})`
              : `${ing.original} (${day.day})`;
            await api.createShoppingItem(id, text).catch(() => {});
          }
        }
      }
      setAddedToList(true);
      setTimeout(() => setAddedToList(false), 3000);
    } finally { setAddingToList(false); }
  };

  const handleSave = async () => {
    if (!plan || !planName.trim()) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const n = plan.days.length;
      const avgTotals = {
        calories: Math.round(plan.days.reduce((s, d) => s + d.totals.calories, 0) / n),
        protein:  Math.round(plan.days.reduce((s, d) => s + d.totals.protein,  0) / n * 10) / 10,
        carbs:    Math.round(plan.days.reduce((s, d) => s + d.totals.carbs,    0) / n * 10) / 10,
        fat:      Math.round(plan.days.reduce((s, d) => s + d.totals.fat,      0) / n * 10) / 10,
      };
      await api.createDietPlan({ id, label: planName.trim(), days: plan.days, totals: avgTotals });
      setSaveMode(false); setPlanName(''); setTab('saved');
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await api.deleteDietPlan(id).catch(() => {});
    setSavedPlans(prev => prev.filter(p => p.id !== id));
  };

  const toggleDiet = (key: string) =>
    setDiets(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);

  const dbReady = recipeCount !== null && recipeCount > 0;
  const slotNames = plan?.days[0]?.meals.map(m => m.slot) ?? [];
  const n = plan?.days.length ?? 1;
  const avgTotals = plan ? {
    calories: Math.round(plan.days.reduce((s, d) => s + d.totals.calories, 0) / n),
    protein:  Math.round(plan.days.reduce((s, d) => s + d.totals.protein,  0) / n * 10) / 10,
    carbs:    Math.round(plan.days.reduce((s, d) => s + d.totals.carbs,    0) / n * 10) / 10,
    fat:      Math.round(plan.days.reduce((s, d) => s + d.totals.fat,      0) / n * 10) / 10,
  } : null;

  return (
    <div className="app flush" style={THEME}>
      <div className="mp-intro">
        <Link to="/diet" className="page-back"><span className="page-back-arrow">‹</span> Diet</Link>
        <h1 className="page-intro-title">Meal Plans</h1>
      </div>

      <div className="mp-tab-bar">
        <button className={`mp-tab${tab === 'generate' ? ' mp-tab--active' : ''}`} onClick={() => setTab('generate')}>Generate</button>
        <button className={`mp-tab${tab === 'saved' ? ' mp-tab--active' : ''}`} onClick={() => setTab('saved')}>Saved Plans</button>
      </div>

      <div className="page-content" style={{ padding: '16px 16px 100px', flex: 1, overflowY: 'auto' }}>

        {tab === 'generate' && (
          <div className="mp-setup-banner">
            {recipeCount === null ? (
              <span className="mp-setup-loading">Checking recipe database...</span>
            ) : recipeCount === 0 ? (
              <>
                <span className="mp-setup-label">Recipe database is empty.</span>
                <button className="mp-setup-btn" onClick={handleSeed} disabled={seeding}>{seeding ? 'Fetching recipes...' : 'Load recipes'}</button>
                {seedError && <span className="mp-setup-error">{seedError}</span>}
              </>
            ) : (
              <span className="mp-setup-count">
                {recipeCount} recipes loaded
                <button className="mp-setup-refresh" onClick={handleSeed} disabled={seeding}>{seeding ? '...' : '+ More'}</button>
              </span>
            )}
          </div>
        )}

        {tab === 'generate' && (
          <>
            <div className="mp-form-card">
              <div className="mp-form-row">
                <span className="mp-form-label">Days</span>
                <div className="mp-count-btns">
                  {[1,2,3,4,5,6,7].map(n => (
                    <button key={n} className={`mp-count-btn${dayCount === n ? ' mp-count-btn--active' : ''}`} onClick={() => setDayCount(n)}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="mp-form-row">
                <span className="mp-form-label">Meals / day</span>
                <div className="mp-count-btns">
                  {[2,3,4,5].map(n => (
                    <button key={n} className={`mp-count-btn${mealCount === n ? ' mp-count-btn--active' : ''}`} onClick={() => setMealCount(n)}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="mp-form-row mp-form-row--wrap">
                <span className="mp-form-label">Filters</span>
                <div className="mp-diet-pills">
                  {DIET_FILTERS.map(f => (
                    <button key={f.key} className={`mp-diet-pill${diets.includes(f.key) ? ' mp-diet-pill--active' : ''}`} onClick={() => toggleDiet(f.key)}>{f.label}</button>
                  ))}
                  <button className={`mp-diet-pill${halal ? ' mp-diet-pill--active' : ''}`} onClick={() => setHalal(v => !v)}>Halal</button>
                  <button className={`mp-diet-pill${includeShake ? ' mp-diet-pill--active' : ''}`} onClick={() => setIncludeShake(v => !v)}>+ Shake</button>
                </div>
              </div>

              {dietTarget && (
                <div className="mp-target-summary">
                  Targeting {dietTarget.calories} kcal &middot; P {dietTarget.protein}g &middot; C {dietTarget.carbs}g &middot; F {dietTarget.fats}g
                </div>
              )}

              <button className="mp-generate-btn" onClick={handleGenerate} disabled={generating || !dbReady}>
                {generating ? 'Generating...' : !dbReady ? 'Load recipes first' : `Generate ${dayCount}-day Plan`}
              </button>
              {genError && <p className="mp-gen-error">{genError}</p>}
            </div>

            {plan && (
              <>
                {avgTotals && (
                  <div className="mp-totals-card">
                    <div className="mp-totals-title">Avg daily totals vs targets</div>
                    <MacroPill label="Calories" value={avgTotals.calories} unit=" kcal" target={plan.targets.calories} color="#2E8BFF" />
                    <MacroPill label="Protein"  value={avgTotals.protein}               target={plan.targets.protein}  color="#FFB928" />
                    <MacroPill label="Carbs"    value={avgTotals.carbs}                 target={plan.targets.carbs}    color="#FF4D8D" />
                    <MacroPill label="Fat"      value={avgTotals.fat}                   target={plan.targets.fat}      color="#FFD233" />
                  </div>
                )}

                <div className="mp-grid-wrapper">
                  <div className="mp-grid" style={{ gridTemplateColumns: `56px repeat(${slotNames.length}, minmax(100px, 1fr))` }}>
                    <div className="mp-grid-corner" />
                    {slotNames.map(s => <div key={s} className="mp-grid-col-header">{s}</div>)}
                    {plan.days.map((day, dayIdx) => (
                      <React.Fragment key={day.day}>
                        <div className="mp-grid-day-label">
                          <span className="mp-grid-day-name">{day.day.slice(0, 3)}</span>
                          <span className="mp-grid-day-cal">{day.totals.calories}</span>
                        </div>
                        {day.meals.map(entry => (
                          <GridCell key={entry.slot} entry={entry} onClick={() => setSelectedCell({ dayIdx, entry })} />
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="mp-plan-actions">
                  <button className="mp-add-list-btn" onClick={handleAddPlanToList} disabled={addingToList || addedToList}>
                    {addedToList ? 'Added to shopping list' : addingToList ? 'Adding...' : 'Add plan to shopping list'}
                  </button>
                  {!saveMode ? (
                    <button className="mp-save-plan-btn" onClick={() => setSaveMode(true)}>Save plan</button>
                  ) : (
                    <div className="mp-save-row">
                      <input className="mp-save-input" placeholder="Plan name..." value={planName} onChange={e => setPlanName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
                      <button className="mp-save-confirm" onClick={handleSave} disabled={saving || !planName.trim()}>{saving ? '...' : 'Save'}</button>
                      <button className="mp-save-cancel" onClick={() => setSaveMode(false)}>x</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'saved' && (
          <>
            {loadingSaved ? (
              <div className="sd-loader-wrap" style={{ minHeight: '40vh' }}><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
            ) : savedPlans.length === 0 ? (
              <div className="mp-empty">
                <div className="mp-empty-icon">&#x1F4CB;</div>
                <div className="mp-empty-title">No saved plans yet</div>
                <div className="mp-empty-sub">Generate a plan and tap "Save plan" to keep it here.</div>
                <button className="mp-empty-btn" onClick={() => setTab('generate')}>Generate a plan &rarr;</button>
              </div>
            ) : (
              <div className="mp-saved-list">
                {savedPlans.map(p => <SavedPlanCard key={p.id} plan={p} onDelete={handleDelete} />)}
              </div>
            )}
          </>
        )}
      </div>

      {selectedCell && (
        <DetailSheet
          entry={selectedCell.entry}
          dayName={plan?.days[selectedCell.dayIdx]?.day ?? ''}
          onClose={() => setSelectedCell(null)}
          onSwap={() => handleSwap(selectedCell.dayIdx, selectedCell.entry)}
          swapping={swappingCell?.dayIdx === selectedCell.dayIdx && swappingCell?.slot === selectedCell.entry.slot}
        />
      )}
    </div>
  );
};

export default MealPlans;
