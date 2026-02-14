# Frontend Coding Prompt: Alignment Chart Game

Build a mobile-first daily social game where players place friends on alignment charts. Think Wordle meets Wavelength.

## Design System

**Colors:**
- Surface: `#f4f4f6`
- Secondary (inactive): `#66666e`
- Black: `#000000`
- Splash/Brand (CTAs, highlights): `#F9874E`
- Accent (rare emphasis): `#627EF8`

**Typography:**
- Display/Headings: Outfit (SemiBold 600, Bold 700)
- Body/UI: DM Sans (Regular 400, Medium 500)
- Body text minimum 16px for mobile readability

**Spacing:** 4/8/16/24/32px scale
**Border Radius:** 12px (small), 16px (medium), 24px (large)

## Critical: Reactive Gamefeel

Every interaction needs **snap and bounce**:
- **Animations:** Use `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring effect (150-250ms)
- **On Press:** `scale(0.98)` for tactile mobile feedback
- **On Hover:** `translateY(-4px)` with enhanced shadow
- **Staggered reveals:** 100ms delay increments for card appearances

## Mobile-First Requirements

- Touch targets minimum 44×44px
- Primary actions in bottom 60% of screen
- Generous padding on all interactive elements
- Clean, uncluttered layouts with clear visual hierarchy

## Vibe

Friendly and modern. References: NYT Letterboxd game, SoundCloud. Warm orange energy balanced with clean minimalism. Playful without being childish.