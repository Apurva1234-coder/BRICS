# Mobile UI Guidelines

The CleanAir Sentinel platform was designed with a mobile-first philosophy because most citizen reports will be submitted from the field using mobile devices.

## Design Decisions

### Bottom Navigation & Drawers
On desktop, the navigation and filters are placed in a side workspace rail (`workspace-rail`). On mobile screens (width < 768px), these elements transition to:
1. **Bottom Navigation Bar**: Allowing easy thumb-reach for core tabs (Map, Reports, Dashboard).
2. **Bottom Sheet Panels**: Detailed view panes for situations slide up from the bottom rather than crowding the horizontal space.

### Touch Targets
All actionable elements follow the minimum 44x44px touch target rule:
- Filter chips (`filter-chip`) are padded.
- Primary buttons (`primary-button`) have a minimum height to ensure comfortable tapping without misclicks.

### Map Interactions
The Leaflet map uses explicit zoom controls, but on mobile, dual-finger panning and pinch-to-zoom are seamlessly enabled without layout-shift interference from the surrounding UI blocks.

### Performance
Heavy CSS blurs (`backdrop-filter: blur()`) are optimized in `styles.css`. If performance lags on low-end devices, these degradations fallback to solid colors cleanly.
