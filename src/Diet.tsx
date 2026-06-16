import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

const MACRO_STEP = 5;
const CAL_STEP = 10;
const STRIDE_M = 0.762;

const CAL_PER: Record<MacroKey, number> = { protein: 4, carbs: 4, fats: 9 };

const MACRO_COLORS: Record<MacroKey, string> = {
  protein: '#ff6ec7',
  carbs: '#00e5ff',
  fats: '#ffd60a',
};

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

interface SlotTemplate { protein: string; carb: string; fat: string; flavor: string; }

const MEAL_TEMPLATES: Record<string, SlotTemplate[]> = {
  Breakfast: [
    { protein: 'eggs', carb: 'oats', fat: 'almonds',
      flavor: 'Scramble the eggs with smoked paprika and black pepper. Stir the almonds and a pinch of cinnamon into warm oats — add a splash of milk to make it creamy.' },
    { protein: 'eggs', carb: 'bread', fat: 'avocado',
      flavor: 'Poached or fried eggs on toast with smashed avocado. Season the avocado with lemon juice, chilli flakes, and flaky sea salt.' },
    { protein: 'eggs', carb: 'tortilla', fat: 'cheese',
      flavor: 'Breakfast wrap with scrambled eggs and melted cheese. Add a spoonful of salsa, a pinch of cumin, and a dash of hot sauce.' },
    { protein: 'whey', carb: 'oats', fat: 'peanutbutter',
      flavor: 'Mix vanilla protein powder into warm oats, then swirl in peanut butter. Top with a sliced banana and a pinch of sea salt — it brings out the sweetness.' },
    { protein: 'yoghurt', carb: 'oats', fat: 'almonds',
      flavor: 'Layer Greek yoghurt over oats with crushed almonds. Add honey, a drop of vanilla extract, and a generous pinch of cinnamon.' },
    { protein: 'yoghurt', carb: 'banana', fat: 'seeds',
      flavor: 'Greek yoghurt bowl with sliced banana and mixed seeds. Drizzle honey over the top and add a pinch of nutmeg or cardamom.' },
    { protein: 'yoghurt', carb: 'bread', fat: 'peanutbutter',
      flavor: 'Peanut butter on toast alongside a bowl of Greek yoghurt. Add banana slices and a sprinkle of cinnamon sugar on the toast.' },
    { protein: 'cottage', carb: 'oats', fat: 'almonds',
      flavor: 'Stir cottage cheese into warm oats — creamier than you\'d expect. Top with crushed almonds, berries if you have them, and a drizzle of honey.' },
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
    { protein: 'tofu', carb: 'noodles', fat: 'seeds',
      flavor: 'Crispy tofu noodle bowl. Press and marinate tofu in soy, ginger, and garlic. Pan-fry until golden. Top with sesame seeds and chilli oil.' },
    { protein: 'whitefish', carb: 'rice', fat: 'oliveoil',
      flavor: 'Baked white fish over rice. Season with cumin, coriander, garlic, and lemon. Drizzle olive oil and roast at 200°C for 15 min.' },
  ],
  Snack: [
    { protein: 'yoghurt', carb: 'banana', fat: 'peanutbutter',
      flavor: 'Slice the banana and dip into peanut butter. Serve with a bowl of Greek yoghurt. A pinch of cinnamon and a flake of sea salt makes it feel indulgent.' },
    { protein: 'cottage', carb: 'bread', fat: 'almonds',
      flavor: 'Cottage cheese on wholegrain toast with a handful of almonds. Season with black pepper and a light drizzle of honey.' },
    { protein: 'whey', carb: 'banana', fat: 'peanutbutter',
      flavor: 'Blend protein powder with banana, peanut butter, ice, and a splash of milk. Add a pinch of sea salt — it balances the sweetness perfectly.' },
    { protein: 'eggs', carb: 'bread', fat: 'avocado',
      flavor: 'Hard-boiled egg on toast with smashed avocado. Sprinkle with everything bagel seasoning, or keep it simple with sea salt and cracked pepper.' },
    { protein: 'yoghurt', carb: 'oats', fat: 'seeds',
      flavor: 'Bircher-style: mix yoghurt and oats overnight. Top with mixed seeds, a drizzle of honey, and a drop of vanilla. Eat cold — it\'s great.' },
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
    { protein: 'salmon', carb: 'noodles', fat: 'seeds',
      flavor: 'Miso-glazed salmon on soba noodles. Mix miso paste, mirin, soy, and honey for the glaze. Broil the salmon for 8 min. Finish with sesame seeds and spring onion.' },
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

interface MacroFieldProps {
  label: string;
  mkey: MacroKey;
  val: number;
  isLocked: boolean;
  max: number | null;
  onChangeMacro: (key: MacroKey, newVal: number) => void;
  onToggleLock: (key: MacroKey) => void;
}

const MacroField: React.FC<MacroFieldProps> = ({ label, mkey, val, isLocked, max, onChangeMacro, onToggleLock }) => (
  <div className={`target-field macro-field${isLocked ? ' locked' : ''}`}>
    <label>{label}{max !== null && <span className="plan-target-note"> (max {max}g)</span>}</label>
    <div className="macro-input-row">
      <div className="stepper">
        <input
          type="text"
          inputMode="numeric"
          value={val}
          disabled={isLocked}
          onChange={e => {
            const n = parseInt(e.target.value);
            if (!isNaN(n)) onChangeMacro(mkey, n);
            else if (e.target.value === '') onChangeMacro(mkey, 0);
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowUp') { e.preventDefault(); onChangeMacro(mkey, val + MACRO_STEP); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onChangeMacro(mkey, Math.max(0, val - MACRO_STEP)); }
          }}
        />
        <div className="stepper-btns">
          <button type="button" disabled={isLocked} onClick={() => onChangeMacro(mkey, val + MACRO_STEP)}>▲</button>
          <button type="button" disabled={isLocked || val <= 0} onClick={() => onChangeMacro(mkey, Math.max(0, val - MACRO_STEP))}>▼</button>
        </div>
      </div>
      <button
        type="button"
        className={`lock-btn${isLocked ? ' on' : ''}`}
        onClick={() => onToggleLock(mkey)}
        title={isLocked ? 'Unlock' : 'Lock'}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>
    </div>
  </div>
);

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

const Diet: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'meals' ? 'meals' : 'targets';
  const [activeTab, setActiveTab] = useState<'targets' | 'meals'>(initialTab);
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [profileName, setProfileName] = useState('');
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [locks, setLocks] = useState<Locks>({ protein: false, carbs: false, fats: false });
  const [calorieLock, setCalorieLock] = useState(false);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanLabel, setEditingPlanLabel] = useState('');
  const [dietFilters, setDietFilters] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getDietTarget(),
      api.getDietSettings(),
      api.getDietPlans(),
    ]).then(([profileData, targetData, settingsData, plansData]) => {
      const p = profileData as ProfileData & { name: string };
      setProfileName(p.name ?? '');
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
      setPlans((plansData as any[]).map(r => ({
        id: r.id,
        label: r.label,
        meals: r.meals,
        totals: r.totals,
      })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Debounced target save
  const targetSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);

  const scheduleTargetSave = () => {
    clearTimeout(targetSaveTimer.current);
    targetSaveTimer.current = setTimeout(() => {
      api.updateDietTarget(targetRef.current).catch(() => {});
    }, 600);
  };

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

  const totalKcal = macroCalories;
  const proteinPct = totalKcal > 0 ? (target.protein * 4 / totalKcal) * 100 : 0;
  const carbsPct = totalKcal > 0 ? (target.carbs * 4 / totalKcal) * 100 : 0;
  const fatsPct = totalKcal > 0 ? (target.fats * 9 / totalKcal) * 100 : 0;

  const macroStyle = (() => {
    if (carbsPct < 10) return 'Ketogenic';
    if (carbsPct < 26) return 'Low Carb';
    if (proteinPct > 35) return 'High Protein';
    if (carbsPct > 55) return 'High Carb';
    return 'Balanced';
  })();

  const energyBalance = (() => {
    if (maintenance === 0) return '—';
    const diff = macroCalories - maintenance;
    if (diff > 300) return 'Aggressive Bulk';
    if (diff > 50) return 'Mild Bulk';
    if (diff >= -50) return 'Maintenance';
    if (diff >= -500) return 'Mild Cut';
    return 'Aggressive Cut';
  })();

  const proteinPerKg = kg > 0 ? (target.protein / kg).toFixed(1) : '—';

  const getMax = (key: MacroKey): number | null => {
    if (!calorieLock) return null;
    const ceiling = macroCalories;
    const othersCal = (['protein', 'carbs', 'fats'] as MacroKey[])
      .filter(k => k !== key)
      .reduce((sum, k) => sum + target[k] * CAL_PER[k], 0);
    return Math.max(0, Math.floor((ceiling - othersCal) / CAL_PER[key]));
  };

  const changeMacro = (key: MacroKey, newVal: number) => {
    const safeVal = Math.max(0, newVal);
    if (!calorieLock) {
      setTarget(prev => {
        const next = { ...prev, [key]: safeVal };
        setTimeout(() => { targetRef.current = next; scheduleTargetSave(); }, 0);
        return next;
      });
      return;
    }
    const ceiling = macroCalories;
    const calFromThis = safeVal * CAL_PER[key];
    const otherKeys = (['protein', 'carbs', 'fats'] as MacroKey[]).filter(k => k !== key);
    const lockedCal = otherKeys.filter(k => locks[k]).reduce((s, k) => s + target[k] * CAL_PER[k], 0);
    const remaining = ceiling - calFromThis - lockedCal;
    const unlocked = otherKeys.filter(k => !locks[k]);

    const newValues: Partial<MacroSet> = { [key]: safeVal };
    if (unlocked.length === 0) {
      setTarget(prev => {
        const next = { ...prev, ...newValues };
        setTimeout(() => { targetRef.current = next; scheduleTargetSave(); }, 0);
        return next;
      });
      return;
    }
    const currentUnlockedCal = unlocked.reduce((s, k) => s + target[k] * CAL_PER[k], 0);
    if (currentUnlockedCal <= 0 || remaining <= 0) {
      const calEach = Math.max(0, remaining) / unlocked.length;
      unlocked.forEach(k => { newValues[k] = Math.max(0, Math.round(calEach / CAL_PER[k])); });
    } else {
      unlocked.forEach(k => {
        const proportion = (target[k] * CAL_PER[k]) / currentUnlockedCal;
        newValues[k] = Math.max(0, Math.round((remaining * proportion) / CAL_PER[k]));
      });
    }
    setTarget(prev => {
      const next = { ...prev, ...newValues };
      setTimeout(() => { targetRef.current = next; scheduleTargetSave(); }, 0);
      return next;
    });
  };

  const toggleLock = (key: MacroKey) => {
    setLocks(prev => {
      const next = { ...prev, [key]: !prev[key] };
      api.updateDietSettings({ lockProtein: next.protein, lockCarbs: next.carbs, lockFats: next.fats, calorieLock }).catch(() => {});
      return next;
    });
  };

  const toggleCalorieLock = () => {
    setCalorieLock(prev => {
      const next = !prev;
      api.updateDietSettings({ lockProtein: locks.protein, lockCarbs: locks.carbs, lockFats: locks.fats, calorieLock: next }).catch(() => {});
      return next;
    });
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

  const pieData = [
    { name: 'Protein', value: target.protein * 4, color: MACRO_COLORS.protein },
    { name: 'Carbs', value: target.carbs * 4, color: MACRO_COLORS.carbs },
    { name: 'Fats', value: target.fats * 9, color: MACRO_COLORS.fats },
  ].filter(d => d.value > 0);

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
        <header className="header">
          <div className="header-left"><Link to="/" className="back-link">← Back</Link></div>
          <h1 className="title">Diet Maker</h1>
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
        <h1 className="title">Diet Maker</h1>
      </header>

      <div className="diet-content page-content">

        {/* Tab switcher */}
        <div className="diet-tabs">
          <button className={`diet-tab${activeTab === 'targets' ? ' active' : ''}`} onClick={() => setActiveTab('targets')}>Diet Maker</button>
          <button className={`diet-tab${activeTab === 'meals' ? ' active' : ''}`} onClick={() => setActiveTab('meals')}>Meal Plans</button>
        </div>

        {/* Maintenance card */}
        <div className="diet-maintenance-card">
          {maintenance > 0 ? (
            <>
              <div className="diet-maint-top">
                <span className="diet-maint-label">Predicted Maintenance</span>
                <span className="diet-maint-badge">{energyBalance}</span>
              </div>
              <div className="diet-maint-kcal">{maintenance.toLocaleString()} <span className="diet-maint-unit">kcal / day</span></div>
              <div className="diet-maint-bar-wrap">
                <div className="diet-maint-bar">
                  <div
                    className="diet-maint-fill"
                    style={{ width: `${Math.min(100, (macroCalories / maintenance) * 100)}%` }}
                  />
                  <div className="diet-maint-marker" />
                </div>
                <div className="diet-maint-labels">
                  <span>0</span>
                  <span style={{ marginLeft: 'auto' }}>Target: {macroCalories} kcal</span>
                </div>
              </div>
              {walkBurn > 0 && (
                <div className="diet-maint-breakdown">TDEE {tdee} kcal + {walkBurn} kcal from steps</div>
              )}
            </>
          ) : (
            <div className="diet-maint-empty">
              <span>Set up your profile to unlock calorie predictions</span>
              <Link to="/profile" className="diet-profile-link">Go to Profile →</Link>
            </div>
          )}
        </div>

        {activeTab === 'targets' && (<>

        {/* Daily Targets */}
        <div className="diet-section">
          <h2 className="diet-heading">Daily Targets</h2>
          <div className="calorie-goal target-field">
            <label>
              Calorie Total
              <button
                type="button"
                className={`lock-btn${calorieLock ? ' on' : ''}`}
                style={{ marginLeft: 8 }}
                onClick={toggleCalorieLock}
                title={calorieLock ? 'Unlock calorie total' : 'Lock calorie total'}
              >
                {calorieLock ? '🔒' : '🔓'}
              </button>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="stepper" style={{ maxWidth: 160 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={macroCalories}
                  readOnly
                  style={{ cursor: 'default' }}
                />
                {calorieLock && (
                  <div className="stepper-btns">
                    <button type="button" onClick={() => {
                      const bump = CAL_STEP;
                      const unlocked = (['protein', 'carbs', 'fats'] as MacroKey[]).filter(k => !locks[k]);
                      if (unlocked.length > 0) {
                        const k = unlocked[0];
                        changeMacro(k, target[k] + Math.round(bump / CAL_PER[k]));
                      }
                    }}>▲</button>
                    <button type="button" onClick={() => {
                      const bump = CAL_STEP;
                      const unlocked = (['protein', 'carbs', 'fats'] as MacroKey[]).filter(k => !locks[k]);
                      if (unlocked.length > 0) {
                        const k = unlocked[0];
                        changeMacro(k, Math.max(0, target[k] - Math.round(bump / CAL_PER[k])));
                      }
                    }}>▼</button>
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>kcal</span>
            </div>
          </div>
          <p className="diet-hint">P×4 + C×4 + F×9 = {macroCalories} kcal</p>
          <div className="target-cascade">
            <MacroField label="Protein (g)" mkey="protein" val={target.protein} isLocked={locks.protein} max={getMax('protein')} onChangeMacro={changeMacro} onToggleLock={toggleLock} />
            <MacroField label="Carbs (g)" mkey="carbs" val={target.carbs} isLocked={locks.carbs} max={getMax('carbs')} onChangeMacro={changeMacro} onToggleLock={toggleLock} />
            <MacroField label="Fats (g)" mkey="fats" val={target.fats} isLocked={locks.fats} max={getMax('fats')} onChangeMacro={changeMacro} onToggleLock={toggleLock} />
          </div>
        </div>

        {/* Macro Analysis link */}
        <Link to="/diet/macro" className="diet-macro-link-card">
          <div className="diet-macro-link-left">
            <span className="diet-macro-link-title">Macro Analysis</span>
            <span className="diet-macro-link-sub">Split · Classification · Balance</span>
          </div>
          <span className="diet-macro-link-arrow">→</span>
        </Link>

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
