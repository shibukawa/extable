# Sort & Filter Guide

Extable provides intuitive sorting and filtering capabilities integrated into the view layer. Filters and sorts are applied to the current view without modifying the underlying data.

## Opening the Sort/Filter Panel

Click the filter/sort icon in any column header to open the **Sort/Filter panel** for that column.

## Panel Layout

The Sort/Filter panel is divided into two sections:

```
┌──────────────────────────────────────┐
│ Sort/Filter: Name             [×]    │
├──────────────────────────────────────┤
│ Filter                               │
│ ☐ Errors  ☐ Warnings                │
│ [Search values...]                   │
│                                      │
│ ☑ User 1                             │
│ ☑ User 10                            │
│ ☑ User 100                           │
│ ☑ User 11                            │
│ ☑ User 12                            │
│ ☑ User 13                            │
│ ...                                  │
│                                      │
│ [Select All] [Select None]           │
│ [Apply]      [Clear]                 │
│                                      │
│ Sort                                 │
│ [Sort Asc]  [Sort Desc]  [Clear Sort]│
└──────────────────────────────────────┘
```

## Filtering

### Filter by Column Values

**Distinct Value Filter:**

The filter panel displays all unique values in the selected column with checkboxes.

- **Check/uncheck values** to include/exclude them
- **"Include Blanks" option** for null/empty values
- Multiple values use **OR logic** (show rows matching ANY selected value)

### Search Filter Values

Use the **Search field** to quickly find values:

- Type to filter the displayed list
- Useful for columns with many distinct values (100+)

### Filter Actions

- **Select All** - Check all visible values
- **Select None** - Uncheck all values
- **Apply** - Apply the filter to the table
- **Clear** - Remove the filter for this column

### Column Diagnostics Filter

When a column has validation errors or warnings:

- **☐ Errors** - Show rows with validation errors only
- **☐ Warnings** - Show rows with warnings only
- Check either to filter by diagnostic state

## Sorting

### Sort by Column

Use the **Sort section** at the bottom of the panel:

- **Sort Asc** - Sort ascending (A→Z, 0→9, earliest→latest)
- **Sort Desc** - Sort descending (Z→A, 9→0, latest→earliest)
- **Clear Sort** - Remove sort from this column

### Single Column Sort

Extable supports sorting by **one column only**. Clicking sort on a different column replaces the previous sort:

```
Scenario 1: Sort Name (Asc)
Table shows: All rows sorted by Name (A→Z)

Scenario 2: Click Sort Asc on Status
Result: Previous Name sort is replaced
Table shows: All rows sorted by Status
```

### Remove Sort

Click **Clear Sort** button in the Sort section to remove sorting and revert to data order.
