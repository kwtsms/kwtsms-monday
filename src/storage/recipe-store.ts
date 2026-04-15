import { RecipeBinding } from '../types/recipe';
import { kvGet, kvSet, kvDelete, kvIndexAdd, kvIndexRemove, kvList } from './index';

const K = (a: string, id: string) => `recipe:${a}:${id}`;
const P = (a: string) => `recipe:${a}`;

export async function getRecipe(a: string, id: string): Promise<RecipeBinding | null> {
  return kvGet<RecipeBinding>(K(a, id));
}
export async function saveRecipe(a: string, r: RecipeBinding): Promise<void> {
  await kvSet(K(a, r.recipeInstanceId), r);
  await kvIndexAdd(P(a), r.recipeInstanceId);
}
export async function deleteRecipe(a: string, id: string): Promise<void> {
  await kvDelete(K(a, id));
  await kvIndexRemove(P(a), id);
}
export async function listRecipes(a: string): Promise<RecipeBinding[]> {
  const keys = await kvList(P(a));
  const out: RecipeBinding[] = [];
  for (const k of keys) {
    const r = await kvGet<RecipeBinding>(k);
    if (r) out.push(r);
  }
  return out;
}
