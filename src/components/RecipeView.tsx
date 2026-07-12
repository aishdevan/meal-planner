"use client";

import {
  AirVent,
  Baby,
  BookOpen,
  Clock,
  Dumbbell,
  Flame,
  Leaf,
  Nut,
  Snowflake,
  Sparkles,
} from "lucide-react";
import type { Recipe } from "@/lib/types";

const APPLIANCE_LABELS: Record<string, string> = {
  instant_pot: "instant pot",
  air_fryer: "air fryer",
  oven: "oven",
  blender: "blender",
  stovetop: "stovetop",
};

export function RecipeBadges({ recipe }: { recipe: Recipe }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="chip bg-accent-soft text-accent-deep">
        <Clock size={11} /> {recipe.totalTimeMinutes} min
      </span>
      {recipe.nutrition && (
        <span className="chip bg-accent-soft text-accent-deep">
          <Flame size={11} /> {recipe.nutrition.calories} kcal
        </span>
      )}
      <span className="chip bg-accent-soft text-accent-deep">
        <Dumbbell size={11} /> {recipe.proteinGBase}
        {recipe.proteinGWithAddon ? `–${recipe.proteinGWithAddon}` : ""}g protein
      </span>
      {recipe.isVegetarianBase && (
        <span className="chip bg-good-soft text-good">
          <Leaf size={11} /> veg base
        </span>
      )}
      {recipe.isNutFree && (
        <span className="chip bg-good-soft text-good">
          <Nut size={11} /> nut-free
        </span>
      )}
      {recipe.noReheatOk && (
        <span className="chip bg-good-soft text-good">
          <Snowflake size={11} /> no-reheat ok
        </span>
      )}
      {recipe.kidFriendly && (
        <span className="chip bg-good-soft text-good">
          <Baby size={11} /> kid-friendly
        </span>
      )}
      {recipe.appliances.map((a) => (
        <span key={a} className="chip bg-terra-soft text-terra">
          <AirVent size={11} /> {APPLIANCE_LABELS[a] ?? a}
        </span>
      ))}
    </div>
  );
}

export function RecipeView({
  recipe,
  includeAddon = true,
}: {
  recipe: Recipe;
  includeAddon?: boolean;
}) {
  const baseIngredients = recipe.ingredients.filter((i) => !i.for_addon);
  const addonIngredients = recipe.ingredients.filter((i) => i.for_addon);
  const addon = recipe.nonvegAddon;
  const addonNutrition = addon?.nutrition;

  return (
    <div className="space-y-5">
      {recipe.description && (
        <p className="text-sm leading-relaxed text-soft">{recipe.description}</p>
      )}
      <RecipeBadges recipe={recipe} />

      {recipe.sourceName && (
        <p className="flex items-start gap-1.5 text-xs text-faint">
          <BookOpen size={13} className="mt-0.5 shrink-0" />
          <span>
            {recipe.sourceName}
            {recipe.source === "ai" && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-accent-deep">
                <Sparkles size={11} /> AI-adapted, review before trusting
              </span>
            )}
          </span>
        </p>
      )}

      {recipe.nutrition && (
        <section className="card p-3.5">
          <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-soft">
            Nutrition{" "}
            <span className="font-normal normal-case tracking-normal text-faint">
              per serving, estimates
            </span>
          </h3>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {(
              [
                ["kcal", recipe.nutrition.calories, addonNutrition?.calories],
                ["protein", recipe.nutrition.protein_g, addonNutrition?.protein_g, "g"],
                ["carbs", recipe.nutrition.carbs_g, addonNutrition?.carbs_g, "g"],
                ["fat", recipe.nutrition.fat_g, addonNutrition?.fat_g, "g"],
                ["fiber", recipe.nutrition.fiber_g, addonNutrition?.fiber_g, "g"],
              ] as const
            ).map(([label, base, addonVal, unit]) => (
              <div
                key={label}
                className="rounded-2xl border border-line bg-surface/60 py-2"
              >
                <div className="text-sm font-bold">
                  {base}
                  {unit ?? ""}
                </div>
                {includeAddon && addonVal != null && (
                  <div className="text-[10px] font-medium text-terra">
                    +{addonVal}
                    {unit ?? ""}
                  </div>
                )}
                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-faint">
                  {label}
                </div>
              </div>
            ))}
          </div>
          {includeAddon && addonNutrition && (
            <p className="mt-2 text-[10px] text-terra">
              {`+ values are the "${addon?.name}" addon (Rahul & Elai only)`}
            </p>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-soft">
          Ingredients
        </h3>
        <ul className="space-y-1.5 text-sm">
          {baseIngredients.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>{i.name}</span>
              <span className="shrink-0 text-faint">{i.qty_text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-soft">
          Steps
        </h3>
        <ol className="space-y-2.5 text-sm leading-relaxed">
          {recipe.steps.map((s, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-deep">
                {idx + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {addon && includeAddon && (
        <section className="rounded-3xl border border-terra/25 bg-terra-soft p-4">
          <h3 className="mb-2 text-sm font-semibold text-terra">
            For Rahul &amp; Elai: {addon.name}{" "}
            <span className="font-normal opacity-75">
              (+{addon.protein_g}g protein)
            </span>
          </h3>
          {addonIngredients.length > 0 && (
            <ul className="mb-2 space-y-1 text-sm">
              {addonIngredients.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>{i.name}</span>
                  <span className="shrink-0 text-faint">{i.qty_text}</span>
                </li>
              ))}
            </ul>
          )}
          <ol className="space-y-1.5 text-sm">
            {addon.steps.map((s, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="font-bold text-terra">{idx + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
