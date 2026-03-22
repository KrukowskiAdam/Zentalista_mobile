# MellowCards AI Coding Instructions

## Communication Before Changes
- Before making any code changes, clearly and simply explain where the problem is and what you are going to fix.
- After making changes, always point to the exact file locations (file + line range links) where edits were applied.

## Project Overview
MellowCards is a Firebase-hosted Spanish vocabulary learning app with a freemium model. Users learn through flashcards with progress tracking and premium tiers unlocked through mobile in-app purchases (RevenueCat).

## Architecture & Key Components

### Frontend-Backend Split
- **Frontend**: Static files in `/public/` (TailwindCSS + DaisyUI, vanilla JS modules)
- **Backend**: Firebase Functions with Express.js serving EJS templates from `/functions/views/`
- **Data**: JSON vocabulary files (`es_en_01.json` to `es_en_09.json`) hosted statically
- **State**: Client-side localStorage for user progress, Firebase Firestore for user accounts

### Core Application Flow
1. **Authentication**: Firebase Auth with email/password in `/public/scripts/auth.js`
2. **Premium Status**: Checked via Firestore document, cached in `window.isPremiumUser`
3. **Data Loading**: Parallel fetches of JSON files (free + 8 premium sources) in `DataService.fetchAllCards()`
4. **Progress Tracking**: Button states saved to localStorage with format `word-{globalIndex}`
5. **Statistics**: Complex category completion tracking with cooldown timers in `/functions/views/stats.ejs`

### Critical State Management Patterns

#### Button State Structure
```javascript
AppState.buttonStates['word-123'] = {
  count: 0-20,           // Click progress (locked at 20)
  locked: boolean,       // Completion status
  category: string,      // e.g., "Basic Verbs"
  source: string,        // 'free', 'premium1'-'premium8'
  clicks: [...],         // Timestamp array for statistics
  lastClicked: timestamp // Throttling mechanism
}
```

#### Category Completion Logic
- Categories complete when ALL words in category are locked
- 30-second cooldown before restart button appears
- Progress tracked in localStorage with keys like `${source}::${category}`
- Reset preserves completion dates but clears progress state

## Development Workflows

### Local Development
```bash
# Start Firebase emulators
firebase emulators:start

# Watch TailwindCSS changes
npx tailwindcss -i ./src/input.css -o ./public/css/style.css --watch
```

### Deployment
```bash
# Deploy functions only
firebase deploy --only functions

# View function logs
firebase functions:log --project=costam-3f612
```

### Project Structure Patterns
- **Routes**: Defined in `/functions/index.js` with EJS template mapping
- **Styles**: TailwindCSS with custom DaisyUI theme in `tailwind.config.js`
- **Scripts**: ES6 modules with explicit imports, exported to window object for EJS access
- **Views**: EJS templates with shared partials (`head.ejs`, `menu.ejs`, `modals.ejs`)

## Integration Points

### Mobile IAP Flow (RevenueCat)
1. Frontend initializes purchases plugin via `iapService.initialize()`
2. User purchases via package buttons or native paywall
3. `iap:entitlementChanged` event updates premium state and syncs Firestore
4. Restore path rehydrates entitlement after reinstall/login

### Firebase Configuration
- **Project ID**: costam-3f612
- **Functions**: Node.js 20, ES modules (`"type": "module"`)
- **Mobile IAP**: RevenueCat SDK keys are configured in client IAP config

### Data Loading Strategy
- Free content: `es_en_01.json` (always accessible)
- Premium content: `es_en_02.json` through `es_en_09.json` (8 premium tiers)
- Categories marked premium in `AppState.premiumCategories` Set
- Word accessibility checked via `DataService.isWordAccessible()`

## Key Conventions

### Global State Access
```javascript
window.AppState     // Button states, progress tracking
window.DataService  // Vocabulary data, categories
window.UIService    // Rendering, DOM manipulation
window.isPremiumUser // Premium status (boolean)
```

### Error Handling Patterns
- Extensive console logging with 🔍 prefixes for debugging
- Try-catch blocks around localStorage operations
- Graceful degradation for missing data/network issues

### Progress Bar Implementation
- Visual progress via CSS width percentage on `.bg-button-completed` spans
- Right-click resets individual word progress
- Throttling prevents rapid clicking (300ms per button)

## Common Tasks

### Adding New Premium Tier
1. Add JSON file to `/public/` (follow `es_en_XX.json` pattern)
2. Update `CONFIG.jsonUrls` in `/public/scripts/cards.js`
3. Add to premium sources arrays in `DataService.fetchAllCards()`

### Modifying Statistics Display
- Core logic in `/functions/views/stats.ejs` `renderStats()` function
- Category progress calculated from `AppState.buttonStates`
- Completion tracking uses complex localStorage scheme with timestamps

### UI Component Patterns
- Use `UIService.createElement()` for consistent DOM creation
- Premium content shows lock icons via `addLockIcon()`
- Banner notifications via `renderPremiumBanner()`

Remember: State persistence relies heavily on localStorage keys matching exactly. Always test progress tracking across page reloads.
