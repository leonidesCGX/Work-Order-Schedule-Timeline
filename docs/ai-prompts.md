# AI Prompts Documentation

This document contains the main AI prompts used during the implementation of the Work Order Timeline application. Prompts are organized by purpose for clarity.

## Design Analysis

### Initial Design Review
```
Analyze the provided Sketch design files and identify all visual specifications including:
- Exact color values (hex, rgba)
- Typography (font families, sizes, weights, line heights)
- Spacing (padding, margins, gaps)
- Border radius values
- Box shadows (all layers)
- Component dimensions
- Layout structure
```

### Design Fidelity Audit
```
Compare the current implementation against the Sketch designs pixel-by-pixel:
- Identify any discrepancies in colors, spacing, typography
- Check alignment and positioning accuracy
- Verify all interactive states (hover, focus, active)
- Ensure all visual elements match the design specifications exactly
```

## Timeline/Grid Implementation

### Timeline Rendering Approach
```
Implement a horizontal scrollable timeline that:
- Supports Day, Week, and Month zoom levels
- Dynamically generates columns based on visible date range
- Calculates work order bar positions accurately across all zoom levels
- Handles date-to-pixel conversions correctly
- Maintains performance with many columns
- Uses absolute positioning for work order bars
```

### Column Generation Logic
```
Generate timeline columns that:
- Start from a buffer before current date
- Extend to a buffer after current date
- Have consistent widths per zoom level (Day: 114px, Week: 114px, Month: 114px)
- Display appropriate date labels for each zoom level
- Handle month boundaries and year changes correctly
```

### Work Order Bar Positioning
```
Calculate work order bar positions by:
- Converting start/end dates to pixel positions
- Handling bars that span multiple columns
- Ensuring bars align correctly with column boundaries
- Handling edge cases (bars at column boundaries, very short bars)
- Maintaining visual consistency across zoom levels
```

## Form/Panel Refinement

### Work Order Panel Styling
```
Style the work order details panel to match design specifications:
- Apply exact padding and spacing (24px horizontal, 48px vertical gaps)
- Style all input fields with correct focus states
- Implement date input formatting (MM-DD-YYYY)
- Style status dropdown with custom badge display
- Ensure all form elements have consistent styling
```

### Input Field Focus States
```
Implement focus states for all form inputs:
- Work Order Name: box-shadow with rgba(170, 175, 255, 1) when focused
- Date inputs: same focus style with text color change
- Status select: ensure focus style applies correctly
- All inputs should have consistent focus behavior
```

### Date Picker Customization
```
Customize ng-bootstrap datepicker to:
- Remove calendar icons from inputs
- Make entire input field clickable
- Display dates in MM-DD-YYYY format
- Apply custom text styling (color, font, size, weight)
- Handle date parsing and formatting correctly
```

## Interaction States

### Timeline Interactions
```
Implement timeline interactions:
- Click on empty area to create work order (pre-fill dates from click position)
- Hover states for work center rows
- Three-dot menu for edit/delete actions
- Selection overlay for creating new orders
- Current date indicator positioning
```

### Overlap Detection
```
Implement overlap validation that:
- Checks if new work order dates overlap with existing orders on same work center
- Excludes current order when editing
- Provides clear error messages
- Prevents saving overlapping orders
- Handles edge cases (same start/end dates, partial overlaps)
```

## Debugging & Architecture

### Performance Optimization
```
Optimize timeline rendering for:
- Large numbers of work orders
- Many columns in month view
- Smooth scrolling performance
- Efficient change detection
- Memory management
```

### Date Calculation Debugging
```
Debug date calculations to ensure:
- Accurate date-to-pixel conversions
- Correct handling of timezones
- Proper month boundary calculations
- Accurate current date positioning
- Correct column generation across date ranges
```

### Z-Index and Layering
```
Fix z-index issues to ensure:
- Grid lines appear behind work order cards
- Header stays above grid lines
- Work order cards appear above grid
- Dropdowns appear above all other elements
- Proper stacking order throughout the application
```
