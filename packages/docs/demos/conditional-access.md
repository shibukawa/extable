# Conditional Readonly & Disabled

Use `conditionalStyle` to control readonly and disabled states based on row data.

## Interactive Demo

<ClientOnly>
  <ButtonLinkConditionalDemo />
</ClientOnly>

## What You're Seeing

- **Readonly Control** - String/number columns lock when `Edit` is off  
- **Disabled Actions** - Button/link cells disable when `Edit` is off  
- **Shared Toggle** - A single `Edit` flag drives the behavior  
- **Consistent Styling** - Disabled uses the readonly gray style
