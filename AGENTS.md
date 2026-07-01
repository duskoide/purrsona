# Agent Instructions — Purrsona Frontend

## Design System: Sega (TypeUI)

All frontend work MUST follow the Sega arcade design system. Before writing ANY frontend code:

1. Read `frontend/.agents/skills/typeui-fundamentals/SKILL.md`
2. Read `frontend/.agents/skills/typeui-fundamentals/accessibility.md`
3. Read `frontend/.agents/skills/typeui-fundamentals/spacing-principles.md`
4. Read `frontend/.agents/skills/typeui-fundamentals/typography-principles.md`
5. Read `frontend/.agents/skills/typeui-fundamentals/ui-principles.md`
6. Read `frontend/.agents/skills/typeui-fundamentals/ux-principles.md`
7. Read `frontend/.agents/skills/typeui-design-system/tokens.md`
8. Read `frontend/.agents/skills/typeui-design-system/components.md`
9. Read `frontend/.agents/skills/typeui-design-system/accessibility.md`

## Non-Negotiable Rules

- **VT323 pixel font** for all UI text
- **0px corners** on panels, cards, modals, inputs, menus
- **999px pill** for buttons only (the signature exception)
- **Hard offset block shadows** — no blur, no soft shadows
- **Rainbow trim** (blue → yellow → black) on featured cards
- **Button press behavior** — hover lifts, active compresses (REQUIRED)
- **Yellow focus ring** on blue/dark backgrounds
- **Blue focus ring** on light/white backgrounds
- **prefers-reduced-motion** fallbacks for all animations
- **Text labels** on all status indicators (not color-only)
- **Focus-visible** on every interactive element

## Token Source of Truth

All tokens live in `frontend/src/styles/tokens.ts` and `frontend/tailwind.config.ts`. Do NOT hardcode colors, spacing, or shadows — use the tokens.

## Component Library

Existing components in `frontend/src/components/`:
- Button (primary/secondary/ghost/destructive, loading/locked states)
- Card (standard/featured/score/achievement/locked variants)
- TextInput (error/helper states, ARIA attributes)
- StatusBadge (explicit text labels)
- NavigationBar (active state with fill)
- Modal (focus trap, destructive variant)
- PixelSpinner (loading animation)
- EmptyState (arcade copy patterns)
- ProtectedRoute (auth guard)

When creating new components, follow the patterns in existing components. Do NOT introduce soft shadows, rounded corners on panels, or generic SaaS styling.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#e8731a` | Orange — actions, selected, active |
| Secondary | `#ef8c38` | Amber — highlights, rewards, focus |
| Text | `#272220` | Body text, outlines, offset blocks |
| Surface | `#fffbf5` | Cards, panels, forms |

Semantic: success `#16A34A`, warning `#D97706`, danger `#DC2626`.

## Anti-Patterns (DO NOT)

- Soft drop shadows or blurred elevation
- Rounded corners on cards/panels (except pill buttons)
- Glassmorphism, glossy gradients, subtle pastels
- Placeholder-only form labels
- Color-only state indicators
- Vague labels: `Submit`, `Click here`, `Go`
- Generic SaaS styling with pixel font applied on top
