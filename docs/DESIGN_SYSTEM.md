# Groly UI design standard

This document is the binding design standard for new UI work and visual refactors in Groly. It records the visual language established by the tracker, supplement, logging, reminder, and edit flows. New work must extend these patterns instead of creating a parallel style.

## 1. Product character

Groly is a mobile-first, dark-first utility app. The interface should feel calm, compact, and deliberate rather than decorative.

- **Direction:** Minimalist / Refined.
- **Primary motif:** flat grouped surfaces with restrained tracker color.
- **Interaction model:** bottom-up; frequent actions and navigation sit near the thumb.
- **Density:** compact enough for real data, but never cramped.
- **Color role:** identifies a tracker and its primary action; it does not decorate every surface.
- **Icons:** communicate function only. Tracker identity normally comes from color and text, not an additional icon.

## 2. Existing components are the standard

Reuse these components and their global classes before writing new one-off UI:

| Purpose | Canonical implementation |
| --- | --- |
| Tracker/supplement settings, edit sheets, and reminder sheets | `src/lib/components/supplements/ManageSheetShell.svelte` |
| Tracker section navigation for Today, History, and Nutrition | `src/lib/components/supplements/TrackerSectionNav.svelte` |
| Today and quick-log tracker cards | `src/lib/components/supplements/TrackerTileShell.svelte` |
| Supplement quick-log cards | `src/lib/components/supplements/SupplementQuickLogTile.svelte` |
| Combined tracker/supplement logging sheet | `src/lib/components/supplements/QuickLogSheet.svelte` |
| Supplement/caffeine active state | `src/lib/components/supplements/SupplementActiveToggle.svelte` |

`ManageSheetShell` owns the shared vocabulary for management UI. Prefer its established classes:

- `manage-stack`, `manage-section`, `manage-settings-surface`, `manage-settings-row`
- `manage-label`, `manage-section-title`, `manage-settings-label`
- `manage-input`, `manage-select`, `manage-control`, `manage-native-field`
- `manage-chip-grid`, `manage-chip`
- `manage-primary`, `manage-secondary`, `manage-danger`, `manage-icon-button`
- `manage-reminder-card`, `reminder-days`, `reminder-schedule-row`

Do not copy these rules into another component unless the component cannot use the shell.

## 3. Color system

Use semantic CSS variables for surfaces and text:

- Page/sheet background: `var(--color-bg)` or `var(--modal-bg)`
- Grouped container: `var(--bubble-container-bg)` with `var(--bubble-container-border)`
- Local interactive area: `var(--bubble-interactive-bg)` with `var(--bubble-interactive-border)`
- Standard field surface: `var(--color-surface-container)`
- Primary text: `var(--color-on-surface)`
- Secondary text: `var(--color-on-surface-variant)`
- Fine dividers: `var(--color-outline-variant)` or `var(--bubble-container-border)`
- Destructive action: `var(--color-error)`

Tracker accents are stable product semantics:

| Tracker | Accent |
| --- | --- |
| Supplements | `var(--color-primary)` |
| Hydration | `#60A5FA` |
| Meditation | `#9F7AEA` |
| Mood | `#F472B6` |
| Nutrition | `#FB923C` |
| Caffeine | `#C8956C` |
| Manage mode | `#2DD4BF` |

Pass the accent through `--manage-accent` or `--tracker-accent` when possible. Use `color-mix()` for subtle selected, focused, and pressed states. Avoid adding a new shade for every element.

### Accent restraint

- Use the accent for the tracker title, active values, progress fill, selected chips, and primary action.
- Keep supporting copy, counts, units, timestamps, and inactive controls neutral.
- Do not combine a colored title, colored identity dot, colored footer, and colored background when one or two signals already establish identity.
- A full accent background is reserved for the primary action or a clear selected state.

## 4. Surface hierarchy: no “bubble in bubble”

The interface uses two surface tiers, not unlimited nested capsules.

