const fs = require('node:fs');
const path = require('node:path');

// Gerar SVG sofisticado para o ícone do App Saulo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Fundo Apple Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)"/>
  
  <!-- Círculo interno brilhante -->
  <circle cx="256" cy="256" r="180" fill="none" stroke="url(#glowGrad)" stroke-width="8" opacity="0.6"/>
  <circle cx="256" cy="256" r="140" fill="url(#coinGrad)" filter="url(#shadow)"/>
  
  <!-- Sifrão Elegante e Moderno -->
  <text x="256" y="305" font-family="-apple-system, SF Pro Display, Arial, sans-serif" font-size="160" font-weight="900" fill="#ffffff" text-anchor="middle" filter="url(#shadow)">$</text>
  
  <!-- Pequenas estrelas decorativas -->
  <circle cx="370" cy="150" r="10" fill="#38bdf8"/>
  <circle cx="140" cy="370" r="8" fill="#a78bfa"/>
</svg>`;

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('SVG icon gerado com sucesso!');
