// fonts/boldena.ts
import localFont from 'next/font/local';

const boldena = localFont({
    src: '../public/fonts/boldena.ttf',
    display: 'swap',
    weight: '400', // or "normal"
    style: 'normal',
    variable: '--font-boldena',
});

export default boldena;
