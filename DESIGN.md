---
name: BIMX Architectural Intelligence
colors:
  surface: '#101319'
  surface-dim: '#101319'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#272a2f'
  surface-container-highest: '#32353a'
  on-surface: '#e1e2e9'
  on-surface-variant: '#c4c7cb'
  inverse-surface: '#e1e2e9'
  inverse-on-surface: '#2e3036'
  outline: '#8e9195'
  outline-variant: '#44474b'
  surface-tint: '#bcc8d4'
  primary: '#ffffff'
  on-primary: '#26323b'
  primary-container: '#d8e4f1'
  on-primary-container: '#5a6671'
  inverse-primary: '#54606b'
  secondary: '#a1cced'
  on-secondary: '#00344d'
  secondary-container: '#1d4b67'
  on-secondary-container: '#90badb'
  tertiary: '#ffffff'
  on-tertiary: '#11334b'
  tertiary-container: '#cce5ff'
  on-tertiary-container: '#496782'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e4f1'
  primary-fixed-dim: '#bcc8d4'
  on-primary-fixed: '#111d26'
  on-primary-fixed-variant: '#3d4852'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#a1cced'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#1d4b67'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#abcae8'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#2b4a63'
  background: '#101319'
  on-background: '#e1e2e9'
  surface-variant: '#32353a'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '600'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  technical-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.08em
  data-metric:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system defines a high-end, cinematic dark environment tailored for architectural artificial intelligence, parametric engineering, and spatial computing. The aesthetic fuses Swiss modernist typography with the razor-sharp precision of advanced CAD, BIM, and GIS tools (such as Rhino, Archicad, and Cesium) combined with the polished utility of modern developer software.

The emotional core is structural authority, surgical precision, and restrained luxury. It avoids neon gamification in favor of an understated, deep graphite palette accented with cold architectural blues and subtle luminescent glows. Layouts prioritize spatial clarity, generous architectural negative space, and disciplined 1px geometric gridlines that evoke blueprinted structural drawings and elevation models.

## Colors
The color foundation is built on deep structural darks punctuated by pale, blueprint-grade cold tints:

- **Canvas & Backdrops:**
  - Base Ground: `#080A0D` (void black substrate)
  - Secondary / Paneling: `#101318` (deep graphite for viewports and sidebars)
  - Elevated Cards / Floating Palettes: `#151A20` (dense carbon surface)
- **Structural Outlines:**
  - Architectural Borders: `#252B33` (crisp 1px hairline delimiters)
  - Focused / Active Lines: `#3D4754`
- **Text & Readouts:**
  - Primary Text: `#F5F7FA` (pure readability, architectural crispness)
  - Secondary Text: `#9BA3AE` (technical specs, dimension text)
  - Muted Text: `#626B76` (coordinates, metadata, structural IDs)
- **Accents & AI Semantics:**
  - Primary Accent: `#DCE8F5` (crisp architectural light blue highlight)
  - Secondary Accent: `#7FA9C9` (technical CAD/GIS vector blue)
  - Generative / AI Accent: `#A8C7E5` (subtle cold luminescence with soft diffusion)
- **Muted Functional Statuses:**
  - Success: `#8FB89A` (sage green)
  - Warning: `#C7A875` (amber brass)
  - Error: `#C97878` (desaturated structural crimson)

## Typography
Typography reflects the discipline of architectural drafting rooms. Headings and primary copy leverage **Inter** with tight negative tracking, mirroring Swiss rationalism and technical design applications. 

Metadata, coordinate tags, generative token outputs, and CAD measurement specs utilize **JetBrains Mono**. Label caps are set in tracked uppercase to echo architectural title blocks, layer identifiers, and schematic documentation.

