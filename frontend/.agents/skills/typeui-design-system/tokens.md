# Sega Design System — Design Tokens

## Color Palette

| Token | Value | Purpose |
|-------|-------|---------|
| Primary | `#4502FF` | Electric blue — primary actions, selected states, hero panels |
| Secondary | `#FFDA14` | Bright yellow — highlights, secondary actions, reward accents |
| Success | `#16A34A` | Completed, unlocked, valid states |
| Warning | `#D97706` | Caution, pending, incomplete |
| Danger | `#DC2626` | Errors, destructive, failed validation |
| Surface | `#FFFFFF` | Cards, panels, menus, inputs |
| Text | `#111827` | Body text, labels, content |

### Semantic Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `arcade-blue` | `#4502FF` | Brand action, selected state |
| `arcade-yellow` | `#FFDA14` | Highlight blocks, focus accents |
| `arcade-ink` | `#111827` | Text, outlines, offset blocks |
| `arcade-paper` | `#FFFFFF` | Cards, panels, forms |
| `arcade-shadow` | `#111827` | Hard offset blocks |
| `focus-ring` | `#FFDA14` or `#4502FF` | Keyboard focus (yellow on blue, blue on white) |

### Color Rules

1. Blue leads the game interface — primary actions, selected states, active panels
2. Yellow creates arcade energy — highlights, rewards, focus accents, supporting CTAs
3. White keeps play readable — content-heavy panels use surface
4. Dark ink anchors the system — outlines, text, offset blocks
5. Semantic colors stay semantic — success/warning/danger for real state only

## Typography

**Font:** VT323 (pixel font) for all UI. JetBrains Mono for code/technical only.

### Scale (odd-number, 1.5x applied)

| Size | Usage |
|------|-------|
| 19px | Tiny metadata, compact labels, small badges |
| 22px | Secondary UI text, menu details |
| 25px | Default body, form inputs, standard buttons |
| 31px | Card headings, menu group labels |
| 40px | Page section headings, modal titles |
| 52px | Hero headings, title screens, large scores |

### Rules

- Keep labels short
- Avoid long paragraphs at small sizes
- Use generous line height for body copy
- Avoid all-caps long sentences
- Test readability on high-density and low-density screens

## Spacing

4px base scale: 4, 8, 12, 16, 24, 32px.

Components need enough room for offset blocks, rainbow trim, and physical press effects.

## Border Radius

- **Panels:** `0px` (hard-edged, the default)
- **Buttons:** `999px` (pill shape, the signature exception)

## Shadows

Hard offset blocks, NO blur:

```css
--press-shadow-sm: 3px 3px 0 #111827;
--press-shadow-md: 6px 6px 0 #111827;
--press-shadow-lg: 8px 8px 0 #111827;
```

Rainbow trim for featured cards:

```css
box-shadow:
  4px 4px 0 #4502FF,
  8px 8px 0 #FFDA14,
  12px 12px 0 #111827;
```
