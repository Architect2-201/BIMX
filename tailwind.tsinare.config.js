/** Tsinare page config. No forms plugin: that page's CDN build did not load it. */
module.exports = {
  darkMode: 'class',
  content: ['./tsinare.html', './tsinare.js'],
  theme: {
  "extend": {
    "colors": {
      "brand": {
        "50": "#f0f9ff",
        "400": "#38bdf8",
        "500": "#0ea5e9",
        "600": "#0284c7",
        "cyan": "#00f2fe",
        "neon": "#00f0ff"
      },
      "surface": {
        "base": "#080d1a",
        "panel": "#0e1626",
        "card": "#141e33",
        "border": "#1f2e4d",
        "hover": "#243557"
      }
    },
    "fontFamily": {
      "sans": [
        "Inter",
        "sans-serif"
      ],
      "mono": [
        "JetBrains Mono",
        "monospace"
      ]
    }
  }
},
  plugins: []
};
