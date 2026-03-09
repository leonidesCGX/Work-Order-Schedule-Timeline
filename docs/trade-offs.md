# Implementation Trade-offs and Decisions

This document explains the main implementation decisions and trade-offs made during the development of the Work Order Timeline application.

## Timeline Rendering Approach

### Decision: Absolute Positioning with Calculated Coordinates

**Why:** Work order bars are positioned using absolute positioning with calculated `left` and `width` values based on date-to-pixel conversions.

**Trade-offs:**
- ✅ **Pros:** Simple, performant, works well with Angular's change detection. Easy to calculate positions from dates.
- ❌ **Cons:** Requires manual calculation of all positions. Doesn't automatically handle responsive layout changes.

**Alternative Considered:** CSS Grid with date-based column spans. Rejected due to complexity in handling variable column widths across zoom levels.

### Decision: Dynamic Column Generation

**Why:** Columns are generated dynamically based on the selected timescale and visible date range, rather than rendering all possible dates.

**Trade-offs:**
- ✅ **Pros:** Better performance, only renders what's needed. Flexible date range handling.
- ❌ **Cons:** More complex date calculation logic. Requires careful handling of date boundaries.

**Alternative Considered:** Pre-rendering all dates for a year. Rejected due to performance concerns with many columns.

## DOM Structure

### Decision: Separate Grid Layer for Column Separators

**Why:** Column separator lines are rendered in a separate absolute-positioned layer (`timeline-grid-layer`) behind the work order bars.

**Trade-offs:**
- ✅ **Pros:** Clean separation of concerns. Easy to control z-index. Lines render once, not per row.
- ❌ **Cons:** Requires careful z-index management. Slightly more complex DOM structure.

**Alternative Considered:** Rendering separators in each row. Rejected because it would duplicate DOM elements and make z-index management harder.

### Decision: Fixed Left Panel with Scrollable Timeline

**Why:** Work center names are in a fixed left column (380px), while the timeline grid scrolls horizontally.

**Trade-offs:**
- ✅ **Pros:** Work center names always visible. Standard Gantt chart pattern. Good UX.
- ❌ **Cons:** Requires careful CSS to keep panels aligned. More complex scrolling logic.

**Alternative Considered:** Fully scrollable layout. Rejected because it would hide work center names when scrolling.

## Date Picker Implementation

### Decision: Popup Datepicker Instead of Inline

**Why:** Used ng-bootstrap's popup datepicker (`ngbDatepicker`) instead of an inline calendar.

**Trade-offs:**
- ✅ **Pros:** Saves vertical space. Familiar interaction pattern. Less DOM overhead.
- ❌ **Cons:** Requires click to open. Less visible date context. More clicks to change dates.

**Alternative Considered:** Inline datepicker. Rejected due to space constraints and design requirements for compact form layout.

### Decision: Custom Date Parser/Formatter

**Why:** Implemented `CustomDateParserFormatter` to handle MM-DD-YYYY format instead of default ISO format.

**Trade-offs:**
- ✅ **Pros:** Matches design requirements. Better UX for US users. Consistent formatting.
- ❌ **Cons:** Additional code to maintain. Must handle edge cases manually.

**Alternative Considered:** Using default ISO format. Rejected because it didn't match design specifications.

## Overlap Validation

### Decision: Client-Side Validation Only

**Why:** Overlap detection is performed entirely on the client side using date range intersection logic.

**Trade-offs:**
- ✅ **Pros:** Immediate feedback. No server round-trip. Simple implementation.
- ❌ **Cons:** Doesn't handle concurrent edits. Could have race conditions in multi-user scenarios.

**Alternative Considered:** Server-side validation. Not implemented due to scope (localStorage-only persistence).

### Decision: Simple Date Range Intersection Algorithm

**Why:** Uses straightforward logic: `start1 <= end2 AND end1 >= start2` to detect overlaps.

**Trade-offs:**
- ✅ **Pros:** Simple, readable, performant. Handles all overlap cases correctly.
- ❌ **Cons:** Doesn't account for time-of-day (only dates). Edge cases at exact boundaries.

**Alternative Considered:** More complex algorithm with time precision. Rejected as unnecessary for date-only requirements.

## Visual Fidelity

### Decision: Pixel-Perfect Styling

**Why:** Attempted to match Sketch designs exactly, including specific color values, spacing, and typography.

**Trade-offs:**
- ✅ **Pros:** High visual fidelity. Matches design intent. Professional appearance.
- ❌ **Cons:** More time-consuming. Harder to maintain. Some values may be overly specific.

**Compromises Made:**
- Some spacing values were adjusted slightly for better visual balance
- Font rendering differences between Sketch and browsers required minor adjustments
- Box-shadow values were simplified slightly while maintaining visual similarity

## Performance Decisions

### Decision: No Virtual Scrolling

**Why:** Timeline renders all visible columns and work orders without virtualization.

**Trade-offs:**
- ✅ **Pros:** Simpler implementation. No complex scroll calculations. Works well for typical use cases.
- ❌ **Cons:** Could be slow with very large date ranges or many work orders. All DOM elements rendered.

**Future Consideration:** Virtual scrolling could be added for very large datasets (see @upgrade comments).

### Decision: Change Detection Strategy

**Why:** Uses default Angular change detection with manual `ChangeDetectorRef.detectChanges()` calls where needed.

**Trade-offs:**
- ✅ **Pros:** Simple, works well for this use case. No need for OnPush strategy complexity.
- ❌ **Cons:** May trigger unnecessary change detection cycles. Could be optimized further.

**Future Consideration:** OnPush change detection strategy could improve performance (see @upgrade comments).

## Accessibility

### Decision: Basic Accessibility Support

**Why:** Implemented basic keyboard support (Escape to close panel) and semantic HTML.

**Trade-offs:**
- ✅ **Pros:** Some accessibility features included. Basic keyboard navigation works.
- ❌ **Cons:** Not fully accessible. Missing ARIA labels, screen reader support, full keyboard navigation.

**Future Consideration:** Full accessibility implementation needed (see @upgrade comments).

## Data Persistence

### Decision: LocalStorage Only

**Why:** All data persists in browser LocalStorage with no backend.

**Trade-offs:**
- ✅ **Pros:** Simple, no server required. Works offline. Fast.
- ❌ **Cons:** Data is browser-specific. No multi-device sync. Limited storage capacity.

**Future Consideration:** Backend integration would enable multi-user, multi-device scenarios.

## Responsive Design

### Decision: Fixed Width Layout

**Why:** Timeline uses fixed widths for columns and panels, optimized for desktop viewing.

**Trade-offs:**
- ✅ **Pros:** Predictable layout. Matches design specifications. Easier to implement.
- ❌ **Cons:** Not responsive. Doesn't work well on mobile or small screens.

**Future Consideration:** Responsive breakpoints and mobile optimization needed (see @upgrade comments).
