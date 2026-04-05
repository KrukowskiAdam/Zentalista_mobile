const daisyui = require("daisyui");

// ============================================
// 🎨 THEME SWITCHER - zmień Theme na 'one' | 'two' | 'three'
// ============================================
const activeTheme = 'one';

const themes = {
  // OPTION ONE - 5 base colors
  one: {
    "learning-app-design-1": "#232f34",
    "learning-app-design-2": "#344955",
    "learning-app-design-3": "#4a6572",
    "learning-app-design-4": "#0F9855",
    "learning-app-design-5": "#4081EC",
    "learning-app-design-6": "#D44235",
    "learning-app-design-7": "#f9aa33",

    // Individual exceptions
    "level-expert": "#ff8c02",      // Primary CTA accent
    "level-expert-progress": "#ff8c0299",
    "level-learning": "#0ea5e9",
    "level-mastered": "#02bf33",
    "light-border": "#c3c3c3",
    "button-disabled": "#acacac",
  },

  // OPTION TWO - 5 base colors
  two: {
    "learning-app-design-1": "#0439D9",
    "learning-app-design-2": "#011140",
    "learning-app-design-3": "#5086F2",
    "learning-app-design-4": "#758EBF",
    "learning-app-design-5": "#F2F2F2",

    // Individual exceptions
    "level-expert": "#ff8c02",      // Primary CTA accent
    "level-expert-progress": "#ffbf72",
    "level-learning": "#0ea5e9",
    "level-mastered": "#02bf33",
    "light-border": "#c3c3c3",
    "button-disabled": "#acacac",
  },

  // OPTION THREE - 5 base colors
  three: {
    "learning-app-design-1": "#F24171",
    "learning-app-design-2": "#03A65A",
    "learning-app-design-3": "#F2B705",
    "learning-app-design-4": "#F29F05",
    "learning-app-design-5": "#F21905",

    // Individual exceptions
    "level-expert": "#ff8c02",      // Primary CTA accent
    "level-expert-progress": "#ffbf72",
    "level-learning": "#0ea5e9",
    "level-mastered": "#02bf33",
    "light-border": "#c3c3c3",
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
};
