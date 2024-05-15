/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,js,ts,jsx,tsx}",
        "./dist/*.{html,js,ts,jsx,tsx}",
        "./src/**/*.html",
    ],
    theme: {
        extend: {
            colors: {
                'background': '#343741',
                'overlay': '#1f2126',
                'surface': '#1E1E1E',
                'muted': '#737373',
                'subtle': '#2c2e34',
                'text': '#fcfcfc',
                'accent': '#7474c7',
                'hover': '#5e5ebe',
            },
        },
    },
    plugins: [],
};
