import * as Linking from 'expo-linking';
import { Share } from 'react-native';
import type { Recipe } from './db';

export function generateShareUrl(recipeId: number): string {
  return Linking.createURL(`/recipe/${recipeId}`);
}

export async function shareRecipe(recipe: Recipe): Promise<void> {
  const url = generateShareUrl(recipe.id!);
  const title = recipe.title_he || recipe.title_en || '';
  await Share.share({
    title,
    message: `${title} — ${url}`,
    url,
  });
}

export function setupDeepLinkHandler(navigate: (screen: string, params: any) => void) {
  Linking.getInitialURL().then(url => { if (url) handleUrl(url, navigate); });
  const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url, navigate));
  return () => sub.remove();
}

function handleUrl(url: string, navigate: (screen: string, params: any) => void) {
  const { path } = Linking.parse(url);
  if (!path) return;
  const match = path.match(/^recipe\/(\d+)$/);
  if (match) navigate('RecipeDetail', { id: parseInt(match[1]) });
}

export function exportRecipeJson(recipe: Recipe): string {
  return JSON.stringify({ ...recipe, exportedBy: 'iCook', version: '1.0' }, null, 2);
}
