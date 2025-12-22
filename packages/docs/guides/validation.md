# Validation Guide

Extable provides multiple layers of validation to ensure data integrity. From type-based constraints to custom formula errors and uniqueness checks, this guide covers how to implement and use validation effectively.

## Validation Layers

Validation in Extable operates at three levels, each complementing the others:

```
┌─────────────────────────────────────────┐
│ 1. Type & Schema Constraints (Fastest)  │
│    - Type validation                    │
│    - Length/range limits                │
│    - Pattern matching                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 2. Custom Validation via Formulas       │
│    - Complex business logic             │
│    - Error messages with context        │
│    - Reactive (re-evaluated on change)  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 3. Unique Constraints                   │
│    - Column-level uniqueness            │
│    - Multi-column combinations          │
│    - Cross-row dependencies             │
└─────────────────────────────────────────┘
```

## Layer 1: Type & Schema Constraints

### Type-Based Validation

Extable automatically validates against your column's defined type:

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  string: {
    regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  }
}

{
  key: 'age',
  header: 'Age',
  type: 'number',
  format: {
    signed: false  // Only non-negative values
  }
}

{
  key: 'birthDate',
  header: 'Birth Date',
  type: 'date'
  // Must be valid ISO date
}
```

**What's Validated Automatically:**
- ✅ Data type matches column type
- ✅ String length within `string.maxLength`
- ✅ String matches `string.regex` pattern
- ✅ Number is non-negative (when `number.signed` is `false`)
- ✅ Date format validity
- ✅ Enum values match `enum.options`
- ✅ Tag values match `tags.options` (if `allowCustom` is false)
- ✅ Boolean type correctness

### Length & Range Constraints

```typescript
// String length validation
{
  key: 'username',
  type: 'string',
  string: {
    maxLength: 20
    // ✓ "alice", "bob123" (valid)
    // ✗ "thisisaverylongusernamethatwontfit" (too long)
  }
}

// Number range validation (non-negative only)
{
  key: 'rating',
  type: 'number',
  format: {
    signed: false  // Must be >= 0
    // ✓ 0, 1, 2, 3, 4, 5 (valid)
    // ✗ -1 (negative not allowed)
  }
}

// Date range validation
{
  key: 'birthDate',
  type: 'date',
  nullable: false
  // ✓ "1990-01-15" (valid date)
  // ✗ "not-a-date", null (invalid)
}

// String pattern validation (regex)
{
  key: 'phone',
  type: 'string',
  string: {
    regex: '^\\d{3}-\\d{4}-\\d{4}$'
    // ✓ "123-4567-8901" (valid)
    // ✗ "1234567890" (does not match pattern)
  }
}
```

For range validation with min/max boundaries, use custom formula validation (see Layer 2: Custom Validation).

### Nullable and Required Fields

```typescript
// Required field (must have a value)
{
  key: 'name',
  type: 'string',
  nullable: false
  // ✓ "Alice", "" (if empty is acceptable)
  // ✗ null, undefined
}

// Optional field (can be empty or null)
{
  key: 'middleName',
  type: 'string',
  nullable: true
  // ✓ "James", null, "" (all valid)
  // ✗ (nothing is invalid)
}

