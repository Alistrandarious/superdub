import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const SPOONACULAR_KEY = process.env.SPOONACULAR_API_KEY;

// Protein shake — fixed macros (1 scoop whey + water)
const SHAKE = {
  slot: 'Protein Shake',
  isShake: true,
  targetCal: 150,
  recipe: null,
  scale: 1,
  macros: { calories: 150, protein: 30, carbs: 5, fat: 2 },
};

// Keywords that make a recipe non-halal
const HARAM_PATTERN =
  `%(pork|bacon|ham|lard|prosciutto|salami|pepperoni|chorizo|` +
  `pancetta|ribs|pulled pork|pork chop|` +
  `beer|wine|whiskey|vodka|rum|liquor|bourbon|sake|champagne|` +
  `alcohol|mirin|sherry|brandy|kahlua|baileys)%`;

// How many recipes are in the local DB
router.get('/recipe-count', requireAuth as any, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM recipes');
    res.json({ count: parseInt(rows[0].count) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Seed recipes from Spoonacular into local DB
router.post('/seed', requireAuth as any, async (_req: AuthRequest, res: Response) => {
  if (!SPOONACULAR_KEY) return res.status(400).json({ error: 'SPOONACULAR_API_KEY not set' });

  const batches = [
    { type: 'breakfast',   number: 30, minProtein: 15 },
    { type: 'main course', number: 60, minProtein: 20 },
    { type: 'snack',       number: 30, minProtein: 8  },
  ];

  let seeded = 0;
  let skipped = 0;

  try {
    for (const batch of batches) {
      const url =
        `https://api.spoonacular.com/recipes/complexSearch` +
        `?apiKey=${SPOONACULAR_KEY}` +
        `&type=${encodeURIComponent(batch.type)}` +
        `&minProtein=${batch.minProtein}` +
        `&addRecipeNutrition=true` +
        `&number=${batch.number}` +
        `&instructionsRequired=true`;

      const resp = await fetch(url);
      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(502).json({ error: `Spoonacular error: ${txt.slice(0, 200)}` });
      }

      const data: any = await resp.json();

      for (const r of data.results ?? []) {
        const nutrients: any[] = r.nutrition?.nutrients ?? [];
        const get = (name: string) =>
          nutrients.find((n: any) => n.name === name)?.amount ?? 0;

        const cal  = Math.round(get('Calories'));
        const prot = Math.round(get('Protein')       * 10) / 10;
        const carb = Math.round(get('Carbohydrates') * 10) / 10;
        const fat  = Math.round(get('Fat')           * 10) / 10;

        if (cal < 50) { skipped++; continue; }

        await pool.query(
          `INSERT INTO recipes
             (id, title, image, calories, protein, carbs, fat, servings,
              ready_in_minutes, dish_types, diets, source_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id, r.title, r.image ?? null,
            cal, prot, carb, fat,
            r.servings ?? 1, r.readyInMinutes ?? null,
            r.dishTypes ?? [], r.diets ?? [],
            r.sourceUrl ?? null,
          ]
        );
        seeded++;
      }
    }

    res.json({ ok: true, seeded, skipped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a full meal plan from the local recipe DB
router.post('/generate', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const {
      mealCount    = 3,
      diets        = [],
      excludeIds   = [],
      includeShake = false,
      halal        = false,
    } = req.body as {
      mealCount: number;
      diets: string[];
      excludeIds: number[];
      includeShake: boolean;
      halal: boolean;
    };

    // Load user's macro targets
    const { rows: trows } = await pool.query(
      'SELECT calories, protein, carbs, fats FROM diet_target WHERE user_id = $1',
      [req.userId]
    );
    const t = trows[0] ?? { calories: 2000, protein: 150, carbs: 200, fats: 67 };

    // If shake is included, reserve its calories from the total before distributing
    const availableCal = includeShake ? t.calories - SHAKE.macros.calories : t.calories;

    type Slot = { name: string; pct: number; dishTypes: string[] };
    const allSlots: Slot[] = [
      { name: 'Breakfast', pct: 0.25, dishTypes: ['breakfast', 'morning meal', 'brunch'] },
      { name: 'Lunch',     pct: 0.30, dishTypes: ['main course', 'lunch', 'soup', 'salad'] },
      { name: 'Dinner',    pct: 0.30, dishTypes: ['main course', 'dinner', 'soup'] },
      { name: 'Snack 1',  pct: 0.08, dishTypes: ['snack', 'appetizer', 'fingerfood', 'side dish'] },
      { name: 'Snack 2',  pct: 0.07, dishTypes: ['snack', 'appetizer', 'fingerfood'] },
    ];

    const slots = allSlots.slice(0, Math.min(Math.max(mealCount, 2), 5));
    const totalPct = slots.reduce((s, sl) => s + sl.pct, 0);
    slots.forEach(sl => { sl.pct = sl.pct / totalPct; });

    const usedIds = new Set<number>(excludeIds);
    const meals: any[] = [];

    for (const slot of slots) {
      const targetCal = Math.round(availableCal * slot.pct);
      const min = targetCal * 0.55;
      const max = targetCal * 1.55;
      const excluded = Array.from(usedIds);

      let recipe = await pickRecipe(excluded, min, max, diets, slot.dishTypes, halal);
      if (!recipe) recipe = await pickRecipe(excluded, min, max, diets, [], halal);
      if (!recipe) recipe = await pickRecipe(excluded, min, max, [], slot.dishTypes, halal);
      if (!recipe) recipe = await pickRecipe(excluded, min, max, [], [], halal);
      if (!recipe) recipe = await pickRecipe(excluded, 0, 999999, [], [], halal);

      if (recipe) {
        usedIds.add(recipe.id);
        const scale = recipe.calories > 0 ? targetCal / recipe.calories : 1;
        const scaled = Math.round(scale * 100) / 100;

        meals.push({
          slot: slot.name,
          targetCal,
          recipe: {
            id: recipe.id,
            title: recipe.title,
            image: recipe.image,
            sourceUrl: recipe.source_url,
            servings: recipe.servings,
            diets: recipe.diets ?? [],
          },
          scale: scaled,
          macros: {
            calories: Math.round(recipe.calories * scaled),
            protein:  Math.round(recipe.protein  * scaled * 10) / 10,
            carbs:    Math.round(recipe.carbs     * scaled * 10) / 10,
            fat:      Math.round(recipe.fat       * scaled * 10) / 10,
          },
        });
      }
    }

    // Append the shake at the end if requested
    if (includeShake) meals.push(SHAKE);

    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.macros.calories,
        protein:  acc.protein  + m.macros.protein,
        carbs:    acc.carbs    + m.macros.carbs,
        fat:      acc.fat      + m.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    res.json({
      meals,
      totals: {
        calories: Math.round(totals.calories),
        protein:  Math.round(totals.protein  * 10) / 10,
        carbs:    Math.round(totals.carbs    * 10) / 10,
        fat:      Math.round(totals.fat      * 10) / 10,
      },
      targets: { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fats },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Swap a single meal slot
router.post('/swap', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const {
      slotName,
      targetCal,
      diets      = [],
      excludeIds = [],
      halal      = false,
    } = req.body as {
      slotName: string;
      targetCal: number;
      diets: string[];
      excludeIds: number[];
      halal: boolean;
    };

    const min      = Math.floor(targetCal * 0.55);
    const max      = Math.ceil(targetCal  * 1.55);
    const excluded = excludeIds.map(id => Math.round(Number(id)));

    let recipe = await pickRecipe(excluded, min, max, diets, [], halal);
    if (!recipe) recipe = await pickRecipe(excluded, min, max, [], [], halal);
    if (!recipe) recipe = await pickRecipe(excluded, 0, 999999, [], [], halal);
    if (!recipe) return res.status(404).json({ error: 'No recipe found' });

    const scale  = recipe.calories > 0 ? targetCal / recipe.calories : 1;
    const scaled = Math.round(scale * 100) / 100;

    res.json({
      slot: slotName,
      targetCal,
      recipe: {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        sourceUrl: recipe.source_url,
        servings: recipe.servings,
        diets: recipe.diets ?? [],
      },
      scale: scaled,
      macros: {
        calories: Math.round(recipe.calories * scaled),
        protein:  Math.round(recipe.protein  * scaled * 10) / 10,
        carbs:    Math.round(recipe.carbs     * scaled * 10) / 10,
        fat:      Math.round(recipe.fat       * scaled * 10) / 10,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function pickRecipe(
  excludeIds: number[],
  minCal: number,
  maxCal: number,
  diets: string[],
  dishTypes: string[],
  halal: boolean
): Promise<any | null> {
  const conditions: string[] = [
    'calories BETWEEN $1 AND $2',
    'id != ALL($3::int[])',
  ];
  const safeExcluded = excludeIds.map(id => Math.round(Number(id)));
  const params: any[] = [Math.floor(minCal), Math.ceil(maxCal), safeExcluded];
  let idx = 4;

  if (halal) {
    conditions.push(`LOWER(title) NOT SIMILAR TO '${HARAM_PATTERN}'`);
  }
  if (diets.length > 0) {
    conditions.push(`diets && $${idx}::text[]`);
    params.push(diets);
    idx++;
  }
  if (dishTypes.length > 0) {
    conditions.push(`dish_types && $${idx}::text[]`);
    params.push(dishTypes);
    idx++;
  }

  const { rows } = await pool.query(
    `SELECT * FROM recipes WHERE ${conditions.join(' AND ')} ORDER BY RANDOM() LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

export default router;
