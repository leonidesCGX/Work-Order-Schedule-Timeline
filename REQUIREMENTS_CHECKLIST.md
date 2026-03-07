# Requirements Checklist

## ✅ Completed Requirements

### Core Features (Must Implement)
- [x] Timeline grid with Day/Week/Month zoom levels
- [x] Work order bars with status indicators
- [x] Create/Edit slide-out panel with form validation
- [x] Overlap detection (show error if work orders overlap on same work center)

### Technical Requirements
- [x] Angular 17+ (using Angular 19)
- [x] Standalone components
- [x] TypeScript strict mode
- [x] SCSS for all styling
- [x] Reactive Forms (FormGroup, FormControl, Validators)
- [x] ng-select for dropdowns
- [x] @ng-bootstrap/ng-bootstrap for date picker

### Timeline Grid Features
- [x] Left panel: Work Center names (fixed, does not scroll horizontally)
- [x] Right panel: Timeline grid (horizontally scrollable)
- [x] Current date indicator: Vertical line showing today's date
- [x] Row hover state: Highlighted background
- [x] Initial visible range: Centered on today's date with proper buffer
  - Day view: ±2 weeks
  - Week view: ±2 months (~8 weeks)
  - Month view: ±6 months
- [x] Dynamic label for current date indicator ("Current day/week/month")

### Work Order Bars
- [x] Work order name (text label)
- [x] Status badge (pill/tag style)
- [x] Actions menu (three-dot button with Edit/Delete options)
- [x] Correct positioning based on start/end dates
- [x] Status colors matching requirements
- [x] Multiple work orders on same row (non-overlapping)

### Create Panel
- [x] Slides in from the right
- [x] Fixed width (480px)
- [x] Clicking outside closes the panel
- [x] Cancel button closes without saving
- [x] Form fields: Name, Status, Work Center, Start Date, End Date
- [x] Pre-filled start date from click position
- [x] Pre-filled end date (Start Date + 7 days)
- [x] Form validation (all fields required, end date after start date)
- [x] Overlap detection with error message

### Edit Panel
- [x] Same panel as Create
- [x] Header: "Work Order Details"
- [x] Fields pre-populated with existing data
- [x] Button text: "Save" instead of "Create"
- [x] Overlap validation (excluding the order being edited)

### Interactions
- [x] Click empty timeline area → Open Create panel
- [x] Click three-dot menu on bar → Open dropdown with Edit/Delete
- [x] Click Edit from dropdown → Open Edit panel
- [x] Click Delete from dropdown → Delete work order
- [x] Click outside panel → Close panel
- [x] Click Cancel → Close panel
- [x] Click Create/Save → Validate, save, and close panel
- [x] Change Timescale dropdown → Update timeline zoom level
- [x] Horizontal scroll → Scroll timeline (left panel stays fixed)
- [x] Hover on row → Highlight row background

### Data Requirements
- [x] At least 5 work centers
- [x] At least 8 work orders
- [x] All 4 status types represented
- [x] Multiple orders on same work center (non-overlapping)
- [x] Orders spanning different date ranges

### Documentation
- [x] README.md with setup instructions
- [x] Code comments explaining complex date calculations
- [x] Key implementation details documented

### Bonus Features (Optional)
- [x] localStorage persistence
- [x] Smooth animations (panel slide-in/out, bar hover effects)
- [ ] Automated test suite
- [ ] Keyboard navigation (Tab, Escape)
- [ ] Infinite scroll (dynamically load date columns)
- [ ] "Today" button
- [ ] Tooltip on bar hover
- [ ] Accessibility features (ARIA labels, focus management)

## ❌ Missing Requirements

### Required Deliverables
1. ✅ Working Angular 17+ application
2. ⚠️ Pixel-perfect implementation matching designs (needs verification against Sketch file)
3. ✅ Sample data (work centers + work orders)
4. ❌ **Loom demo (5-10 min)** - **REQUIRED BUT NOT CREATED**
5. ✅ GitHub repo with README

### Notes
- The Loom demo video is a **required deliverable** and must be created before submission
- Pixel-perfect verification should be done by comparing with the Sketch file
- All core functionality is implemented and working
- Code includes detailed comments explaining complex date calculations

## 📝 Next Steps

1. **Create Loom Demo Video** (Required):
   - Record 5-10 minute video showing:
     - Application running with sample data
     - All zoom levels (Day/Week/Month switching)
     - Creating a new work order
     - Editing an existing work order
     - Deleting a work order
     - Overlap error scenario
     - Brief walkthrough of code structure

2. **Pixel-Perfect Verification**:
   - Compare implementation with Sketch file
   - Verify colors, spacing, typography match exactly
   - Check status badge styles
   - Verify panel layout and form styling

3. **Optional Enhancements** (if time permits):
   - Add keyboard navigation
   - Add tooltip on bar hover
   - Add "Today" button
   - Improve accessibility
