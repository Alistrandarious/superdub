import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import { api } from './api';

interface ProfileData {
  dob: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female';
  activity: string;
  steps: string;
  vestKg: string;
}

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return Math.max(0, age);
}

interface MacroSet {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

type MacroKey = 'protein' | 'carbs' | 'fats';
type Locks = Record<MacroKey, boolean>;

interface SavedPlan {
  id: string;
  label: string;
  meals: MealResult[];
  totals: { p: number; c: number; f: number; kcal: number };
}

interface MealItem {
  label: string;
  p: number;
  c: number;
  f: number;
  kcal: number;
}

interface MealResult {
  name: string;
  items: MealItem[];
  totals: { p: number; c: number; f: number; kcal: number };
  flavor?: string;
}

const DEFAULT_PROFILE: ProfileData = {
  dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '', vestKg: '',
};

const DEFAULT_TARGET: MacroSet = { calories: 2003, protein: 150, carbs: 200, fats: 67 };

const STRIDE_M = 0.762;

interface Food {
  name: string;
  display: string;
  measure: 'g' | 'unit';
  base: number;
  p: number;
  c: number;
  f: number;
  gramsPerUnit?: number;
  one?: string;
  many?: string;
  step: number;
  min: number;
  max: number;
}

const FOODS: Food[] = [
  { name: 'chicken', display: 'chicken breast', measure: 'g', base: 100, p: 31, c: 0, f: 3.6, step: 25, min: 50, max: 400 },
  { name: 'turkey', display: 'turkey', measure: 'g', base: 100, p: 21, c: 0, f: 5, step: 25, min: 50, max: 400 },
  { name: 'salmon', display: 'salmon', measure: 'g', base: 100, p: 20, c: 0, f: 13, step: 25, min: 50, max: 300 },
  { name: 'whitefish', display: 'white fish', measure: 'g', base: 100, p: 18, c: 0, f: 1, step: 25, min: 50, max: 300 },
  { name: 'steak', display: 'steak', measure: 'g', base: 100, p: 26, c: 0, f: 8, step: 25, min: 50, max: 300 },
  { name: 'tofu', display: 'tofu', measure: 'g', base: 100, p: 12, c: 2, f: 7, step: 25, min: 50, max: 400 },
  { name: 'yoghurt', display: 'greek yoghurt 0%', measure: 'g', base: 100, p: 10, c: 4, f: 0.4, step: 50, min: 100, max: 400 },
  { name: 'cottage', display: 'cottage cheese', measure: 'g', base: 100, p: 11, c: 3.4, f: 4.3, step: 50, min: 100, max: 400 },
  { name: 'eggs', display: 'eggs', measure: 'unit', base: 1, p: 6, c: 0.5, f: 5, gramsPerUnit: 50, one: 'egg', many: 'eggs', step: 1, min: 1, max: 6 },
  { name: 'whey', display: 'whey protein', measure: 'unit', base: 1, p: 24, c: 2, f: 1.5, gramsPerUnit: 30, one: 'scoop', many: 'scoops', step: 1, min: 1, max: 3 },
  { name: 'oats', display: 'oats', measure: 'g', base: 100, p: 13, c: 66, f: 7, step: 25, min: 30, max: 200 },
  { name: 'rice', display: 'rice', measure: 'g', base: 100, p: 2.7, c: 28, f: 0.3, step: 25, min: 50, max: 400 },
  { name: 'pasta', display: 'pasta', measure: 'g', base: 100, p: 5, c: 30, f: 1.1, step: 25, min: 50, max: 400 },
  { name: 'quinoa', display: 'quinoa', measure: 'g', base: 100, p: 4.4, c: 21, f: 1.9, step: 25, min: 50, max: 300 },
  { name: 'sweetpotato', display: 'sweet potato', measure: 'g', base: 100, p: 1.6, c: 20, f: 0.1, step: 25, min: 50, max: 400 },
  { name: 'potato', display: 'potato', measure: 'g', base: 100, p: 2, c: 17, f: 0.1, step: 25, min: 50, max: 400 },
  { name: 'noodles', display: 'noodles', measure: 'g', base: 100, p: 2, c: 25, f: 0.2, step: 25, min: 50, max: 400 },
  { name: 'banana', display: 'banana', measure: 'unit', base: 1, p: 1.3, c: 27, f: 0.4, gramsPerUnit: 120, one: 'banana', many: 'bananas', step: 1, min: 1, max: 3 },
  { name: 'bread', display: 'bread', measure: 'unit', base: 1, p: 4, c: 18, f: 1.2, gramsPerUnit: 40, one: 'slice', many: 'slices', step: 1, min: 1, max: 4 },
  { name: 'peanutbutter', display: 'peanut butter', measure: 'unit', base: 1, p: 4, c: 3, f: 8, gramsPerUnit: 16, one: 'tbsp', many: 'tbsp', step: 1, min: 1, max: 4 },
  { name: 'almonds', display: 'almonds', measure: 'g', base: 100, p: 21, c: 22, f: 49, step: 10, min: 15, max: 60 },
  { name: 'oliveoil', display: 'olive oil', measure: 'unit', base: 1, p: 0, c: 0, f: 14, gramsPerUnit: 14, one: 'tbsp', many: 'tbsp', step: 1, min: 1, max: 4 },
  { name: 'avocado', display: 'avocado', measure: 'g', base: 100, p: 2, c: 9, f: 15, step: 25, min: 50, max: 200 },
  { name: 'seeds', display: 'seeds', measure: 'unit', base: 1, p: 2, c: 3, f: 5, gramsPerUnit: 12, one: 'tbsp', many: 'tbsp', step: 1, min: 1, max: 4 },
  { name: 'beef', display: 'beef mince', measure: 'g', base: 100, p: 21, c: 0, f: 5, step: 25, min: 50, max: 400 },
  { name: 'tortilla', display: 'tortilla', measure: 'unit', base: 1, p: 8, c: 32, f: 4, gramsPerUnit: 62, one: 'tortilla', many: 'tortillas', step: 1, min: 1, max: 3 },
  { name: 'cheese', display: 'cheese', measure: 'g', base: 100, p: 25, c: 0.1, f: 33, step: 10, min: 20, max: 100 },
];

interface SlotTemplate { protein: string; carb: string; fat: string; extras?: string[]; flavor: string; }

const MEAL_TEMPLATES: Record<string, SlotTemplate[]> = {
  Breakfast: [
    { protein: 'eggs', carb: 'oats', fat: 'almonds',
      flavor: 'Scramble the eggs with smoked paprika and black pepper. Stir the almonds and a pinch of cinnamon into warm oats — add a splash of milk to make it creamy.' },
    { protein: 'eggs', carb: 'bread', fat: 'avocado',
      flavor: 'Poached or fried eggs on toast with smashed avocado. Season the avocado with lemon juice, chilli flakes, and flaky sea salt.' },
    { protein: 'eggs', carb: 'tortilla', fat: 'cheese',
      flavor: 'Breakfast wrap with scrambled eggs and melted cheese. Add a spoonful of salsa, a pinch of cumin, and a dash of hot sauce.' },
    { protein: 'whey', carb: 'oats', fat: 'peanutbutter', extras: ['banana'],
      flavor: 'Mix vanilla protein powder into warm oats, then swirl in peanut butter. Top with a sliced banana and a pinch of sea salt — it brings out the sweetness.' },
    { protein: 'yoghurt', carb: 'oats', fat: 'almonds', extras: ['seeds'],
      flavor: 'Layer Greek yoghurt over oats with crushed almonds. Add a drop of vanilla extract and a generous pinch of cinnamon. Scatter a few mixed seeds on top.' },
    { protein: 'yoghurt', carb: 'banana', fat: 'seeds', extras: ['almonds'],
      flavor: 'Greek yoghurt bowl with sliced banana and mixed seeds. Scatter crushed almonds for crunch and add a pinch of nutmeg or cardamom.' },
    { protein: 'yoghurt', carb: 'bread', fat: 'peanutbutter', extras: ['banana'],
      flavor: 'Peanut butter on toast alongside a bowl of Greek yoghurt. Add banana slices and a sprinkle of cinnamon sugar on the toast.' },
    { protein: 'cottage', carb: 'oats', fat: 'almonds', extras: ['seeds'],
      flavor: 'Stir cottage cheese into warm oats — creamier than you\'d expect. Top with crushed almonds, mixed seeds, and a drizzle of honey.' },
  ],
  Lunch: [
    { protein: 'chicken', carb: 'rice', fat: 'oliveoil',
      flavor: 'Pan-fry chicken in olive oil with garlic, rosemary, and thyme. Rest before slicing and serve over fluffy rice with a squeeze of lemon.' },
    { protein: 'chicken', carb: 'sweetpotato', fat: 'avocado',
      flavor: 'Paprika and garlic-roasted chicken with sweet potato wedges. Smash the avocado with lime juice, coriander, and a pinch of salt.' },
    { protein: 'chicken', carb: 'pasta', fat: 'oliveoil',
      flavor: 'Chicken pasta with olive oil, garlic, and sun-dried tomatoes. Finish with fresh basil, chilli flakes, and a grating of parmesan.' },
    { protein: 'chicken', carb: 'tortilla', fat: 'avocado',
      flavor: 'Grilled chicken wrap with guacamole. Season the chicken with cumin, smoked paprika, lime, and a touch of chilli.' },
    { protein: 'salmon', carb: 'quinoa', fat: 'oliveoil',
      flavor: 'Pan-seared salmon on quinoa. Drizzle with olive oil, season with dill, lemon zest, and cracked black pepper. A caper or two doesn\'t hurt.' },
    { protein: 'turkey', carb: 'rice', fat: 'oliveoil',
      flavor: 'Turkey mince fried rice cooked in a splash of soy sauce with ginger, garlic, and sesame oil. Finish with spring onion and a dash of oyster sauce.' },
    { protein: 'beef', carb: 'pasta', fat: 'oliveoil',
      flavor: 'Lean beef bolognese. Fry with garlic, onion, tomato paste, dried oregano, and basil. A splash of red wine while it simmers makes all the difference.' },
    { protein: 'steak', carb: 'potato', fat: 'oliveoil',
      flavor: 'Pan-sear the steak 2 min per side, then rest it. Crush the potatoes with olive oil, rosemary, and garlic. Finish with flaky salt and cracked pepper.' },
    { protein: 'tofu', carb: 'noodles', fat: 'seeds', extras: ['avocado'],
      flavor: 'Crispy tofu noodle bowl. Press and marinate tofu in soy, ginger, and garlic. Pan-fry until golden. Add sliced avocado and top with sesame seeds and chilli oil.' },
    { protein: 'whitefish', carb: 'rice', fat: 'oliveoil',
      flavor: 'Baked white fish over rice. Season with cumin, coriander, garlic, and lemon. Drizzle olive oil and roast at 200°C for 15 min.' },
  ],
  Snack: [
    { protein: 'yoghurt', carb: 'banana', fat: 'peanutbutter', extras: ['seeds'],
      flavor: 'Slice the banana and dip into peanut butter. Serve with a bowl of Greek yoghurt and a sprinkle of seeds. A pinch of cinnamon and a flake of sea salt makes it feel indulgent.' },
    { protein: 'cottage', carb: 'bread', fat: 'almonds',
      flavor: 'Cottage cheese on wholegrain toast with a handful of almonds. Season with black pepper and a light drizzle of honey.' },
    { protein: 'whey', carb: 'banana', fat: 'peanutbutter', extras: ['oats'],
      flavor: 'Blend protein powder with banana, peanut butter, oats, ice, and a splash of milk. Add a pinch of sea salt — it balances the sweetness perfectly.' },
    { protein: 'eggs', carb: 'bread', fat: 'avocado', extras: ['seeds'],
      flavor: 'Hard-boiled egg on toast with smashed avocado and a scatter of mixed seeds. Keep it simple with sea salt and cracked pepper.' },
    { protein: 'yoghurt', carb: 'oats', fat: 'seeds', extras: ['banana'],
      flavor: 'Bircher-style: mix yoghurt and oats overnight with sliced banana. Top with mixed seeds and a drop of vanilla. Eat cold — it\'s great.' },
    { protein: 'cottage', carb: 'banana', fat: 'almonds',
      flavor: 'Cottage cheese bowl with sliced banana and almonds. Add a drizzle of honey and a pinch of cinnamon. Quick, high-protein, naturally sweet.' },
  ],
  Dinner: [
    { protein: 'salmon', carb: 'sweetpotato', fat: 'oliveoil',
      flavor: 'Oven-baked salmon with roasted sweet potato. Rub with smoked paprika, garlic, olive oil, and lemon zest. Roast at 200°C for 18 min.' },
    { protein: 'chicken', carb: 'rice', fat: 'avocado',
      flavor: 'Teriyaki chicken over jasmine rice with sliced avocado. Glaze the chicken with soy, honey, garlic, and ginger. Broil for the last 2 min to caramelise.' },
    { protein: 'beef', carb: 'rice', fat: 'oliveoil',
      flavor: 'Korean-style beef mince bowl. Fry with soy sauce, sesame oil, garlic, ginger, and a little brown sugar. Top with spring onion and a fried egg if possible.' },
    { protein: 'turkey', carb: 'sweetpotato', fat: 'oliveoil',
      flavor: 'Turkey mince stuffed sweet potato. Roast the potato at 200°C for 45 min. Fill with turkey cooked in cumin, smoked chilli, garlic, and a splash of tomato.' },
    { protein: 'whitefish', carb: 'quinoa', fat: 'oliveoil',
      flavor: 'Lemon and herb white fish on quinoa. Bake at 200°C with olive oil, lemon slices, capers, and fresh parsley. Simple, light, and genuinely delicious.' },
    { protein: 'steak', carb: 'sweetpotato', fat: 'avocado',
      flavor: 'Grilled steak with roasted sweet potato wedges and guacamole. Season the steak with smoked salt, garlic powder, and pepper. Rest before slicing.' },
    { protein: 'tofu', carb: 'rice', fat: 'oliveoil',
      flavor: 'Crispy tofu stir-fry over rice. Fry in sesame oil with garlic, chilli paste, and soy sauce. Add any greens you have — broccoli or spinach work brilliantly.' },
    { protein: 'chicken', carb: 'pasta', fat: 'cheese',
      flavor: 'Chicken pasta bake. Toss pasta with chicken, passata, garlic, dried basil, and chilli. Top with cheese and grill until golden. Comfort food, done well.' },
    { protein: 'salmon', carb: 'noodles', fat: 'seeds', extras: ['avocado'],
      flavor: 'Miso-glazed salmon on soba noodles. Mix miso paste, mirin, soy, and honey for the glaze. Broil the salmon for 8 min. Add sliced avocado and finish with sesame seeds.' },
    { protein: 'turkey', carb: 'pasta', fat: 'oliveoil',
      flavor: 'Turkey and tomato pasta. Brown the turkey with garlic, fennel seeds, and chilli. Add tomatoes and simmer. Finish with olive oil and fresh basil.' },
  ],
};

const MEAL_SLOTS = [
  { name: 'Breakfast', pct: 0.25 },
  { name: 'Lunch', pct: 0.30 },
  { name: 'Snack', pct: 0.15 },
  { name: 'Dinner', pct: 0.30 },
];

const DIET_FILTER_OPTIONS = [
  { id: 'halal', label: 'Halal' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'no_seafood', label: 'No Seafood' },
];

const FILTER_EXCLUDED: Record<string, string[]> = {
  halal: [],
  vegetarian: ['chicken', 'turkey', 'salmon', 'whitefish', 'steak', 'beef'],
  vegan: ['chicken', 'turkey', 'salmon', 'whitefish', 'steak', 'beef', 'eggs', 'whey', 'yoghurt', 'cottage', 'cheese'],
  no_seafood: ['salmon', 'whitefish'],
};

function isoToDDMM(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function linearReg(pts: { x: number; y: number }[]): { slope: number; weeklyRate: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return { slope, weeklyRate: slope * 7 };
}

function getFood(name: string): Food {
  return FOODS.find(f => f.name === name)!;
}

function macrosFor(food: Food, qty: number) {
  const ratio = qty / food.base;
  return { p: food.p * ratio, c: food.c * ratio, f: food.f * ratio };
}

function roundQty(food: Food, raw: number): number {
  const clamped = Math.max(food.min, Math.min(food.max, raw));
  return Math.round(clamped / food.step) * food.step;
}

function portionLabel(food: Food, qty: number): string {
  if (food.measure === 'g') return `${qty}g ${food.display}`;
  const gramsTotal = qty * (food.gramsPerUnit ?? 1);
  const unitLabel = qty === 1 ? (food.one ?? food.display) : (food.many ?? food.display);
  return `${qty} ${unitLabel} (${gramsTotal}g)`;
}

function extraItem(foodName: string): MealItem {
  const food = getFood(foodName);
  const qty = food.min;
  const m = macrosFor(food, qty);
  return { label: portionLabel(food, qty), p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f), kcal: Math.round(m.p * 4 + m.c * 4 + m.f * 9) };
}

function generateSingleMeal(targets: MacroSet, slot: { name: string; pct: number }, tpl: SlotTemplate): MealResult {
  const slotP = targets.protein * slot.pct;
  const slotC = targets.carbs * slot.pct;
  const slotF = targets.fats * slot.pct;

  const pFood = getFood(tpl.protein);
  const cFood = getFood(tpl.carb);
  const fFood = getFood(tpl.fat);

  const cQtyEst = cFood.c > 0 ? roundQty(cFood, (slotC / cFood.c) * cFood.base) : cFood.min;
  const cMEst = macrosFor(cFood, cQtyEst);
  const remFEst = Math.max(0, slotF - cMEst.f);
  const fQtyEst = fFood.f > 0 ? roundQty(fFood, (remFEst / fFood.f) * fFood.base) : fFood.min;
  const fMEst = macrosFor(fFood, fQtyEst);

  const remP = Math.max(0, slotP - cMEst.p - fMEst.p);
  const pQty = pFood.p > 0 ? roundQty(pFood, (remP / pFood.p) * pFood.base) : pFood.min;
  const pM = macrosFor(pFood, pQty);

  const remC = Math.max(0, slotC - pM.c - fMEst.c);
  const cQty = cFood.c > 0 ? roundQty(cFood, (remC / cFood.c) * cFood.base) : cFood.min;
  const cM = macrosFor(cFood, cQty);

  const remF = Math.max(0, slotF - pM.f - cM.f);
  const fQty = fFood.f > 0 ? roundQty(fFood, (remF / fFood.f) * fFood.base) : fFood.min;
  const fM = macrosFor(fFood, fQty);

  const items: MealItem[] = [
    { label: portionLabel(pFood, pQty), p: Math.round(pM.p), c: Math.round(pM.c), f: Math.round(pM.f), kcal: Math.round(pM.p * 4 + pM.c * 4 + pM.f * 9) },
    { label: portionLabel(cFood, cQty), p: Math.round(cM.p), c: Math.round(cM.c), f: Math.round(cM.f), kcal: Math.round(cM.p * 4 + cM.c * 4 + cM.f * 9) },
    { label: portionLabel(fFood, fQty), p: Math.round(fM.p), c: Math.round(fM.c), f: Math.round(fM.f), kcal: Math.round(fM.p * 4 + fM.c * 4 + fM.f * 9) },
    ...(tpl.extras ?? []).map(extraItem),
  ];

  const tp = items.reduce((s, i) => s + i.p, 0);
  const tc = items.reduce((s, i) => s + i.c, 0);
  const tf = items.reduce((s, i) => s + i.f, 0);
  return { name: slot.name, items, totals: { p: tp, c: tc, f: tf, kcal: Math.round(tp * 4 + tc * 4 + tf * 9) }, flavor: tpl.flavor };
}

function pickFilteredTemplate(slotName: string, activeFilters: string[]): SlotTemplate {
  const excluded = new Set(activeFilters.flatMap(f => FILTER_EXCLUDED[f] ?? []));
  const all = MEAL_TEMPLATES[slotName] ?? MEAL_TEMPLATES['Lunch'];
  const filtered = all.filter(t => !excluded.has(t.protein) && !excluded.has(t.fat));
  const pool = filtered.length > 0 ? filtered : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateMealPlan(targets: MacroSet, activeFilters: string[] = []): SavedPlan {
  const meals = MEAL_SLOTS.map(slot =>
    generateSingleMeal(targets, slot, pickFilteredTemplate(slot.name, activeFilters))
  );
  const tp = meals.reduce((s, m) => s + m.totals.p, 0);
  const tc = meals.reduce((s, m) => s + m.totals.c, 0);
  const tf = meals.reduce((s, m) => s + m.totals.f, 0);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: `Plan ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    meals,
    totals: { p: tp, c: tc, f: tf, kcal: Math.round(tp * 4 + tc * 4 + tf * 9) },
  };
}

function yesterdayIso() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}


const StepLogger: React.FC<{ onSaved: (steps: number) => void }> = ({ onSaved }) => {
  const [val, setVal] = useState('');
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    const n = parseInt(val);
    if (isNaN(n) || n < 0) return;
    await api.updateTrackerDay(yesterdayIso(), { steps: n }).catch(() => {});
    onSaved(n);
    setSaved(true);
    setTimeout(() => { setSaved(false); setVal(''); }, 2000);
  };

  return (
    <div className="step-logger-row">
      <input
        className="step-logger-input"
        type="text"
        inputMode="numeric"
        placeholder={saved ? '✓ Saved!' : "Yesterday's steps…"}
        value={saved ? '' : val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={saved}
      />
      {!saved && (
        <button className="step-logger-btn" onClick={submit} disabled={!val}>Save</button>
      )}
    </div>
  );
};

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── WeightGoalCard ────────────────────────────────────────────
const WeightGoalCard: React.FC<{
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
  onSave: (gw: number, lpw: number) => void;
}> = ({ currentWeight, goalWeight, lossPerWeek, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [gw, setGw] = useState(goalWeight);
  const [lpw, setLpw] = useState(lossPerWeek);

  useEffect(() => { setGw(goalWeight); setLpw(lossPerWeek); }, [goalWeight, lossPerWeek]);

  const isBulk = gw > 0 && currentWeight > 0 && gw > currentWeight;
  const diff = currentWeight > 0 && goalWeight > 0 ? Math.abs(currentWeight - goalWeight) : null;
  const weeksToGoal = diff && lossPerWeek > 0 ? Math.ceil(diff / lossPerWeek) : null;

  const save = () => { onSave(gw, lpw); setEditing(false); };

  return (
    <div className="diet-section weight-goal-card">
      <div className="wg-header">
        <h2 className="diet-heading" style={{ marginBottom: 0 }}>Weight Goal</h2>
        <button className="wg-edit-btn" onClick={() => editing ? save() : setEditing(true)}>
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      <div className="wg-weights">
        <div className="wg-weight-item">
          <span className="wg-weight-label">Current</span>
          <span className="wg-weight-value">{currentWeight > 0 ? currentWeight.toFixed(1) : '—'}<span className="wg-weight-unit"> kg</span></span>
        </div>
        <div className="wg-arrow">{isBulk ? '↗' : '→'}</div>
        <div className="wg-weight-item">
          <span className="wg-weight-label">Goal</span>
          {editing ? (
            <input className="wg-input" type="number" step="0.5" value={gw || ''} onChange={e => setGw(parseFloat(e.target.value) || 0)} />
          ) : (
            <span className="wg-weight-value goal">{goalWeight > 0 ? goalWeight.toFixed(1) : '—'}<span className="wg-weight-unit"> kg</span></span>
          )}
        </div>
      </div>

      {diff !== null && (
        <div className="wg-togo">{diff.toFixed(1)} kg to {isBulk ? 'gain' : 'lose'}{weeksToGoal ? ` · ~${weeksToGoal} weeks` : ''}</div>
      )}

      <div className="wg-loss-row">
        <span className="wg-loss-label">Target {isBulk ? 'gain' : 'loss'} / week</span>
        {editing ? (
          <select className="wg-select" value={lpw} onChange={e => setLpw(parseFloat(e.target.value))}>
            {isBulk ? (<>
              <option value={0.1}>0.1 kg/week — lean bulk</option>
              <option value={0.25}>0.25 kg/week — moderate</option>
              <option value={0.5}>0.5 kg/week — fast bulk</option>
            </>) : (<>
              <option value={0.25}>0.25 kg/week — slow</option>
              <option value={0.5}>0.5 kg/week — moderate</option>
              <option value={0.75}>0.75 kg/week — fast</option>
              <option value={1.0}>1.0 kg/week — aggressive</option>
            </>)}
          </select>
        ) : (
          <span className="wg-loss-value">{lossPerWeek > 0 ? `${lossPerWeek} kg / week` : '—'}</span>
        )}
      </div>
    </div>
  );
};

// ── WeightSparkline ───────────────────────────────────────────
const WeightSparkline: React.FC<{
  allTrackerDays: any[];
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
}> = ({ allTrackerDays, currentWeight, goalWeight, lossPerWeek }) => {
  const isBulk = goalWeight > currentWeight && currentWeight > 0;
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return localYMD(d);
  });

  const weekData = weekDays.map((iso, i) => {
    const ddmm = isoToDDMM(iso);
    const found = allTrackerDays.find((d: any) => d.day === ddmm);
    const actual = found && parseFloat(found.weight) > 0 ? parseFloat(found.weight) : undefined;
    const direction = isBulk ? 1 : -1;
    const expected = currentWeight > 0 && lossPerWeek > 0
      ? parseFloat((currentWeight + direction * (lossPerWeek / 7) * i).toFixed(2))
      : undefined;
    return { label: DAY_SHORT[i], actual, expected };
  });

  // Historical 28-day regression for adaptive insight
  const histPts: { x: number; y: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ddmm = isoToDDMM(localYMD(d));
    const found = allTrackerDays.find((day: any) => day.day === ddmm);
    if (found && parseFloat(found.weight) > 0)
      histPts.push({ x: 27 - i, y: parseFloat(found.weight) });
  }

  const reg = linearReg(histPts);
  const weeklyRate = reg?.weeklyRate ?? null;

  let insightLevel: 'good' | 'great' | 'behind' | 'nodata' = 'nodata';
  let insightMsg = 'Log your weight for a few more days to unlock your trend analysis.';

  if (lossPerWeek <= 0) {
    insightMsg = 'Set a goal weight and weekly target to see your progress prediction.';
  } else if (histPts.length >= 3 && weeklyRate !== null) {
    if (isBulk) {
      // Gaining weight — weeklyRate > 0 means gaining
      const actualGain = weeklyRate;
      if (actualGain >= lossPerWeek + 0.1) {
        insightLevel = 'behind';
        insightMsg = `You're gaining ${actualGain.toFixed(2)} kg/week — faster than your ${lossPerWeek} kg target. Slow bulk means more muscle, less fat. Check your surplus.`;
      } else if (actualGain >= lossPerWeek - 0.1) {
        insightLevel = 'great';
        insightMsg = `Right on track — gaining ${actualGain.toFixed(2)} kg/week matches your ${lossPerWeek} kg bulk target. Keep training heavy and hitting your protein.`;
      } else if (actualGain >= 0.05) {
        insightLevel = 'good';
        insightMsg = `Gaining ${actualGain.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. A little more food or one extra gym session could close the gap.`;
      } else {
        insightLevel = 'behind';
        insightMsg = `Minimal weight change detected. To bulk, you need a consistent calorie surplus — make sure you're hitting your kcal target every day.`;
      }
    } else {
      // Losing weight — actualLoss > 0 means losing
      const actualLoss = -weeklyRate;
      if (actualLoss >= lossPerWeek + 0.15) {
        insightLevel = 'great';
        insightMsg = `You're losing ${actualLoss.toFixed(2)} kg/week — ahead of your ${lossPerWeek} kg target. Great progress! Make sure you're eating enough protein to protect muscle.`;
      } else if (actualLoss >= lossPerWeek - 0.1) {
        insightLevel = 'good';
        insightMsg = `Right on track — ${actualLoss.toFixed(2)} kg/week matches your ${lossPerWeek} kg target. Keep the routine going.`;
      } else if (actualLoss >= 0.05) {
        insightLevel = 'behind';
        const gap = Math.round((lossPerWeek - actualLoss) * 7700 / 7);
        insightMsg = `You're losing ${actualLoss.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. Tighten up ~${gap} kcal/day to close the gap — you've got this.`;
      } else {
        insightLevel = 'behind';
        insightMsg = `Minimal change detected recently. That's okay — consistency beats perfection. Focus on hitting your calorie and protein targets this week.`;
      }
    }
  }

  const hasAny = weekData.some(d => d.actual !== undefined);
  const allVals = weekData.flatMap(d => [d.actual, d.expected].filter(v => v !== undefined) as number[]);
  const minW = allVals.length > 0 ? Math.floor(Math.min(...allVals) - 1) : 70;
  const maxW = allVals.length > 0 ? Math.ceil(Math.max(...allVals) + 1) : 90;

  return (
    <div className="diet-section weight-sparkline-card">
      <h2 className="diet-heading">Weight This Week</h2>

      {hasAny || weekData.some(d => d.expected !== undefined) ? (
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={weekData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[minW, maxW]} tick={{ fill: '#444', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
            <Tooltip
              contentStyle={{ background: '#0d0d1a', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#888' }}
              formatter={((val: any, name: string) => [`${val} kg`, name === 'actual' ? 'Logged' : 'Expected']) as any}
            />
            <Line type="linear" dataKey="expected" stroke="#00e5ff33" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls name="expected" />
            <Line type="monotone" dataKey="actual" stroke="#00e5ff" strokeWidth={2.5} dot={{ fill: '#00e5ff', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} name="actual" />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="diet-hint" style={{ marginTop: 8 }}>No weight data this week — log your morning weight via the daily check-in.</p>
      )}

      <div className={`insight-box insight-${insightLevel}`}>{insightMsg}</div>

      {weeklyRate !== null && (
        <div className="trend-stats">
          <div className="trend-stat">
            <span className="trend-stat-label">28-day trend</span>
            <span className="trend-stat-val">{(-weeklyRate) >= 0 ? '−' : '+'}{Math.abs(weeklyRate).toFixed(2)} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Your target</span>
            <span className="trend-stat-val">−{lossPerWeek} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Data points</span>
            <span className="trend-stat-val">{histPts.length} days</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ActivityTargetsCard ───────────────────────────────────────
const ActivityTargetsCard: React.FC<{
  currentWeight: number;
  maintenance: number;
  macroCalories: number;
  lossPerWeek: number;
  stepTarget: number;
  yesterdaySteps: number | null;
  onSaved: (steps: number) => void;
}> = ({ currentWeight, maintenance, macroCalories, lossPerWeek, stepTarget, yesterdaySteps, onSaved }) => {

  const targetDeficit = lossPerWeek > 0 ? Math.round(lossPerWeek * 7700 / 7) : 0;
  const dietDeficit = maintenance > 0 ? Math.max(0, maintenance - macroCalories) : 0;
  const exerciseGap = Math.max(0, targetDeficit - dietDeficit);

  const kcalPerStep = currentWeight > 0 ? 0.04 * (currentWeight / 70) : 0.04;
  const extraSteps = exerciseGap > 0 ? Math.round(exerciseGap / kcalPerStep) : 0;
  const recommendedSteps = Math.max(8000, stepTarget + extraSteps);
  const cardioBurn = exerciseGap > 0
    ? Math.max(0, exerciseGap - Math.round(stepTarget * kcalPerStep))
    : Math.round(200 * (currentWeight > 0 ? currentWeight / 80 : 1));

  return (
    <div className="diet-section activity-card">
      <h2 className="diet-heading">Activity Targets</h2>

      <div className="activity-row">
        <div className="activity-item">
          <span className="activity-label">Recommended steps</span>
          <span className="activity-value">{recommendedSteps.toLocaleString()}</span>
          <span className="activity-sub">≈ {Math.round(recommendedSteps * kcalPerStep)} kcal from walking</span>
        </div>
        <div className="activity-item">
          <span className="activity-label">Cardio to burn</span>
          <span className="activity-value">{cardioBurn > 0 ? cardioBurn.toLocaleString() : '—'} <span style={{ fontSize: '0.8rem' }}>kcal</span></span>
          <span className="activity-sub">{exerciseGap > 0 ? 'needed to hit weekly target' : 'bonus burn for faster results'}</span>
        </div>
      </div>

      {yesterdaySteps !== null && (
        <div className="step-perf-yesterday">
          <div className="step-perf-bar-wrap">
            <div className="step-perf-bar">
              <div className="step-perf-fill" style={{ width: `${Math.min(100, (yesterdaySteps / stepTarget) * 100)}%`, background: yesterdaySteps >= stepTarget ? '#30d158' : '#ff9f0a' }} />
            </div>
          </div>
          <div className="step-perf-row">
            <span className="step-perf-count">{yesterdaySteps.toLocaleString()} yesterday</span>
            <span className={`step-perf-badge${yesterdaySteps >= stepTarget ? ' hit' : ' miss'}`}>
              {yesterdaySteps >= stepTarget ? '✓ Target hit' : `${(stepTarget - yesterdaySteps).toLocaleString()} short`}
            </span>
          </div>
        </div>
      )}

      <StepLogger onSaved={onSaved} />
    </div>
  );
};

// ── WeeklyPlanCard ────────────────────────────────────────────
const WeeklyPlanCard: React.FC<{
  goal: 'cut' | 'maintain' | 'bulk';
  kg: number;
  stepTarget: number;
  gymSessions: number;
  onStepTargetChange: (val: number) => void;
  onGymSessionsChange: (val: number) => void;
}> = ({ goal, kg, stepTarget, gymSessions, onStepTargetChange, onGymSessionsChange }) => {
  const [localStep, setLocalStep] = useState(stepTarget);
  useEffect(() => setLocalStep(stepTarget), [stepTarget]);

  const proteinG = kg > 0 ? Math.round(kg * (goal === 'cut' ? 2.0 : goal === 'bulk' ? 1.8 : 1.7)) : 0;

  const gymAdvice = gymSessions === 0
    ? 'Try adding at least 2 gym sessions this week — resistance training protects muscle.'
    : gymSessions < 3
    ? `${gymSessions} gym session${gymSessions > 1 ? 's' : ''} this week is a solid start. Mix strength and cardio.`
    : gymSessions >= 5
    ? `${gymSessions} sessions this week — strong commitment. Make sure you're recovering well too.`
    : `${gymSessions} gym sessions keeps you on track. Prioritise compound lifts for best results.`;

  const stepAdvice = localStep >= 10000
    ? `Your ${Math.round(localStep / 1000)}k step target adds a great daily calorie burn.`
    : `Aim for 10,000 steps/day — the extra movement makes a real difference over time.`;

  const proteinAdvice = kg > 0
    ? ` Hit ${proteinG}g protein daily to ${goal === 'cut' ? 'protect muscle while cutting' : goal === 'bulk' ? 'fuel your muscle growth' : 'stay lean and strong'}.`
    : '';

  const goalLabel = goal === 'cut' ? 'cut fat' : goal === 'bulk' ? 'build muscle' : 'maintain your weight';

  return (
    <div className="diet-section weekly-plan-card">
      <h2 className="diet-heading">Weekly Plan</h2>

      <div className="weekly-plan-row">
        <span className="weekly-plan-label">Gym sessions this week</span>
        <div className="gym-stepper">
          <button className="gym-step-btn" onClick={() => onGymSessionsChange(Math.max(0, gymSessions - 1))}>−</button>
          <span className="gym-step-val">{gymSessions}<span className="gym-step-x">×</span></span>
          <button className="gym-step-btn" onClick={() => onGymSessionsChange(Math.min(7, gymSessions + 1))}>+</button>
        </div>
      </div>

      <div className="weekly-plan-row">
        <span className="weekly-plan-label">Daily step target</span>
        <div className="step-target-inline">
          <input
            className="step-target-input"
            type="text"
            inputMode="numeric"
            value={localStep}
            onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) setLocalStep(n); }}
            onBlur={() => onStepTargetChange(localStep)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <span className="weekly-plan-unit">steps</span>
        </div>
      </div>

      <div className="plan-advice-box">
        <span className="plan-advice-icon">💡</span>
        <p className="plan-advice-text">To {goalLabel}: {gymAdvice} {stepAdvice}{proteinAdvice}</p>
      </div>
    </div>
  );
};

const Diet: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'meals' ? 'meals' : 'targets';
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [locks, setLocks] = useState<Locks>({ protein: false, carbs: false, fats: false });
  const [calorieLock, setCalorieLock] = useState(false);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanLabel, setEditingPlanLabel] = useState('');
  const [dietFilters, setDietFilters] = useState<string[]>([]);
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [gymSessions, setGymSessions] = useState<number>(() => parseInt(localStorage.getItem('superdub.gym.sessions') || '3'));
  const [stepTarget, setStepTarget] = useState(10000);
  const [yesterdaySteps, setYesterdaySteps] = useState<number | null>(null);
  const [allTrackerDays, setAllTrackerDays] = useState<any[]>([]);
  const [goalWeight, setGoalWeight] = useState(0);
  const [lossPerWeek, setLossPerWeek] = useState(0.5);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getDietTarget(),
      api.getDietSettings(),
      api.getDietPlans(),
      api.getTracker(),
      api.getWeightSettings(),
    ]).then(([profileData, targetData, settingsData, plansData, trackerData, weightSettingsData]) => {
      const td = trackerData as any;
      const allDays: any[] = td.days ?? [];
      setAllTrackerDays(allDays);
      const ws = weightSettingsData as any;
      if (ws.goalWeight) setGoalWeight(parseFloat(ws.goalWeight) || 0);
      if (ws.lossPerWeek) setLossPerWeek(parseFloat(ws.lossPerWeek) || 0.5);

      // Yesterday's steps — tracker stores days in DD/MM format
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yestDDMM = `${String(yest.getDate()).padStart(2,'0')}/${String(yest.getMonth()+1).padStart(2,'0')}`;
      const yestDay = allDays.find((d: any) => d.day === yestDDMM);
      if (yestDay?.steps != null) setYesterdaySteps(Number(yestDay.steps));

      const p = profileData as ProfileData & { name: string };
      setProfile({
        dob: p.dob ?? '',
        heightCm: p.heightCm ?? '',
        weightKg: p.weightKg ?? '',
        sex: p.sex ?? 'male',
        activity: p.activity ?? '1.55',
        steps: p.steps ?? '',
        vestKg: p.vestKg ?? '',
      });
      setTarget(targetData as MacroSet);
      const s = settingsData as any;
      setLocks({ protein: !!s.lockProtein, carbs: !!s.lockCarbs, fats: !!s.lockFats });
      setCalorieLock(!!s.calorieLock);
      setGoal((s.goal as 'cut' | 'maintain' | 'bulk') ?? 'cut');
      const pa = profileData as any;
      if (pa.stepTarget) setStepTarget(Number(pa.stepTarget));
      setPlans((plansData as any[]).map(r => ({
        id: r.id,
        label: r.label,
        meals: r.meals,
        totals: r.totals,
      })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Derived
  const macroCalories = target.protein * 4 + target.carbs * 4 + target.fats * 9;

  const kg = parseFloat(profile.weightKg) || 0;
  const cm = parseFloat(profile.heightCm) || 0;
  const age = ageFromDob(profile.dob) || 0;
  const activity = parseFloat(profile.activity) || 1.55;
  const steps = parseFloat(profile.steps) || 0;
  const vestKg = parseFloat(profile.vestKg) || 0;

  const bmr = kg > 0 && cm > 0 && age > 0
    ? profile.sex === 'male'
      ? 10 * kg + 6.25 * cm - 5 * age + 5
      : 10 * kg + 6.25 * cm - 5 * age - 161
    : 0;
  const tdee = bmr > 0 ? Math.round(bmr * activity) : 0;
  const walkKm = steps * STRIDE_M / 1000;
  const walkBurn = steps > 0 && kg > 0 ? Math.round(walkKm * (kg + vestKg) * 0.5) : 0;
  const maintenance = tdee + walkBurn;

  const energyBalance = (() => {
    if (maintenance === 0) return '—';
    const diff = macroCalories - maintenance;
    if (diff > 300) return 'Aggressive Bulk';
    if (diff > 50) return 'Mild Bulk';
    if (diff >= -50) return 'Maintenance';
    if (diff >= -500) return 'Mild Cut';
    return 'Aggressive Cut';
  })();

  const applyGoal = (newGoal: 'cut' | 'maintain' | 'bulk') => {
    setGoal(newGoal);
    api.updateDietSettings({ lockProtein: locks.protein, lockCarbs: locks.carbs, lockFats: locks.fats, calorieLock, goal: newGoal }).catch(() => {});
    if (maintenance <= 0 || kg <= 0) return;
    const targetCals = Math.max(1200, newGoal === 'cut' ? maintenance - 400 : newGoal === 'bulk' ? maintenance + 300 : maintenance);
    // Body-weight based macro split
    const proteinG = Math.round(kg * (newGoal === 'cut' ? 2.0 : newGoal === 'bulk' ? 1.8 : 1.7));
    const fatG     = Math.round(kg * (newGoal === 'cut' ? 0.8 : newGoal === 'bulk' ? 1.1 : 0.9));
    const carbCals = Math.max(0, targetCals - proteinG * 4 - fatG * 9);
    const carbG    = Math.round(carbCals / 4);
    const next = { calories: targetCals, protein: proteinG, carbs: carbG, fats: fatG };
    setTarget(next);
    api.updateDietTarget(next).catch(() => {});
  };

  const generatePlan = () => {
    const plan = generateMealPlan(target, dietFilters);
    setPlans(prev => [plan, ...prev].slice(0, 5));
    setExpandedPlan(plan.id);
    api.createDietPlan(plan).catch(() => {});
  };

  const regenerateMeal = (planId: string, slotIndex: number) => {
    const slot = MEAL_SLOTS[slotIndex];
    const tpl = pickFilteredTemplate(slot.name, dietFilters);
    const newMeal = generateSingleMeal(target, slot, tpl);
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const newMeals = [...p.meals];
      newMeals[slotIndex] = newMeal;
      const tp = newMeals.reduce((s, m) => s + m.totals.p, 0);
      const tc = newMeals.reduce((s, m) => s + m.totals.c, 0);
      const tf = newMeals.reduce((s, m) => s + m.totals.f, 0);
      return { ...p, meals: newMeals, totals: { p: tp, c: tc, f: tf, kcal: Math.round(tp * 4 + tc * 4 + tf * 9) } };
    }));
  };

  const toggleFilter = (id: string) => {
    setDietFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    if (expandedPlan === id) setExpandedPlan(null);
    api.deleteDietPlan(id).catch(() => {});
  };

  const startRenamePlan = (plan: SavedPlan) => {
    setEditingPlanId(plan.id);
    setEditingPlanLabel(plan.label);
  };

  const commitRenamePlan = (id: string) => {
    const label = editingPlanLabel.trim();
    if (!label) { setEditingPlanId(null); return; }
    setPlans(prev => prev.map(p => p.id === id ? { ...p, label } : p));
    setEditingPlanId(null);
    api.renameDietPlan(id, label).catch(() => {});
  };

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
        <header className="header">
          <div className="header-left"><Link to="/" className="back-link">← Back</Link></div>
          <h1 className="title">Macro Split & Performance</h1>
        </header>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', color: '#00e5ff' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 className="title">Training Plan</h1>
      </header>

      <div className="diet-content page-content">

        {/* Tab switcher */}
        <div className="diet-tabs">
          <button className={`diet-tab${activeTab === 'targets' ? ' active' : ''}`} onClick={() => setSearchParams({})}>Targets</button>
          <button className={`diet-tab${activeTab === 'meals' ? ' active' : ''}`} onClick={() => setSearchParams({ tab: 'meals' })}>Meal Plans</button>
        </div>

        {activeTab === 'targets' && (<>

        {/* ── Section 1: Goal & Strategy ── */}
        <div className="plan-section-label">Goal & Strategy</div>

        <WeightGoalCard
          currentWeight={kg}
          goalWeight={goalWeight}
          lossPerWeek={lossPerWeek}
          onSave={(gw, lpw) => {
            setGoalWeight(gw);
            setLossPerWeek(lpw);
            api.updateWeightSettings({ goalWeight: gw, lossPerWeek: lpw }).catch(() => {});
          }}
        />

        {/* Strategy: Cut / Bulk / Maintain with auto macro recommendation */}
        <div className="diet-section strategy-card">
          <h2 className="diet-heading">Strategy</h2>
          <div className="diet-goal-card">
            {(['cut', 'maintain', 'bulk'] as const).map(g => (
              <button key={g} className={`diet-goal-btn${goal === g ? ' active' : ''}`} onClick={() => applyGoal(g)}>
                <span className="diet-goal-icon">{g === 'cut' ? '🔥' : g === 'maintain' ? '⚖️' : '💪'}</span>
                <span className="diet-goal-label">{g === 'cut' ? 'Cut' : g === 'maintain' ? 'Maintain' : 'Bulk'}</span>
                <span className="diet-goal-delta">{g === 'cut' ? '−400 kcal' : g === 'maintain' ? '±0 kcal' : '+300 kcal'}</span>
              </button>
            ))}
          </div>
          <div className="strategy-macro-row">
            {[
              { val: target.protein, lbl: 'protein', color: '#ff6ec7' },
              { val: target.carbs,   lbl: 'carbs',   color: '#00e5ff' },
              { val: target.fats,    lbl: 'fats',     color: '#ffd60a' },
            ].map(m => (
              <div key={m.lbl} className="strategy-macro-chip">
                <span className="smc-val" style={{ color: m.color }}>{m.val}g</span>
                <span className="smc-lbl">{m.lbl}</span>
              </div>
            ))}
            <div className="strategy-macro-chip">
              <span className="smc-val">{macroCalories.toLocaleString()}</span>
              <span className="smc-lbl">kcal/day</span>
            </div>
          </div>
          {maintenance > 0 && (
            <div className="strategy-maintenance">
              Maintenance: {maintenance.toLocaleString()} kcal · <span className="strategy-eb">{energyBalance}</span>
            </div>
          )}
          <Link to="/diet/macro" className="diet-macro-link-card" style={{ marginTop: 12 }}>
            <div className="diet-macro-link-left">
              <span className="diet-macro-link-title">Macro Analysis</span>
              <span className="diet-macro-link-sub">Fine-tune protein · carbs · fats</span>
            </div>
            <span className="diet-macro-link-arrow">→</span>
          </Link>
        </div>

        {/* Gym sessions + step target + personalised advice */}
        <WeeklyPlanCard
          goal={goal}
          kg={kg}
          stepTarget={stepTarget}
          gymSessions={gymSessions}
          onStepTargetChange={val => {
            setStepTarget(val);
            api.updateProfile({ stepTarget: val }).catch(() => {});
          }}
          onGymSessionsChange={val => {
            setGymSessions(val);
            localStorage.setItem('superdub.gym.sessions', String(val));
          }}
        />

        {/* ── Section 2: Actuals ── */}
        <div className="plan-section-label" style={{ marginTop: 8 }}>Actuals</div>

        <WeightSparkline
          allTrackerDays={allTrackerDays}
          currentWeight={kg}
          goalWeight={goalWeight}
          lossPerWeek={lossPerWeek}
        />

        <ActivityTargetsCard
          currentWeight={kg}
          maintenance={maintenance}
          macroCalories={macroCalories}
          lossPerWeek={lossPerWeek}
          stepTarget={stepTarget}
          yesterdaySteps={yesterdaySteps}
          onSaved={steps => setYesterdaySteps(steps)}
        />

        </>)}

        {activeTab === 'meals' && (<>

        {/* Diet Filters */}
        <div className="diet-section">
          <h2 className="diet-heading">Diet Filters</h2>
          <div className="diet-filter-chips">
            {DIET_FILTER_OPTIONS.map(f => (
              <button
                key={f.id}
                className={`diet-filter-chip${dietFilters.includes(f.id) ? ' active' : ''}`}
                onClick={() => toggleFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meal Plans */}
        <div className="diet-section" id="meals">
          <div className="plan-head-row">
            <h2 className="diet-heading">Meal Plans</h2>
            <button className="plan-apply" onClick={generatePlan}>Generate Plan</button>
          </div>

          {plans.length === 0 ? (
            <p className="diet-empty">No plans yet — click "Generate Plan" to create one based on your targets.</p>
          ) : (
            <div className="plan-cards">
              {plans.map(plan => (
                <div key={plan.id} className="plan-card">
                  <div className="plan-card-head">
                    {editingPlanId === plan.id ? (
                      <input
                        className="plan-label-input"
                        value={editingPlanLabel}
                        autoFocus
                        onChange={e => setEditingPlanLabel(e.target.value)}
                        onBlur={() => commitRenamePlan(plan.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRenamePlan(plan.id);
                          if (e.key === 'Escape') setEditingPlanId(null);
                        }}
                        maxLength={80}
                      />
                    ) : (
                      <h3
                        className="plan-label-text"
                        onClick={() => startRenamePlan(plan)}
                        title="Tap to rename"
                      >{plan.label}</h3>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button className="plan-toggle" onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                        {expandedPlan === plan.id ? 'Hide' : 'View meals'}
                      </button>
                      <button className="food-remove" onClick={() => deletePlan(plan.id)}>✕</button>
                    </div>
                  </div>
                  <p className="plan-total">{plan.totals.kcal} kcal · P{plan.totals.p}g · C{plan.totals.c}g · F{plan.totals.f}g</p>
                  {expandedPlan === plan.id && (
                    <ul className="plan-meals">
                      {plan.meals.map((meal, mealIdx) => (
                        <li key={meal.name} className="plan-meal">
                          <div className="plan-meal-head">
                            <span className="plan-meal-name">{meal.name}</span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className="plan-meal-kcal">{meal.totals.kcal} kcal</span>
                              <button
                                className="meal-regen-btn"
                                onClick={() => regenerateMeal(plan.id, mealIdx)}
                                title="Regenerate this meal"
                              >↺</button>
                            </div>
                          </div>
                          <table className="meal-breakdown">
                            <tbody>
                              {meal.items.map((item, i) => (
                                <tr key={i}>
                                  <td className="mb-item">{item.label}</td>
                                  <td className="mb-macro">P{item.p}·C{item.c}·F{item.f}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="plan-desc">P{meal.totals.p}g · C{meal.totals.c}g · F{meal.totals.f}g</p>
                          {meal.flavor && <p className="plan-flavor">💡 {meal.flavor}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        </>)}

      </div>
    </div>
  );
};

export default Diet;
