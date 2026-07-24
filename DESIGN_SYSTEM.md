# Hungr Design System

> Living document for the Next.js rebuild. Update this when adding new patterns, components, or changing tokens.

---

## 1. Typography

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **Body** | Poppins | 300, 400, 500, 600, 700 | All body text, forms, labels, paragraphs |
| **Heading** | Figtree | 400–900 | `h1`–`h6`, page titles, card headers, navigation labels |

Applied via CSS variables:
```css
--font-body: var(--font-body);      /* Poppins */
--font-heading: var(--font-heading); /* Figtree */
```

Tailwind classes:
- Body text uses default (no class needed — set on `html`)
- Headings automatically get Figtree via `h1–h6` selector in globals.css
- Explicit: `font-heading`, `font-body`

---

## 2. Color Tokens

We use Tailwind v4 with CSS variables + shadcn/ui tokens. All colors are `oklch()` in `globals.css`.

| Token | Usage |
|-------|-------|
| `background` | Page bg |
| `foreground` | Primary text |
| `primary` | CTAs, active states, links |
| `primary-foreground` | Text on primary buttons |
| `secondary` | Secondary buttons, badges |
| `muted` | Subtle backgrounds, hover states |
| `muted-foreground` | Secondary text, hints, placeholders |
| `destructive` | Errors, delete actions |
| `border` | Dividers, input borders |
| `input` | Form input backgrounds |
| `ring` | Focus rings |

**Dark mode:** Toggle via `.dark` class on `<html>`. All tokens have dark variants.

---

## 3. Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.625rem` (10px) | Default corner radius |
| `rounded-lg` | `var(--radius)` | Cards, dialogs, buttons |
| `rounded-md` | `calc(var(--radius) - 2px)` | Smaller elements |
| `rounded-xl` | `calc(var(--radius) * 1.4)` | Large cards, modals |

Dashboard shell uses a **260px fixed sidebar** + fluid main content.

---

## 4. Component Primitives

All in `components/ui/`. Install new ones via:
```bash
npx shadcn@latest add <component> --yes --overwrite
```

**Available primitives:**
`autocomplete`, `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `link-button`, `progress`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`

### Button usage
```tsx
import { Button } from "@/components/ui/button";

<Button variant="default" size="default">Save</Button>
<Button variant="outline">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Dismiss</Button>
<Button variant="link">Learn more</Button>
```

`Button` supports `asChild` through Radix `Slot`. Prefer `<Button asChild><Link href="...">...</Link></Button>` or the dedicated `LinkButton` helper for navigation styled as a button.

---

## 5. Reusable Patterns

### FormField (`components/forms/FormField.tsx`)
Standard form input with label, error, and hint.
```tsx
<FormField
  label="Email"
  name="email"
  type="email"
  error={errors.email}
  hint="We'll never share your email"
  required
/>
```

Supports `as="input" | "textarea" | "select"`.

### FormError (`components/forms/FormError.tsx`)
Inline error banner for server action failures.
```tsx
<FormError message={error} />
```

### PageHeader (`components/PageHeader.tsx`)
Consistent page title + description + action button.
```tsx
<PageHeader
  title="Restaurants"
  description="Manage your restaurant locations"
  action={<Button>Add restaurant</Button>}
/>
```

### EmptyState (`components/EmptyState.tsx`)
```tsx
<EmptyState
  icon={UtensilsCrossed}
  title="No menus yet"
  description="Create your first menu to get started"
  action={<Button>Create menu</Button>}
/>
```

### Loading Skeletons (`components/Loading.tsx`)
```tsx
<CardSkeleton count={3} />   {/* Grid of card skeletons */}
<TableSkeleton rows={5} />   {/* Table row skeletons */}
<FormSkeleton fields={4} />  {/* Form field skeletons */}
```

---

## 6. Toast Notifications

Uses `sonner` via `components/ui/sonner.tsx`. Already mounted in root layout.

```tsx
import { toast } from "sonner";

toast.success("Menu published");
toast.error("Something went wrong");
toast.promise(saveAction(), {
  loading: "Saving...",
  success: "Saved",
  error: "Failed to save",
});
```

---

## 7. Server Action Pattern

All mutations go through server actions in `lib/auth/actions.ts` or feature-specific `actions.ts` files.

Pattern:
1. Parse with zod schema
2. Call Supabase
3. Return via `safeAction()` wrapper
4. Client receives `{ ok: boolean, data?, code?, message? }`
5. Client shows toast + handles error/redirect

```tsx
// Client
const result = await myAction(formData);
if (!result.ok) {
  toast.error(result.message);
  return;
}
toast.success("Done");
router.push("/dashboard");
```

---

## 8. Iconography

**One library only:** `lucide-react`

```tsx
import { LayoutDashboard, UtensilsCrossed, Settings } from "lucide-react";
```

Never mix icon libraries. Default size: `h-4 w-4` for inline, `h-5 w-5` for nav, `h-6 w-6` for empty states.

---

## 9. Responsive Breakpoints

Tailwind defaults:
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px
- `2xl:` 1536px

Dashboard uses a fixed desktop sidebar at `lg` and a Sheet-based navigation drawer below `lg`.

---

## 10. File Naming

| Pattern | Example |
|---------|---------|
| Page | `page.tsx` |
| Layout | `layout.tsx` |
| Server action | `actions.ts` |
| Client component | Follow surrounding feature convention; current shared feature components generally use PascalCase |
| Shared component | `components/ui/button.tsx` |
| Feature component | `components/menu/MenuGrid.tsx` |

---

## 11. Adding a New Page

1. Create route directory: `app/(dashboard)/my-feature/page.tsx`
2. Add `<PageHeader title="My Feature" />`
3. Use `FormField` for forms, `EmptyState` for empty lists
4. Create `actions.ts` in the route folder for server actions
5. Use `CardSkeleton` or `TableSkeleton` for loading states

---

*Last verified: 2026-07-23.*
