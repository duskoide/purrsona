# Sega Design System — Component Rules

## Buttons (Signature Component)

**Shape:** Pill (`border-radius: 999px`), thick border (2-3px), solid offset block shadow.

### Required States

| State | Behavior |
|-------|----------|
| Default | Chunky pill, border, solid offset block |
| Hover | Button lifts or shadow grows |
| Focus-visible | High-contrast outline outside button and shadow |
| Active | Button compresses into block shadow |
| Disabled | Muted, readable, no press motion |
| Loading | Maintains width, pixel spinner |
| Error | Danger styling with explanatory text |

### Press Behavior (REQUIRED)

```css
.button-primary:hover {
  box-shadow: 8px 8px 0 #111827;
  transform: translate(-2px, -2px);
}
.button-primary:active {
  box-shadow: 2px 2px 0 #111827;
  transform: translate(4px, 4px);
}
```

### Variants

- **Primary:** Blue bg, white text — start, confirm, save, main action
- **Secondary:** Yellow bg, dark text — alternate action, settings, back
- **Ghost:** Transparent, blue border/text — inline, low-emphasis
- **Destructive:** Red bg, white text — reset, delete, irreversible

### Labels

Short, action-oriented. Use game language:
- `Start game`, `Continue`, `Save progress`, `Try again`, `Submit score`
- Avoid: `Submit`, `Click here`, `Go`

## Cards and Panels

**Shape:** `0px` radius, strong border (2px), white or brand-filled surface.

### Variants

| Variant | Usage |
|---------|-------|
| Standard | General content, menu groups |
| Featured | Rainbow trim shadow (blue → yellow → black) |
| Score | Blue bg, large score values, stats |
| Achievement | Yellow bg, rainbow trim, badges/unlocks |
| Locked | Muted, disabled appearance |

### Rules

- Featured cards need enough margin for trim shadows
- Interactive cards need button/link semantics
- No soft shadows, no glassmorphism, no glossy gradients

## Forms / Inputs

**Shape:** `0px` radius, 2px border, VT323 at 25px (body size).

### Rules

- Labels must always be visible (never placeholder-only)
- Strong borders, not subtle gray
- Focus-visible: yellow ring with offset
- Error messages linked to fields programmatically
- Required fields indicated accessibly

```css
.input:focus-visible {
  outline: 3px solid #FFDA14;
  outline-offset: 3px;
}
```

## Navigation

- Active state with fill, border, or marker (not just color)
- Blue for primary active, yellow for highlight
- Short labels, keyboard navigable
- Visible focus states

## Modals

- `0px` radius, strong border
- Rainbow trim for major dialogs
- Trap focus inside modal
- Close on Escape
- Return focus to trigger after close
- Destructive modals use danger language

## Status Badges

- Text labels required (not color-only)
- Solid fill with 2px border
- `role="status"` for screen readers

## Loading States

- Pixel spinner (3-dot blink animation)
- Preserve layout dimensions
- Respect `prefers-reduced-motion`
- Accessible loading text

## Empty States

- Framed card with dashed border
- Large heading explaining what's missing
- One clear action
- Arcade copy: "No scores yet." not "No data"
