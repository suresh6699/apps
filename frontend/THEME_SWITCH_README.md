# Theme Switch Components

This project now includes two beautiful theme switch components that have been integrated into the dashboard.

## Components Available

### 1. **ThemeSwitch** (Simple & Clean)
Located at: `/src/components/ui/theme-switch.jsx`

A clean, minimalist theme switch with smooth animations and icon transitions.

**Features:**
- High contrast design for excellent visibility
- Smooth slide transition with shadow effects
- Colored Sun (amber) and Moon (amber/blue) icons
- Scales icons based on active state
- Dark mode support with automatic color adaptation
- Border and shadow for depth
- Lightweight and performant

**Usage:**
```jsx
import ThemeSwitch from './ui/theme-switch';

function YourComponent() {
  return <ThemeSwitch className="your-custom-classes" />;
}
```

### 2. **ThemeSwitchFlowGlass** (Premium with WebGL)
Located at: `/src/components/ui/theme-switch-flow-glass.jsx`

A premium theme switch with WebGL-powered animated background featuring flowing ink-like patterns.

**Features:**
- WebGL-powered fluid animation with dynamic shaders
- Parallax mouse tracking for interactive experience
- Enhanced glass morphism design with better borders
- Colored icons (Sun: amber, Moon: blue) for better visibility
- Shadow effects and depth
- Dark mode support with automatic adaptation
- Respects reduced motion preferences
- Customizable intensity

**Usage:**
```jsx
import ThemeSwitchFlowGlass from './ui/theme-switch-flow-glass';

function YourComponent() {
  return <ThemeSwitchFlowGlass intensity={1.2} className="your-custom-classes" />;
}
```

**Props:**
- `intensity` (number, default: 1): Controls animation intensity (0.5 - 2.0)
- `className`: Additional CSS classes

## Implementation Details

### Current Integration
The simple `ThemeSwitch` component has been integrated into the Dashboard component, replacing the previous button-based theme toggle.

**Location:** `/src/components/Dashboard.jsx`

**Before:**
```jsx
<Button onClick={toggleTheme} ...>
  {theme === 'dark' ? <Sun /> : <Moon />}
</Button>
```

**After:**
```jsx
<ThemeSwitch className="backdrop-blur-md" />
```

### How to Switch Between Versions

To use the premium FlowGlass version instead:

1. Open `/src/components/Dashboard.jsx`
2. Change the import:
```jsx
// From:
import ThemeSwitch from './ui/theme-switch';

// To:
import ThemeSwitchFlowGlass from './ui/theme-switch-flow-glass';
```

3. Update the component usage:
```jsx
// From:
<ThemeSwitch className="backdrop-blur-md" />

// To:
<ThemeSwitchFlowGlass className="backdrop-blur-md" intensity={1} />
```

## Dependencies

The following packages were installed:
- `@radix-ui/react-switch` - For the accessible switch primitive
- `class-variance-authority` - For managing component variants

## Technical Notes

### React Adaptation
These components were adapted from Next.js components to work with standard React:
- Removed `"use client"` directives
- Replaced `next-themes` with the app's existing theme context from `App.js`
- Used the existing `useTheme` hook from `../App`

### Theme System
The app uses a custom theme system defined in `App.js`:
- Theme state is managed with React Context
- Themes are persisted in localStorage
- Theme classes are applied to `document.documentElement`

### Accessibility
Both components are built on `@radix-ui/react-switch` which provides:
- Full keyboard navigation
- ARIA attributes
- Screen reader support
- Focus management

## Browser Compatibility

### ThemeSwitch
- Works in all modern browsers
- No special requirements

### ThemeSwitchFlowGlass
- Requires WebGL2 support
- Falls back gracefully if WebGL is unavailable
- Respects `prefers-reduced-motion` setting
- Optimized for performance (capped at 60fps)

## Customization

### Styling
Both components accept a `className` prop for custom styling. They use Tailwind CSS classes and can be easily customized.

### Colors
The components automatically adapt to your theme:
- Light mode: Warm tones
- Dark mode: Cool tones

To customize colors, edit the shader code in `theme-switch-flow-glass.jsx` or the Tailwind classes in `theme-switch.jsx`.

## Performance

### ThemeSwitch
- Minimal performance impact
- Uses CSS transitions
- No JavaScript animations

### ThemeSwitchFlowGlass
- WebGL rendering (GPU accelerated)
- Optimized shaders
- RequestAnimationFrame loop
- Automatic cleanup on unmount
- Resolution capped at 2x device pixel ratio

## Support

For issues or questions:
1. Check browser console for WebGL errors (FlowGlass version)
2. Verify all dependencies are installed
3. Ensure theme context is properly set up in App.js
