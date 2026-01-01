# Menu Utility System

This utility system allows components to export their menu configurations to the header navigation, creating a unified mobile navigation experience.

## How It Works

1. **Components export menu configurations** using `createMenuConfig()`
2. **Header navigation imports and merges** these configurations
3. **Mobile navigation displays** all available menu items in a single hamburger menu
4. **Desktop navigation** remains unchanged with sidebars and individual navigation

## Usage Examples

### 1. Export Menu from a Component

```jsx
import { createMenuConfig } from '../utils/menuUtils';

// In your component file
export const getMyComponentMenuConfig = (props) => {
  const items = [
    {
      label: 'Section 1',
      section: 'section1',
      icon: MyIcon,
      path: null
    },
    {
      label: 'External Link',
      section: 'external',
      icon: ExternalIcon,
      path: '/external-page'
    }
  ];
  
  return createMenuConfig(items, 'My Component', true);
};
```

### 2. Import in Header Component

```jsx
import { getMyComponentMenuConfig } from '../path/to/MyComponent';
import { mergeMenuConfigs } from '../utils/menuUtils';

const HeaderComp = () => {
  const myComponentConfig = getMyComponentMenuConfig(props);
  const mobileMenuItems = mergeMenuConfigs([myComponentConfig]);
  
  // Render mobile menu items...
};
```

### 3. Handle Menu Item Clicks

```jsx
const handleMenuItemClick = (item) => {
  if (item.path) {
    // External link
    window.location.href = item.path;
  } else if (item.section) {
    // Internal section - trigger section change
    if (window.handleSectionChange) {
      window.handleSectionChange(item.section);
    }
  }
};
```

## Menu Item Structure

```jsx
{
  label: 'Display Name',           // Required: Text to display
  section: 'section-name',         // Optional: Internal section identifier
  icon: IconComponent,             // Required: Material-UI icon component
  path: '/external-path',          // Optional: External link path
  badge: 5                         // Optional: Notification count or badge
}
```

## Benefits

- **Single hamburger menu** on mobile devices
- **Reusable menu system** across components
- **Consistent navigation experience** 
- **Easy to maintain** and extend
- **Desktop experience unchanged** with sidebars

## Current Implementation

- **Profile Component**: Exports profile section navigation
- **Header Component**: Imports and displays profile menu on profile pages
- **Mobile**: Single hamburger menu with profile sections
- **Desktop**: Profile sidebar navigation remains visible

## Future Extensions

Other components can easily export their menus:
- Knowledge Paths
- Events
- Content Library
- User Settings
- etc.

This creates a scalable navigation system that grows with your application.