// Readonly computed field (never editable)
{
  key: 'totalPrice',
  type: 'number',
  readonly: true,
  formula: (row) => row.quantity * row.unitPrice
}
```

### Schema-Level Validation Summary

Extable displays validation errors with:
- 🔴 Red outline on invalid cells
- ⚠️ Error count in table state
- 📋 Detailed error list in `getTableState().activeErrors`

```typescript
// Access validation errors programmatically
const state = table.getTableState();
console.log(state.activeErrors);
// [
//   { scope: 'validation', message: 'Email must be valid', target: { rowId: 'row1', colKey: 'email' } },
//   { scope: 'validation', message: 'Age must be between 0 and 150', target: { rowId: 'row2', colKey: 'age' } }
// ]
```

## Layer 2: Custom Validation via Formulas

### Formula-Based Error Returns

For complex business logic beyond type constraints, use formula error returns:

```typescript
{
  key: 'password',
  header: 'Password',
  type: 'string',
  // Hidden computed column that validates the password
  string: { allowMultiline: false },
  formula: (row) => {
    const pwd = row.password;
    
    // Multiple validation rules
    if (!pwd || pwd.length < 8) {
      return [pwd, new Error('Password must be at least 8 characters')];
    }
    if (!/[A-Z]/.test(pwd)) {
      return [pwd, new Error('Must contain at least one uppercase letter')];
    }
    if (!/[0-9]/.test(pwd)) {
      return [pwd, new Error('Must contain at least one number')];
    }
    
    // Valid password - return computed representation
    return '●'.repeat(pwd.length);  // Display as dots for security
  }
}
```

**Formula Error Pattern:**

```typescript
formula: (row) => {
  // Validation check
  if (isInvalid(row)) {
    // Return tuple: [displayValue, errorObject]
    return [row.value, new Error('Human-readable error message')];
  }
  
  // Valid case - return computed value
  return computedValue;
}
```

### Contextual Error Messages

Provide users with actionable error messages that reference other cells:

```typescript
{
  key: 'endDate',
  header: 'End Date',
  type: 'date',
  formula: (row) => {
    const startDate = new Date(row.startDate);
    const endDate = new Date(row.endDate);
    
    if (endDate <= startDate) {
      return [
        row.endDate,
        new Error(
          `End date (${row.endDate}) must be after start date (${row.startDate})`
        )
      ];
    }
    
    // Calculate duration for display
    const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }
}
```

### Conditional Formatting + Validation

Combine conditional formatting with error detection:

```typescript
{
  key: 'discount',
  header: 'Discount %',
  type: 'number',
  format: { min: 0, max: 100 },
  
  // Computed column that validates and shows warnings
  formula: (row) => {
    if (row.discount > 50) {
      return [
        row.discount,
        new Error('Discount exceeds 50% - requires manager approval')
      ];
    }
    if (row.discount > 25) {
      return [
        row.discount,
        new Error('Discount exceeds 25% - review required')
      ];
    }
    return row.discount;
  },
  
  // Visualize discount level with colors
  conditionalStyle: (row) => {
    if (row.discount > 50) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828' };  // Red
    }
    if (row.discount > 25) {
      return { backgroundColor: '#fff3e0', textColor: '#e65100' };  // Orange
    }
    if (row.discount > 10) {
      return { backgroundColor: '#e8f5e9', textColor: '#2e7d32' };  // Green
    }
    return null;
  }
}
```

### Cross-Row Validation

Validate a cell based on other rows in the table:

```typescript
{
  key: 'email',
  header: 'Email Address',
  type: 'string',
  string: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  
  formula: (row, allRows) => {
    const email = row.email;
    
    // Check if email is unique in the table
    const duplicates = allRows.filter(
      r => r.email === email && r.id !== row.id
    );
    
    if (duplicates.length > 0) {
      return [
        email,
        new Error(`Email "${email}" is already used by another user`)
      ];
    }
    
    return email;
  }
}
```

**Note:** Some validation frameworks (like those with server-side uniqueness checks) may be better served by Layer 3 (unique constraints).

## Layer 3: Unique Constraints

### Column-Level Uniqueness

Enforce unique values across all rows in a column:

```typescript
{
  key: 'username',
  header: 'Username',
  type: 'string',
  unique: true  // Must be unique within the table
  // ✓ alice, bob, charlie (all different)
  // ✗ alice, bob, alice (duplicate not allowed)
}

{
  key: 'email',
  header: 'Email',
  type: 'string',
  unique: true
}
```

**Behavior:**
- Validation runs when: cell is edited, row is added, data is imported
- Error display: Red outline + error message in `getTableState().activeErrors`
- Server sync: Uniqueness is typically enforced server-side; local validation prevents obvious duplicates

### Multi-Column Unique Constraints

Enforce uniqueness on combinations of columns:

```typescript
// Schema-level unique constraint
const schema = {
  columns: [
    { key: 'company', type: 'string' },
    { key: 'department', type: 'string' },
    { key: 'employeeId', type: 'string' }
  ],
  
  // Uniqueness constraint on combination
  unique: [
    ['company', 'department', 'employeeId']  // This combo must be unique
  ]
  // ✓ (Apple, Engineering, E001), (Apple, HR, E001), (Google, Engineering, E001)
  // ✗ (Apple, Engineering, E001), (Apple, Engineering, E001) [duplicate combo]
}
```

**Use Cases:**
- Prevent duplicate employee IDs per department
- Ensure unique project codes per company
- Enforce unique (lastname, firstname) combinations

### Conditional Unique Constraints

Apply uniqueness only to certain rows:

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  
  formula: (row, allRows) => {
    // Only enforce uniqueness for active users
    if (row.status !== 'active') {
      return row.email;
    }
    
    // Check uniqueness only among active users
    const activeEmails = allRows
      .filter(r => r.status === 'active')
      .map(r => r.email);
    
    const isDuplicate = activeEmails.filter(e => e === row.email).length > 1;
    
    if (isDuplicate) {
      return [
        row.email,
        new Error(`Email "${row.email}" is already used by another active user`)
      ];
    }
    
    return row.email;
  }
}
```

