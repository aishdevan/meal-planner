/**
 * Seed pantry: the staples this family keeps at home.
 * pantry_key values match the keys used in src/data/seed-recipes.ts exactly,
 * so staple ingredients in recipes resolve against the pantry.
 */
export const seedPantry: {
  name: string;
  pantry_key: string;
  store: "whole_foods" | "farmers_market" | "indian_store";
  category: string;
  staple: boolean;
}[] = [
  // ---- Oils & fats ----
  { name: "Extra-virgin olive oil", pantry_key: "olive_oil", store: "whole_foods", category: "pantry", staple: true },
  { name: "Vegetable oil", pantry_key: "vegetable_oil", store: "whole_foods", category: "pantry", staple: true },
  { name: "Toasted sesame oil", pantry_key: "sesame_oil", store: "whole_foods", category: "pantry", staple: true },
  { name: "Ghee", pantry_key: "ghee", store: "indian_store", category: "pantry", staple: true },

  // ---- Salt & everyday spices ----
  { name: "Salt", pantry_key: "salt", store: "whole_foods", category: "spices", staple: true },
  { name: "Black pepper", pantry_key: "black_pepper", store: "whole_foods", category: "spices", staple: true },
  { name: "Ground cinnamon", pantry_key: "cinnamon", store: "whole_foods", category: "spices", staple: true },
  { name: "Smoked paprika", pantry_key: "smoked_paprika", store: "whole_foods", category: "spices", staple: true },
  { name: "Dried oregano", pantry_key: "dried_oregano", store: "whole_foods", category: "spices", staple: true },
  { name: "Italian seasoning", pantry_key: "italian_seasoning", store: "whole_foods", category: "spices", staple: true },
  { name: "Red pepper flakes", pantry_key: "red_pepper_flakes", store: "whole_foods", category: "spices", staple: true },

  // ---- Indian spices ----
  { name: "Turmeric powder", pantry_key: "turmeric", store: "indian_store", category: "spices", staple: true },
  { name: "Kashmiri red chili powder", pantry_key: "red_chili_powder", store: "indian_store", category: "spices", staple: true },
  { name: "Garam masala", pantry_key: "garam_masala", store: "indian_store", category: "spices", staple: true },
  { name: "Cumin seeds", pantry_key: "cumin_seeds", store: "indian_store", category: "spices", staple: true },
  { name: "Ground cumin", pantry_key: "cumin_powder", store: "indian_store", category: "spices", staple: true },
  { name: "Coriander powder", pantry_key: "coriander_powder", store: "indian_store", category: "spices", staple: true },
  { name: "Black mustard seeds", pantry_key: "mustard_seeds", store: "indian_store", category: "spices", staple: true },
  { name: "Chaat masala", pantry_key: "chaat_masala", store: "indian_store", category: "spices", staple: true },
  { name: "Kasuri methi (dried fenugreek leaves)", pantry_key: "kasuri_methi", store: "indian_store", category: "spices", staple: true },
  { name: "Hing (asafoetida)", pantry_key: "hing", store: "indian_store", category: "spices", staple: true },
  { name: "Tandoori masala", pantry_key: "tandoori_masala", store: "indian_store", category: "spices", staple: true },

  // ---- Rice, flours & grains ----
  { name: "Basmati rice", pantry_key: "basmati_rice", store: "indian_store", category: "pantry", staple: true },
  { name: "Atta (whole wheat flour)", pantry_key: "atta", store: "indian_store", category: "pantry", staple: true },
  { name: "All-purpose flour", pantry_key: "all_purpose_flour", store: "whole_foods", category: "pantry", staple: true },
  { name: "Besan (chickpea flour)", pantry_key: "besan", store: "indian_store", category: "pantry", staple: true },
  { name: "Rolled oats", pantry_key: "rolled_oats", store: "whole_foods", category: "pantry", staple: true },
  { name: "Poha (flattened rice, thick)", pantry_key: "poha", store: "indian_store", category: "pantry", staple: true },
  { name: "Quinoa", pantry_key: "quinoa", store: "whole_foods", category: "pantry", staple: true },

  // ---- Dals & legumes ----
  { name: "Toor dal", pantry_key: "toor_dal", store: "indian_store", category: "pantry", staple: true },
  { name: "Moong dal (split yellow)", pantry_key: "moong_dal", store: "indian_store", category: "pantry", staple: true },
  { name: "Chana dal", pantry_key: "chana_dal", store: "indian_store", category: "pantry", staple: true },
  { name: "Whole black urad dal", pantry_key: "black_urad_dal", store: "indian_store", category: "pantry", staple: true },
  { name: "Rajma (dried kidney beans)", pantry_key: "rajma", store: "indian_store", category: "pantry", staple: true },
  { name: "Canned chickpeas", pantry_key: "chickpeas", store: "whole_foods", category: "pantry", staple: true },
  { name: "Canned black beans", pantry_key: "black_beans", store: "whole_foods", category: "pantry", staple: true },

  // ---- Pasta ----
  { name: "Penne", pantry_key: "penne", store: "whole_foods", category: "pantry", staple: true },
  { name: "Fusilli", pantry_key: "fusilli", store: "whole_foods", category: "pantry", staple: true },
  { name: "Elbow macaroni", pantry_key: "macaroni", store: "whole_foods", category: "pantry", staple: true },
  { name: "Spaghetti", pantry_key: "spaghetti", store: "whole_foods", category: "pantry", staple: true },

  // ---- Canned & jarred ----
  { name: "Canned crushed tomatoes", pantry_key: "canned_tomatoes", store: "whole_foods", category: "pantry", staple: true },
  { name: "Tomato paste", pantry_key: "tomato_paste", store: "whole_foods", category: "pantry", staple: true },
  { name: "Coconut milk", pantry_key: "coconut_milk", store: "whole_foods", category: "pantry", staple: true },
  { name: "Vegetable broth", pantry_key: "vegetable_broth", store: "whole_foods", category: "pantry", staple: true },
  { name: "Marinara / pizza sauce", pantry_key: "marinara_sauce", store: "whole_foods", category: "pantry", staple: true },
  { name: "Mild salsa", pantry_key: "salsa", store: "whole_foods", category: "pantry", staple: true },
  { name: "Kalamata olives", pantry_key: "kalamata_olives", store: "whole_foods", category: "pantry", staple: true },

  // ---- Condiments & sweeteners ----
  { name: "Low-sodium soy sauce", pantry_key: "soy_sauce", store: "whole_foods", category: "pantry", staple: true },
  { name: "Rice vinegar", pantry_key: "rice_vinegar", store: "whole_foods", category: "pantry", staple: true },
  { name: "Balsamic vinegar", pantry_key: "balsamic_vinegar", store: "whole_foods", category: "pantry", staple: true },
  { name: "Honey", pantry_key: "honey", store: "whole_foods", category: "pantry", staple: true },
  { name: "Mayonnaise", pantry_key: "mayonnaise", store: "whole_foods", category: "pantry", staple: true },
  { name: "Dijon mustard", pantry_key: "dijon_mustard", store: "whole_foods", category: "pantry", staple: true },
  { name: "Sunflower seed butter (SunButter)", pantry_key: "sunbutter", store: "whole_foods", category: "pantry", staple: true },
  { name: "Strawberry jam", pantry_key: "jam", store: "whole_foods", category: "pantry", staple: true },
  { name: "Sugar", pantry_key: "sugar", store: "whole_foods", category: "pantry", staple: true },

  // ---- Baking ----
  { name: "Baking powder", pantry_key: "baking_powder", store: "whole_foods", category: "pantry", staple: true },
  { name: "Active dry yeast", pantry_key: "active_dry_yeast", store: "whole_foods", category: "pantry", staple: true },
  { name: "Cornstarch", pantry_key: "cornstarch", store: "whole_foods", category: "pantry", staple: true },

  // ---- Seeds, nuts & dried fruit ----
  { name: "Chia seeds", pantry_key: "chia_seeds", store: "whole_foods", category: "pantry", staple: true },
  { name: "Pumpkin seeds (pepitas)", pantry_key: "pumpkin_seeds", store: "whole_foods", category: "pantry", staple: true },
  { name: "Sunflower seeds", pantry_key: "sunflower_seeds", store: "whole_foods", category: "pantry", staple: true },
  { name: "Medjool dates", pantry_key: "dates", store: "whole_foods", category: "pantry", staple: true },
  { name: "Sliced almonds", pantry_key: "almonds", store: "whole_foods", category: "pantry", staple: true },
  { name: "Cashews", pantry_key: "cashews", store: "indian_store", category: "pantry", staple: true },

  // ---- Snacks & drinks ----
  { name: "Whole grain crackers", pantry_key: "whole_grain_crackers", store: "whole_foods", category: "pantry", staple: true },
  { name: "Black tea (chai) bags", pantry_key: "tea", store: "indian_store", category: "pantry", staple: true },
  { name: "Ground coffee", pantry_key: "coffee", store: "whole_foods", category: "pantry", staple: true },
];