## Layout & Spacing
A strict 8-point baseline system governs all spacing and alignment.
- **Grid Architecture:** Desktop views feature a fluid 12-column grid system paired with fixed-width docking sidebars (280px–360px) for parametric model inspection and AI synthesis prompts.
- **Negative Space:** Viewports and 3D architectural stages retain generous negative space, keeping workspace density focused inside modular, docked, or hovering tool arrays.
- **Breakpoints:**
  - `Desktop (>= 1280px)`: Full viewport spanning, three-pane architectural inspector layout, 24px gutter, 32px canvas margin.
  - `Tablet (768px - 1279px)`: Collapsible drawer inspectors, 16px gutter, 24px canvas margin.
  - `Mobile (< 768px)`: Single-column stack, bottom-sheet controls, 12px gutter, 16px canvas margin.

## Elevation & Depth
Depth in this design system is architectural, flat, and planar rather than bulbous or heavy with drop shadows:
- **Hairline Framing:** Visual separation is driven by crisp 1px borders (`#252B33`).
- **Tonal Stratification:** Depth climbs from `#080A0D` (canvas floor) to `#101318` (structural panes) to `#151A20` (interactive cards and floating inspectors).
- **Subtle Ambient Shadows:** Floating panels over 3D model viewports employ an understated shadow: `0 8px 32px rgba(0, 0, 0, 0.45)`.
- **AI Luminescent Glow:** When artificial intelligence operations are active, panels and indicators utilize a cold blue outer aura: `box-shadow: 0 0 20px -4px rgba(168, 199, 229, 0.12)`.

## Shapes
The shape language delivers a balanced harmony between architectural geometry and refined hardware ergonomics:
- **Structural Cards & Panels:** Standardized between 16px and 22px (`rounded-lg` to `rounded-xl`) corner radius, creating a smooth modern silhouette against the deep backdrop.
- **Interactive Triggers & Inputs:** Standardized between 12px and 16px radius for buttons, input bars, and segment pills.
- **Data Tags & Chips:** Rounded corners at 8px to 10px, retaining architectural precision without harsh 90-degree points.

## Components

### Buttons
- **Primary:** Surface filled with `#DCE8F5`, text `#080A0D` (bold, high-contrast monochrome inversion), 14px border radius, height 40px, padding `0 18px`. Hover: `#FFFFFF` with faint glow.
- **Secondary / CAD Action:** Surface `#151A20`, border `1px solid #252B33`, text `#F5F7FA`. Hover: border `#7FA9C9`, background `#101318`.
- **AI Synthesis Trigger:** Subtle gradient `#151A20` to `#101318`, border `1px solid #A8C7E5`, text `#DCE8F5`, subtle `rgba(168, 199, 229, 0.15)` internal illumination.

### Input Fields & Search Bars
- Background `#101318`, border `1px solid #252B33`, radius 12px, text `#F5F7FA`, placeholder `#626B76`.
- Focus state: border `1px solid #7FA9C9` with zero offset outline. Monospace typography (`JetBrains Mono`) for coordinate, dimension, and prompt inputs.

### Cards & Viewport Overlays
- Background `#151A20`, border `1px solid #252B33`, radius 18px.
- Internal headers include uppercase tracked label identifiers (`label-caps`) alongside technical metadata readouts.

### Chips & Badges
- Height 24px, radius 8px, background `#101318`, border `1px solid #252B33`, typography `technical-code`.
- AI Status variant: text `#A8C7E5`, border `rgba(168, 199, 229, 0.3)`, indicator dot `#A8C7E5` with pulse animation.

### Checkboxes & Segmented Controls
- Checkboxes: 16x16px square, radius 4px, border `1px solid #3D4754`, checked background `#DCE8F5` with `#080A0D` icon.
- Segmented switches: Docked pill array within `#101318` border enclosure; active tab rests on `#151A20` with `#F5F7FA` text and hairline border `#252B33`.

### Specialized BIM / GIS Toolbars
- Floating HUD arrays anchored to viewport edges: background `rgba(21, 26, 32, 0.85)` with `backdrop-filter: blur(16px)`, border `1px solid #252B33`, rounded-xl (20px) frame housing vector camera controls, layer locks, and parametric generative sliders.