# Sega Design System — Accessibility

Baseline: **WCAG 2.2 AA**.

## Focus States

- `3px` or thicker outline
- Yellow focus ring on blue/dark components
- Blue focus ring on yellow/white components
- Offset outline outside button and shadow
- Focus-visible on EVERY interactive element

## Keyboard

- Buttons: Enter and Space
- Links: Enter
- Menus: Tab, arrow keys where appropriate
- Modals: trap focus, return focus after close
- Selection grids: keyboard movement

## Motion

- Respect `prefers-reduced-motion`
- No rapid flashing
- Press states preserved as static visual changes in reduced-motion mode
- Motion not the only feedback mechanism

## Typography Readability

- Body text minimum 25px when possible
- 19px/22px only for short labels or metadata
- Keep paragraphs short
- Test on mobile and desktop

## Contrast

- Text on blue: test contrast
- Text on yellow: usually dark
- Disabled states: understandable
- Rainbow trim: must not reduce text readability

## Color

- Never the only indicator of state
- Semantic colors for real state feedback only
- Success/warning/danger stay semantic
