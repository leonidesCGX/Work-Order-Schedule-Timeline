# Work Order Schedule Timeline

A comprehensive Angular 17+ application for managing work orders across multiple work centers with an interactive timeline visualization.

## Features

- **Interactive Timeline Grid** with Day/Week/Month zoom levels
- **Work Order Management** - Create, edit, and delete work orders
- **Status Indicators** - Visual status badges (Open, In Progress, Complete, Blocked)
- **Overlap Detection** - Prevents scheduling conflicts on the same work center
- **Responsive Design** - Clean, modern UI matching the provided designs
- **LocalStorage Persistence** - Work orders persist across page refreshes

## Tech Stack

- **Angular 19** (standalone components)
- **TypeScript** (strict mode)
- **SCSS** for styling
- **Reactive Forms** for form management
- **@ng-bootstrap/ng-bootstrap@18.0.0** for date picker
- **@ng-select/ng-select@14.9.0** for dropdowns
- **Circular Std** font family

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd work-order-timeline
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

**Note:** Use `--legacy-peer-deps` flag to handle peer dependency conflicts between Angular 19 and some third-party libraries.

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:4200`

## Usage

### Timeline Navigation

- **Timescale Dropdown**: Switch between Day (default), Week, and Month views
- **Horizontal Scroll**: Scroll through the timeline to view different date ranges
- **Current Date Indicator**: Blue vertical line with label shows the current day/week/month
- **Row Hover**: Hover over a work center row to highlight it
- **Click to Create**: Click on an empty area in a timeline row to create a new work order

### Creating Work Orders

1. Click on an empty area in the timeline row for a work center
2. The create panel will slide in from the right
3. Fill in the form:
   - Work Order Name (required)
   - Status (default: Open)
   - Work Center (pre-selected based on clicked row)
   - Start Date (pre-filled from click position)
   - End Date (default: Start Date + 7 days)
4. Click "Create" to save

### Editing Work Orders

1. Click the three-dot menu (⋮) on any work order bar
2. Select "Edit" from the dropdown
3. Modify the form fields
4. Click "Save" to update

### Deleting Work Orders

1. Click the three-dot menu (⋮) on any work order bar
2. Select "Delete" from the dropdown
3. Confirm the deletion

### Status Colors

- **Open**: Light Blue (#BFDBFE)
- **In Progress**: Light Purple (#DDD6FE)
- **Complete**: Light Green (#A7F3D0)
- **Blocked**: Light Yellow/Orange (#FDE68A)

## Project Structure

```
src/
├── app/
│   ├── models/
│   │   ├── work-center.model.ts      # Work center data model
│   │   └── work-order.model.ts       # Work order data model
│   ├── services/
│   │   └── work-order.service.ts     # Data service with CRUD operations
│   ├── timeline/
│   │   ├── timeline.component.ts     # Main timeline component
│   │   ├── timeline.component.html
│   │   └── timeline.component.scss
│   ├── work-order-panel/
│   │   ├── work-order-panel.component.ts  # Create/Edit panel
│   │   ├── work-order-panel.component.html
│   │   └── work-order-panel.component.scss
│   └── app.component.ts              # Root component
├── styles.scss                        # Global styles
└── index.html                         # HTML entry point
```

## Key Implementation Details

### Timeline Positioning

The timeline calculates work order bar positions based on:
- Selected zoom level (Day/Week/Month)
- Visible date range
- Work order start and end dates
- Column widths:
  - Day view: 40px per day
  - Week view: 100px per week
  - Month view: 200px per month

### Overlap Detection

The system prevents overlapping work orders on the same work center by:
- Checking date ranges when creating/editing
- Comparing start and end dates with existing orders
- Excluding the current order when editing
- Displaying an error message if overlap is detected

### Date Calculations

Complex date calculations handle:
- Converting between date formats (ISO strings, NgbDateStruct, Date objects)
- Calculating pixel positions from dates
- Handling different zoom levels
- Scrolling to current date on load

## Sample Data

The application includes sample data with:
- 5 work centers (Extrusion Line A, CNC Machine 1, Assembly Station, Quality Control, Packaging Line)
- 8 work orders across different centers
- All 4 status types represented (open, in-progress, complete, blocked)
- Multiple non-overlapping orders on the same work center
- Work orders centered around the current date for visibility

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

## Implementation Details

### Key Features Implemented

- ✅ Standalone Angular components (Angular 19)
- ✅ Reactive Forms with validation
- ✅ ng-select for dropdowns
- ✅ ng-bootstrap datepicker
- ✅ Horizontal scrollable timeline with fixed left panel
- ✅ Day/Week/Month zoom levels with accurate date positioning
- ✅ Current day indicator with proper positioning across all zoom levels
- ✅ Row hover states
- ✅ Click-to-create functionality with date pre-filling
- ✅ Three-dot actions menu (Edit/Delete)
- ✅ Overlap detection preventing conflicts on same work center
- ✅ Right-side slide-out panel for create/edit
- ✅ Escape key support for closing panel
- ✅ LocalStorage persistence
- ✅ Pixel-accurate styling matching design requirements

### Date Calculation Engine

The timeline uses a sophisticated date positioning system that:
- Calculates visible date ranges based on zoom level
- Generates header segments dynamically
- Computes work order bar positions accurately across all zoom levels
- Maps click positions to dates correctly
- Handles edge cases (month boundaries, year changes, etc.)

### Overlap Detection

The overlap detection algorithm:
- Checks if two date ranges intersect (start1 <= end2 AND end1 >= start2)
- Excludes the current order when editing
- Provides clear error feedback
- Prevents saving overlapping orders on the same work center

## Documentation

### AI Prompts
The main AI prompts used during implementation are documented in [`docs/ai-prompts.md`](docs/ai-prompts.md). These prompts are organized by purpose:
- Design analysis and fidelity audits
- Timeline/grid implementation
- Form/panel refinement
- Interaction states
- Debugging and architecture

### Trade-offs and Decisions
Implementation decisions and trade-offs are documented in [`docs/trade-offs.md`](docs/trade-offs.md). This includes:
- Timeline rendering approach
- DOM structure choices
- Date picker implementation decisions
- Overlap validation strategy
- Visual fidelity compromises
- Performance and maintainability decisions

### @upgrade Comments
Throughout the codebase, you'll find `@upgrade` comments marking areas where future improvements would be valuable. These comments indicate:
- **Timeline virtualization**: Virtual scrolling for large date ranges and datasets
- **Accessibility improvements**: ARIA labels, keyboard navigation, screen reader support
- **Datepicker enhancements**: Inline calendar views, richer interactions
- **Responsive behavior**: Mobile and tablet breakpoints, flexible layouts
- **Animation polish**: Smooth transitions and entrance/exit effects

These comments are not exhaustive but highlight key areas where the application could be enhanced for production use.

## Future Enhancements

- [ ] Infinite horizontal scroll (dynamically load date columns)
- [ ] "Today" button to jump to current date
- [ ] Tooltip on work order bar hover showing full details
- [ ] Drag and drop to reschedule work orders
- [ ] Unit and E2E tests
- [ ] Accessibility improvements (ARIA labels, focus management)

## License

This project is part of a technical assessment.

## Author

Built as a technical test for Naologic.
