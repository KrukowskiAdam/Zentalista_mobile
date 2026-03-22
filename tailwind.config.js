const daisyui = require("daisyui");

// ============================================
// 🎨 THEME SWITCHER - zmień activeTheme na 'one' lub 'two'
// ============================================
const activeTheme = 'two';

const themes = {
  // OPTION ONE - Current dark theme
  one: {
    "dark-bg": "#030712",           // Main background
    "dark-card": "#111828",         // Tables/cards background
    "light-card": "#022873",        // Light mode card background
    "dark-border": "#1e2938",       // Borders
    "level-expert": "#ff8c02",      // Orange - logo, buttons
    "level-expert-progress": "#ff8c02b0",
    "level-learning": "#0ea5e9",    // Blue
    "level-mastered": "#02bf33",    // Green
    "button-disabled": "#acacac",
  },
  
  // OPTION TWO - New theme (customize here)
  two: {
   "dark-bg": "#030712",           // Main background
    "dark-card": "#111828",         // Tables/cards background
    "light-card": "#056CF2",        // Light mode card background
    "dark-border": "#1e2938",       // Borders
     "light-border": "#c3c3c3",       // Borders
    "level-expert": "#ff8c02",      // Orange - logo, buttons
    "level-expert-progress": "#ff8c02b0",
    "level-learning": "#0ea5e9",    // Blue
    "level-mastered": "#02bf33",    // Green
    "button-disabled": "#acacac",
  },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",
    "./public/scripts/**/*.js",
    "./functions/views/**/*.ejs",
    "./src/**/*.js",
  ],
  theme: {
    extend: {
      colors: themes[activeTheme],
      fontFamily: {
        'nunito': ['Nunito', 'sans-serif'],
        'fredoka': ['Fredoka', 'sans-serif'],
        'rubik': ['Rubik', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: ["dark"],
    base: true,
    styled: true,
    utils: true,
  },
  safelist: [
    "grid-cols-2",
    "grid-cols-3",
    "grid-cols-4",
    "grid-cols-5",
    "bg-dark-card",
    "bg-light-card",
    "bg-level-expert",
    "bg-level-learning",
    "bg-level-mastered",
  ],
};