1. **Container surface:** groups related content with one border and one radius.
2. **Interactive surface:** marks a directly tappable control or compact footer within that container.

Rules:

- Inside a grouped settings card, fields are flat rows separated by fine dividers.
- Do not wrap each row in another rounded card.
- Days, time ranges, intervals, and actions should visually belong to one reminder card.
- A nested background is allowed only when it represents a real interaction: selected option, footer action, inline editor, or transient overlay.
- Prefer spacing and dividers over additional outlines.
- Never use a rectangular background that ignores the rounded outer container; clip or round the first and last interactive cells appropriately.

## 5. Geometry and spacing

Use the global radius tokens from `src/app.css`.

- Bottom sheet: `rounded-t-3xl` / 24 px visual radius, max width 430 px.
- Tracker and supplement cards: 20 px.
- Settings sections: 14–18 px depending on density.
- Compact footers and inline action rows: 9–10 px.
- Primary and secondary controls: 16 px or full pill when the surrounding pattern uses pills.
- Small selected chips: approximately 10–12 px.

Default horizontal sheet padding is 20 px. Related controls use 5–8 px gaps; separate sections use 8–12 px. Do not increase whitespace by adding empty rows or moving actions to a separate line when they fit safely beside the related value.

## 6. Typography and numbers

Follow the established compact hierarchy:

- Sheet title: 16 px, weight about 650.
- Tracker/card title: 14 px, weight 600, tracker accent.
- Body/value: 14–16 px depending on importance.
- Status and metadata: 11 px, neutral.
- Section labels: 11 px, weight 600; uppercase with restrained tracking only for true section headings.
- Tag labels: 9–10 px when paired with an icon.
- Inputs: always at least 16 px to prevent iOS zoom.

Use `font-variant-numeric: tabular-nums` or Tailwind `tabular-nums` for times, amounts, goals, and counters. Units are visually quieter than the value.

## 7. Bottom sheets and management flows

- Use `ManageSheetShell` for tracker and supplement configuration, editing, and reminders.
- Keep the drag handle and header fixed; scroll only the body.
- The footer stays fixed and uses the standard secondary/primary split.
- Primary action is on the right and receives the tracker accent.
- Destructive actions remain red and visually secondary unless destruction is the sole purpose.
- Use compact density by default; comfortable density requires a content reason.
- Use the solid `SupplementActiveToggle` for supplement and caffeine active-state controls. It intentionally has no white thumb.

### Reminder layouts

- Day chips belong inside the reminder card, not inside another card.
- For range reminders, `From`, `Until`, and `Interval` share one flat three-column schedule row.
- For a single-time reminder, time, delete, and save share one compact row where width permits.
- Do not reserve an entire extra row for delete/save when there is only one time value.
- Labels sit close to their values; values use the tracker accent and tabular numerals.

## 8. Tracker cards

### Tracker section navigation

The global `AppHeader` is shared with lists, recipes, and shopping and must not absorb tracker-specific navigation. Directly beneath it, `TrackerSectionNav` provides one compact, reusable section surface:

- The first row switches between Today, History, and Nutrition. Nutrition is shown only when the nutrition tracker is enabled.
- Today and History use the primary green active state; Nutrition uses its orange tracker accent.
- On Today and Nutrition, the second row contains Manage and today's reminder status.
- On History, the second row is replaced by the Day, Week, and Month controls. Never add a third navigation row for these controls.
- Keep translated labels short enough for equal-width tabs: `Heute / Verlauf / Ernährung` and `Today / History / Nutrition`.
- The Manage navigation link uses the primary green because it still belongs to the normal tracker workspace. The dedicated teal manage accent begins only after entering Manage mode. Reminder status stays neutral except for its semantic bell accent.

Do not create empty tracker cards merely to provide navigation. In particular, Nutrition does not appear as an empty Today card when nothing has been logged.

Today and Quick Log use the same coordinate system through `TrackerTileShell`.