## Error Handling and Display

### User-Facing Error Display

Errors are displayed with visual indicators:

```typescript
// 1. Red cell outline - indicates invalid cell
// 2. Error icon on cell
// 3. Error details available in cell metadata

// Access errors programmatically
table.subscribeTableState((state) => {
  const errors = state.activeErrors;
  
  errors.forEach(error => {
    console.log(`Row ${error.target.rowId}, Col ${error.target.colKey}: ${error.message}`);
  });
});

// Or via selection tracking
table.subscribeSelection((snapshot) => {
  if (snapshot.diagnostic) {
    console.log('Active cell has error:', snapshot.diagnostic.message);
  }
});
```

### Error Scopes

Errors are categorized by source:

```typescript
// Schema validation error
{
  scope: 'validation',
  message: 'Email must be valid',
  target: { rowId: 'row1', colKey: 'email' }
}

// Formula error (custom validation)
{
  scope: 'formula',
  message: 'Password must be at least 8 characters',
  target: { rowId: 'row2', colKey: 'password' }
}

// Uniqueness error
{
  scope: 'unique',
  message: 'Email is not unique',
  target: { rowId: 'row3', colKey: 'email' }
}

// Diagnostic error (formula throws/errors)
{
  scope: 'diagnostic',
  message: 'Unexpected error in formula',
  target: { rowId: 'row4', colKey: 'computed' }
}
```

### Filtering Errors

Get only specific types of errors:

```typescript
const state = table.getTableState();

// Only validation errors
const typeErrors = state.activeErrors.filter(e => e.scope === 'validation');

// Only formula errors
const formulaErrors = state.activeErrors.filter(e => e.scope === 'formula');

// Only a specific row
const rowErrors = state.activeErrors.filter(e => e.target?.rowId === 'row1');

// Only a specific column
const colErrors = state.activeErrors.filter(e => e.target?.colKey === 'email');

// By error count
console.log(`Table has ${state.activeErrors.length} validation issues`);
```

## Validation Patterns

### Pattern 1: Email Validation

```typescript
{
  key: 'email',
  header: 'Email Address',
  type: 'string',
  string: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    length: { min: 5, max: 254 }
  },
  formula: (row, allRows) => {
    // Check uniqueness among active users
    if (row.status === 'active') {
      const duplicates = allRows.filter(
        r => r.status === 'active' && r.email === row.email && r.id !== row.id
      );
      if (duplicates.length > 0) {
        return [row.email, new Error('Email already in use')];
      }
    }
    return row.email;
  }
}
```

### Pattern 2: Date Range Validation

```typescript
{
  key: 'projectEndDate',
  header: 'End Date',
  type: 'date',
  formula: (row) => {
    const start = new Date(row.projectStartDate);
    const end = new Date(row.projectEndDate);
    
    if (!row.projectStartDate || !row.projectEndDate) {
      return [row.projectEndDate, new Error('Both dates required')];
    }
    
    if (end <= start) {
      return [
        row.projectEndDate,
        new Error(`End date must be after start date (${row.projectStartDate})`)
      ];
    }
    
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }
}
```

### Pattern 3: Percentage with Warnings

```typescript
{
  key: 'completionPercent',
  header: 'Complete %',
  type: 'number',
  format: { min: 0, max: 100, scale: 0 },
  
  formula: (row) => {
    const pct = row.completionPercent;
    
    if (pct < 0 || pct > 100) {
      return [pct, new Error('Must be between 0 and 100')];
    }
    
    if (pct === 100 && !row.completedDate) {
      return [pct, new Error('Completion date required when 100% complete')];
    }
    
    return `${pct}%`;
  },
  
  conditionalStyle: (row) => {
    const pct = row.completionPercent;
    if (pct === 100) return { backgroundColor: '#c8e6c9' };     // Green
    if (pct >= 75) return { backgroundColor: '#fff9c4' };       // Yellow
    if (pct >= 50) return { backgroundColor: '#ffe0b2' };       // Orange
    return { backgroundColor: '#ffcdd2' };                      // Red
  }
}
```

