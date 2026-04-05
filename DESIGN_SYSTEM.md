# Padel Lobsters Design System

## 🎨 Color Palette

The new design system uses a carefully curated palette that feels premium, modern, and on-brand.

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **lob-teal** | `#3D7A8A` | Primary brand color, backgrounds, text |
| **lob-teal-dark** | `#2A5A68` | Header gradient (dark end), darkening hover states |
| **lob-teal-light** | `#EAF4F7` | Soft backgrounds, inactive tabs, supporting surfaces |

### Action Colors

| Name | Hex | Usage |
|------|-----|-------|
| **lob-coral** | `#D94F2B` | Primary CTAs, active states, alerts |
| **lob-coral-light** | `#FAEAE5` | Soft coral backgrounds, alert banners |

### Supporting Colors

| Name | Hex | Usage |
|------|-----|-------|
| **lob-amber** | `#E8A030` | Secondary actions, accents, progress indicators |
| **lob-cream** | `#FAF3E4` | Page background, tied to logo |
| **lob-dark** | `#1C2B30` | Primary text color |
| **lob-muted** | `#6B8A92` | Secondary text, disabled states |

---

## 🎯 Design Decisions

### Color Strategy

**Teal Header** — Replaces flat teal with a deeper, richer gradient (teal → teal-dark) that feels premium and sophisticated. The depth makes white content below appear to breathe.

**Cream Background** — Warm cream (`#FAF3E4`) pulled straight from the Padel Lobsters logo. It's warmer than pure white, ties the brand together, and reduces eye strain.

**Coral = Action** — The active tab, payment alerts, CTAs, and key interactions use lobster orange-red (`#D94F2B`). Consistent, on-brand, and immediately draws attention to actionable elements.

**Progress Bars** — Visual progress indicators (e.g., payment collection ratio) use a subtle gradient fill to show status at a glance without needing to read numbers.

**Pill Tabs** — Modern, rounded-full buttons instead of rectangular tabs. Lighter visual weight, more contemporary feel. Active state uses coral, inactive uses soft teal-light.

---

## 🧩 Component Styles

### Buttons

All buttons use `rounded-full` for a modern, pill-shaped appearance:

- **Primary** (`.btn-primary`): Coral background, white text, shadow
- **Secondary** (`.btn-secondary`): White background, teal border, teal text
- **Danger** (`.btn-danger`): Red background, white text

### Cards

- Subtle multi-layer shadow for depth
- Thin border with transparency for definition
- Rounded corners (`rounded-2xl`)

### Inputs

- Inset shadow for tactile feel
- Teal ring on focus
- Placeholder text in muted gray

### Pill Tabs

Used for filtering, mode toggles, and selection:

```css
.tab-pill-active    /* coral bg, white text, shadow */
.tab-pill-inactive  /* teal-light bg, muted text */
```

### Badges

- **Paid**: Green background, green text
- **Unpaid**: Coral-light background, coral text
- **Pending**: Yellow background, yellow text
- **Waitlist**: Amber background, amber text

### Progress Bars

Gradient fill (teal → amber) for visual interest:

```html
<div className="progress-bar">
  <div className="progress-fill" style={{width: '75%'}} />
</div>
```

---

## 🛠️ Tailwind Configuration

New colors are defined in `tailwind.config.js` under the `lob` namespace:

```javascript
colors: {
  lob: {
    'teal':        '#3D7A8A',
    'teal-dark':   '#2A5A68',
    'teal-light':  '#EAF4F7',
    'coral':       '#D94F2B',
    'coral-light': '#FAEAE5',
    'amber':       '#E8A030',
    'cream':       '#FAF3E4',
    'dark':        '#1C2B30',
    'muted':       '#6B8A92',
  }
}
```

Old `lobster-*` names are maintained for backward compatibility but should be gradually migrated to `lob-*`.

---

## 📐 Spacing & Sizing

- **Padding**: Base unit of 4px (Tailwind default)
- **Border Radius**:
  - `rounded-full` for pill buttons and badges
  - `rounded-2xl` for cards and containers
  - `rounded-xl` for inputs
- **Shadows**: Multi-layer shadows for depth (inset + drop)

---

## 🎬 Motion & Transitions

- Active scales: `active:scale-95` on interactive elements
- Transitions: `transition-all duration-150` for button feedback
- Progress animations: `duration-500` for smoother bar fills

---

## ✅ Best Practices

1. **Use coral for action**: Buttons, alerts, active tabs, and interactive feedback
2. **Teal for structure**: Headers, primary sections, brand color
3. **Cream for breathing room**: Page background, spacious layouts
4. **Pill buttons over rectangles**: Modern, friendly, consistent
5. **Progress bars for data**: Show ratios/completion visually before reading numbers

---

## 🚀 Implementation

To use the new colors in a component:

```jsx
// Primary button (coral)
<button className="btn-primary">Pay Now</button>

// Inactive tab (teal-light)
<button className="bg-lob-teal-light text-lob-muted">Tab</button>

// Active tab (coral)
<button className="bg-lob-coral text-white">Tab</button>

// Progress bar
<div className="progress-bar">
  <div className="progress-fill" style={{width: '60%'}} />
</div>
```

---

## 📚 References

- **Color Hex Reference**: See table above
- **Tailwind Classes**: `bg-lob-*, text-lob-*, border-lob-*`
- **Component Files**: See `.card`, `.btn-primary` in `src/index.css`
