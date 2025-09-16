import type { Config } from 'tailwindcss'


const config: Config = {
content: [
'./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
'./src/components/**/*.{js,ts,jsx,tsx,mdx}',
'./src/app/**/*.{js,ts,jsx,tsx,mdx}',
],
theme: {
extend: {
colors: {
brand: {
50: '#eef6ff',
100: '#d9ebff',
200: '#b7d8ff',
300: '#8bbfff',
400: '#5ea2ff',
500: '#3a86ff',
600: '#2367db',
700: '#1a4faa',
800: '#173f87',
900: '#142f66'
}
}
}
},
plugins: []
}


export default config