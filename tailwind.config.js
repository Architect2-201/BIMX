/** Generated from the in-page Tailwind Play config (v3.4.17). Prebuilt so production does not load cdn.tailwindcss.com. */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './apps.html',
    './plugins.html',
    './land-intelligence.html',
    './parcel-ai.html',
    './main.js',
    './translations.js',
    './land-intelligence.js',
    './parcel-ai.js'
  ],
  theme: {
  "extend": {
    "colors": {
      "on-error-container": "#ffdad6",
      "on-primary-container": "#5a6671",
      "surface-tint": "#bcc8d4",
      "on-tertiary-container": "#496782",
      "surface-dim": "#101319",
      "on-surface-variant": "#c4c7cb",
      "outline-variant": "#44474b",
      "outline": "#8e9195",
      "on-secondary": "#00344d",
      "surface-container-high": "#272a2f",
      "inverse-on-surface": "#2e3036",
      "secondary-fixed-dim": "#a1cced",
      "on-background": "#e1e2e9",
      "on-surface": "#e1e2e9",
      "primary-fixed": "#d8e4f1",
      "on-tertiary": "#11334b",
      "surface": "#101319",
      "surface-container-highest": "#32353a",
      "primary": "#ffffff",
      "surface-container-lowest": "#0b0e13",
      "on-tertiary-fixed-variant": "#2b4a63",
      "tertiary": "#ffffff",
      "on-secondary-fixed-variant": "#1d4b67",
      "tertiary-fixed": "#cce5ff",
      "on-primary-fixed-variant": "#3d4852",
      "on-error": "#690005",
      "on-primary": "#26323b",
      "secondary": "#a1cced",
      "on-tertiary-fixed": "#001d31",
      "surface-container-low": "#191c21",
      "inverse-surface": "#e1e2e9",
      "tertiary-fixed-dim": "#abcae8",
      "error": "#ffb4ab",
      "surface-variant": "#32353a",
      "on-secondary-container": "#90badb",
      "surface-bright": "#36393f",
      "secondary-container": "#1d4b67",
      "on-primary-fixed": "#111d26",
      "surface-container": "#1d2025",
      "primary-container": "#d8e4f1",
      "inverse-primary": "#54606b",
      "on-secondary-fixed": "#001e2f",
      "error-container": "#93000a",
      "primary-fixed-dim": "#bcc8d4",
      "tertiary-container": "#cce5ff",
      "background": "#101319",
      "secondary-fixed": "#c9e6ff"
    },
    "borderRadius": {
      "DEFAULT": "0.25rem",
      "lg": "0.5rem",
      "xl": "0.75rem",
      "full": "9999px"
    },
    "spacing": {
      "margin": "2rem",
      "space-xs": "0.25rem",
      "margin-mobile": "1rem",
      "space-md": "1rem",
      "space-sm": "0.5rem",
      "gutter": "1.5rem",
      "gutter-mobile": "0.75rem",
      "space-lg": "1.5rem",
      "space-xl": "2.5rem"
    },
    "fontFamily": {
      "label-caps": [
        "JetBrains Mono"
      ],
      "headline-md": [
        "Inter"
      ],
      "body-lg": [
        "Inter"
      ],
      "headline-sm": [
        "Inter"
      ],
      "body-md": [
        "Inter"
      ],
      "technical-code": [
        "JetBrains Mono"
      ],
      "headline-lg": [
        "Inter"
      ],
      "display-hero": [
        "Inter"
      ],
      "body-sm": [
        "Inter"
      ],
      "display-hero-mobile": [
        "Inter"
      ],
      "data-metric": [
        "JetBrains Mono"
      ]
    },
    "fontSize": {
      "label-caps": [
        "11px",
        {
          "lineHeight": "14px",
          "letterSpacing": "0.08em",
          "fontWeight": "500"
        }
      ],
      "headline-md": [
        "24px",
        {
          "lineHeight": "32px",
          "letterSpacing": "-0.015em",
          "fontWeight": "500"
        }
      ],
      "body-lg": [
        "16px",
        {
          "lineHeight": "24px",
          "letterSpacing": "-0.005em",
          "fontWeight": "400"
        }
      ],
      "headline-sm": [
        "18px",
        {
          "lineHeight": "26px",
          "letterSpacing": "-0.01em",
          "fontWeight": "500"
        }
      ],
      "body-md": [
        "14px",
        {
          "lineHeight": "20px",
          "letterSpacing": "0em",
          "fontWeight": "400"
        }
      ],
      "technical-code": [
        "12px",
        {
          "lineHeight": "16px",
          "letterSpacing": "0.02em",
          "fontWeight": "400"
        }
      ],
      "headline-lg": [
        "32px",
        {
          "lineHeight": "40px",
          "letterSpacing": "-0.02em",
          "fontWeight": "600"
        }
      ],
      "display-hero": [
        "56px",
        {
          "lineHeight": "64px",
          "letterSpacing": "-0.03em",
          "fontWeight": "600"
        }
      ],
      "body-sm": [
        "12px",
        {
          "lineHeight": "18px",
          "letterSpacing": "0.01em",
          "fontWeight": "400"
        }
      ],
      "display-hero-mobile": [
        "36px",
        {
          "lineHeight": "44px",
          "letterSpacing": "-0.02em",
          "fontWeight": "600"
        }
      ],
      "data-metric": [
        "20px",
        {
          "lineHeight": "24px",
          "letterSpacing": "-0.02em",
          "fontWeight": "600"
        }
      ]
    }
  }
},
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
};