### Pattern 4: Dependent Field Validation

```typescript
{
  key: 'requiresApproval',
  header: 'Needs Approval?',
  type: 'boolean',
  
  formula: (row) => {
    // Auto-calculate based on other fields
    const requiresApproval = 
      row.amount > 10000 ||
      row.category === 'sensitive' ||
      row.riskLevel === 'high';
    
    if (requiresApproval && !row.approverName) {
      return [
        requiresApproval,
        new Error('Approver must be assigned for high-risk transactions')
      ];
    }
    
    return requiresApproval;
  }
}
```

## Best Practices

### Do's ✅

- **Layer validation appropriately**: Use type constraints for basics, formulas for complex logic, unique constraints for cross-row rules
- **Provide clear error messages**: Include context about what's wrong and why
- **Use conditional formatting** to highlight validation states visually
- **Combine with readonly fields**: Mark computed/validated columns as readonly when appropriate
- **Test validation rules** with edge cases (empty, null, extreme values)

### Don'ts ❌

- **Avoid overly complex formulas**: Keep business logic readable
- **Don't hide validation errors**: Always display them to users
- **Don't rely only on client-side validation**: Server-side validation is still necessary
- **Avoid circular dependencies**: Where Formula A depends on Formula B that depends on Formula A
- **Don't validate without feedback**: Users need to know why a cell is invalid

## Performance Considerations

### Validation Timing

```typescript
// Type validation - instant (before formula evaluation)
// Formula validation - runs once per row per render
// Unique validation - runs once per column when cell changes

// This is optimized:
- Type constraint fails → cell marked red immediately
- Formula runs → may add additional errors
- Unique check runs → cross-row comparison
```

### Optimizing Formula Validation

For large tables, keep formulas performant:

```typescript
// ❌ AVOID: Expensive computation in formula
formula: (row, allRows) => {
  const expensive = allRows.map(r => {
    // Complex calculation for every row
    return processRow(r);
  });
  return expensive;
}

// ✅ GOOD: Focused validation
formula: (row) => {
  // Just validate this row
  if (row.value < 0) {
    return [row.value, new Error('Must be positive')];
  }
  return row.value;
}
```

## Integration with Data Submission

### Validation Before Commit

```typescript
// Check for errors before allowing commit
table.subscribeTableState((state) => {
  const hasErrors = state.activeErrors.length > 0;
  
  if (hasErrors) {
    document.getElementById('commitBtn').disabled = true;
    document.getElementById('errorMsg').textContent = 
      `Fix ${state.activeErrors.length} validation error(s)`;
  } else {
    document.getElementById('commitBtn').disabled = false;
    document.getElementById('errorMsg').textContent = '';
  }
});

// Only allow commit if valid
async function saveData() {
  const state = table.getTableState();
  
  if (state.activeErrors.length > 0) {
    alert('Please fix validation errors before saving');
    return;
  }
  
  await table.commit();
}
```

## Server-Side Validation

Client-side validation is not sufficient. Always validate on the server:

```typescript
// Client-side validation (first line of defense)
// - Immediate user feedback
// - Prevents obvious errors
// - Improves UX

// Server-side validation (required)
// - Authoritative source of truth
// - Prevents tampering
// - Enforces business rules that change
// - Handles concurrent edits

// After server response, update client state
const response = await fetch('/api/save', { method: 'POST', body: data });

if (response.ok) {
  // Validation passed on server
  table.commit();
} else {
  // Server returned validation errors
  const errors = await response.json();
  displayServerErrors(errors);
}
```

## See Also

- [Data Format Guide](/guides/data-format.md) - Column type definitions and constraints
- [Formulas Guide](/guides/formulas.md) - Advanced formula patterns
- [Conditional Style Guide](/guides/conditional-style.md) - Visual validation feedback
- [Edit Mode Guide](/guides/editmode.md) - Direct vs commit mode interaction