- Two-column grid on phone where content permits.
- Standard card height is 108 px; expanded content may grow.
- Tracker title is colored; a redundant identity dot is normally omitted.
- Current status sits directly below the title.
- A thin 3 px progress line sits between status and footer where progress exists.
- The footer is neutral and compact; only its action label uses tracker color.
- The upper card area may navigate or reveal details. The footer action logs separately.
- Do not show a chevron when the whole upper area already communicates tappability.
- Interactive descendants must not trigger the parent card action.
- Nutrition navigates directly to its tracker page because it has no useful inline expansion.

Quick Log tracker ordering is intentional:

1. Mood at the top.
2. Nutrition left and Meditation right.
3. Caffeine left and Hydration right.

Preserve this arrangement unless the product behavior changes explicitly.

## 9. Supplement cards and plans

- Supplement cards use the primary green for the name, not for every supporting element.
- Brand, stock, time, and unit remain neutral unless they require attention.
- Amount and time share one compact two-cell footer with a neutral interactive background.
- Avoid two bright green buttons on every supplement card; repeated color becomes visual noise.
- The whole quick-log tile is the primary hit area. Inline amount/time controls remain separate hit targets.
- Keep cards at 20 px radius and preserve the bottom-up grid order.
- The weekly plan must show the whole week and all scheduled supplements without accordions or hidden overflow. Allow rows to wrap or grow instead of collapsing information.

## 10. Bottom-up interaction

Groly is operated from the bottom edge first.

- Put frequent actions, mode switches, step navigation, and save controls near the bottom.
- Anchor the current working content directly above its bottom navigation when it is shorter than the available space.
- When content is taller, remove the artificial top spacer and allow normal vertical scrolling.
- Horizontal step navigation may auto-center itself after an intentional tap; it must not move the page.
- Never expand/collapse content automatically during momentum scrolling.
- Do not reorder surrounding controls when a step changes. Render changing content in one stable workspace.
- After a deliberate expansion, scroll only the minimum amount necessary to keep the chosen content visible.

The Mood entry sheet is the reference for a long multi-step bottom-up flow: Mood, activity categories, and Notes share a fixed horizontal step rail; only one stable workspace changes above it.

## 11. Motion and feedback

- Motion communicates state only: press, selection, open/close, saved, or step change.
- Standard duration is 140–220 ms with a restrained ease such as `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Press feedback may use a subtle `scale(0.985)` or opacity change.
- Avoid decorative movement, long easing, and scroll-triggered layout mutation.
- Respect `prefers-reduced-motion` for non-essential transitions.

## 12. Touch, accessibility, and mobile behavior

- Target at least 40 px control height in compact management UI and approximately 44 px for primary touch actions.
- Keep all text inputs at 16 px or larger.
- Native time/date inputs may be visually overlaid, but their visible value must remain centered and the native control must stay within the field bounds.
- Use proper button elements, labels, `aria-pressed`, `aria-expanded`, and live status where applicable.
- Never nest buttons.
- Whole-card interactions must ignore buttons, links, inputs, selects, textareas, labels, and explicitly marked child actions.
- Preserve safe-area padding at the bottom of sheets and navigation.
- Verify the smallest supported phone width before optimizing desktop layout.

## 13. Review checklist

Before finishing tracker, supplement, or sheet UI work, verify:

- Does it reuse the canonical shell/card component?
- Is the accent used as identity rather than decoration?
- Is there any avoidable bubble inside another bubble?
- Are related values and actions kept in the same row or group?
- Does the working content sit near the bottom when appropriate?
- Does changing a step leave surrounding navigation stable?
- Are repeated cards calm when viewed as a full list?
- Are touch targets large enough and inputs at least 16 px?
- Does it work in both dark and light themes using semantic variables?
- Does it remain usable with long German and English labels?
- Were `npm run check` and `npm run build` run after meaningful changes?
