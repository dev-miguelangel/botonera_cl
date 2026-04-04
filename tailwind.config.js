/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: { extend: {} },
  safelist: [
    { pattern: /^bg-(indigo|violet|blue|sky|emerald|teal|amber|orange|rose|red)-(100|600|700)$/ },
    { pattern: /^shadow-(indigo|violet|blue|sky|emerald|teal|amber|orange|rose|red)-200$/ },
    { pattern: /^ring-(indigo|violet|blue|sky|emerald|teal|amber|orange|rose|red)-500$/ },
    { pattern: /^text-(indigo|violet|blue|sky|emerald|teal|amber|orange|rose|red)-600$/ },
    { pattern: /^border-(indigo|violet|blue|sky|emerald|teal|amber|orange|rose|red)-300$/ },
    {
      pattern: /^bg-(indigo|violet|blue|sky|emerald|teal|amber|orange|rose|red)-700$/,
      variants: ['hover', 'active'],
    },
  ],
  plugins: [],
};
