Design and implement the landing page at apps/web/src/pages/Landing.tsx.

Sections:
1. Hero: "Download anything. ZIP everything." — CTA button goes to /app
2. Feature Grid: 6 cards for the killer features (progress tracking, resumability, ZIP streaming, native folder support, backpressure, worker-first)
3. How It Works: 3-step visual (Add URLs → Download → ZIP saved to disk)
4. Code Example: Syntax-highlighted snippet showing 10-line integration
5. Footer: GitHub link, npm link, license

Design:
- Dark background matching ZipItUI (#0A0A0F)
- Animated gradient text on hero headline
- Feature cards with hover lift effect
- Use Framer Motion for scroll-triggered fade-in on each section
- Fully responsive

Do NOT use any UI kit. Hand-code all styles in Tailwind. Be bold with the design.