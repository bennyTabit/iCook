# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server
npx expo start

# Platform-specific
npx expo start --android
npx expo start --ios
npx expo start --web

# TypeScript check
npx tsc --noEmit
```

There is no lint script or test runner configured. TypeScript strict mode is enabled (`tsconfig.json` extends `expo/tsconfig.base` with `"strict": true`).

## Environment

Copy `.env.example` to `.env` and fill in:
```
EXPO_PUBLIC_GOOGLE_VISION_API_KEY=   # Required for OCR (Google Vision API)
```

## Architecture

**Stack**: Expo 54 / React Native 0.81 / React 19, TypeScript strict, SQLite (expo-sqlite), Zustand, React Navigation, i18next.

### Navigation

`RootNavigator` (native stack) wraps `TabNavigator` (bottom tabs). The 5-tab layout includes a floating "Add" button in the center. Detail/edit screens (`RecipeDetail`, `AddRecipe`, `OcrReview`, `ImportLink`, `EditRecipe`) are hidden stack screens nested inside the tab navigator.

### Data Layer

**SQLite** (`lib/db.ts`) is the source of truth on native. `lib/db.web.ts` provides an in-memory array with the same API for web. The schema has 12 tables; the main ones are `recipes`, `categories`, `tags`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`, and `recipe_images`. `initDB()` creates the schema and seeds 9 categories, 10 dietary tags, and 10 demo recipes.

`lib/search.ts` (and `lib/search.web.ts` for web) handle advanced filtering and sorting with GROUP_CONCAT for tags. Sorting options: newest, fastest, favorites, last_used.

**AsyncStorage** is used for drafts and user preferences (not recipe data).

### State Management

Three Zustand stores in `store/`:
- `recipeStore` — recipe list, filters, CRUD actions, favorites
- `shoppingStore` — shopping list with auto-categorization using Hebrew keyword matching
- `authStore` — auth stub (user always null; Firebase integration planned for v1.5)

### Recipe Ingestion Paths

1. **Manual** → `AddRecipeScreen` → `insertRecipe()` → SQLite
2. **OCR** → `ImagePicker` → Google Vision API (`lib/ocr.ts`) → `OcrReviewScreen` → `insertRecipe()`
3. **URL import** → `ImportLinkScreen` → `lib/importer.ts` (JSON-LD preferred, HTML scraping fallback) → `EditRecipeScreen` → `insertRecipe()`

Each recipe stores a `source_type` field: `manual | ocr | url | instagram | ai`.

### Bilingual / RTL

The app is Hebrew-primary with English support. `lib/i18n.ts` configures i18next with ~200 strings. Hebrew triggers RTL layout at boot via `expo-localization`. All user-facing strings must go through i18n — never hardcode display text. DB schema has `_he` / `_en` column pairs for titles and descriptions.

### Platform Abstraction

Web uses `.web.ts` file variants:
- `lib/db.web.ts` — in-memory array replacing SQLite
- `lib/search.web.ts` — in-memory filtering replacing SQL queries

When adding new `lib/` modules that use SQLite or native APIs, provide a `.web.ts` fallback.

### Key Patterns

- **Haptics**: Every user interaction should trigger `expo-haptics` feedback.
- **Keep-awake**: `expo-keep-awake` is activated only during active cooking (step-by-step mode in `RecipeDetailScreen`).
- **Swipe gestures**: `react-native-gesture-handler` powers swipe-to-delete and step navigation in `RecipeDetailScreen`.
- **Deep linking**: Recipe sharing via `lib/sharing.ts` using `Expo.Linking`.
- **Colors**: Primary coral `#FF6B6B`, secondary teal `#4ECDC4`, background warm beige `#FCFAF5` — defined in `constants/colors.ts`.
