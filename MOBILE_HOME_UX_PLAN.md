# Mobile Home UX Plan (Short)

## Goal
Make `/home` the mobile-first app home (action-first), while keeping `/learn` focused on flashcards.

## Phase 1 - Done now
- Add dedicated app home flow:
  - `/home` shows the "Learn Home" block
  - `/learn` stays focused on flashcards
  - Continue learning CTA
  - Daily plan progress (today taps)
  - Learning progress (completed categories)
  - Quick actions: Challenge + Stats
- Route logo/menu to `/home` first.

## Phase 2 - Next (after your benchmark review)
- Tune information hierarchy based on 2-3 reference apps (Quizlet, GeoGuessr, etc.).
- Decide final top metrics (streak, minutes, words, stars).
- Add bottom mobile quick-nav behavior (if needed) without duplicating existing drawer UX.

## Phase 3 - Motion polish
- Add subtle motion only where useful:
  - card reveal stagger on first load
  - progress bar count-up animation
  - optional small Lottie in Home hero (lightweight JSON, no performance hit)
- Keep animations skippable and respectful of reduced motion settings.

## Acceptance checklist
- First screen answers: "What should I do now?"
- Main CTA visible without scrolling on common mobile heights.
- User reaches first learning interaction in <= 2 taps.
- No regression in sidebar/category/cards behavior.
