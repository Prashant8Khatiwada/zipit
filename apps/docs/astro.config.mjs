import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'ZipIt',
      social: {
        github: 'https://github.com/khatiwadaprashant/zipit',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', link: '/getting-started/installation/' },
            { label: 'Quick Start', link: '/getting-started/quick-start/' },
          ],
        },
        {
          label: 'Core API',
          items: [{ autogenerate: { directory: 'core-api' } }],
        },
        {
          label: 'React API',
          items: [{ autogenerate: { directory: 'react-api' } }],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Large Files (>4GB)', link: '/guides/large-files/' },
            { label: 'Vanilla JS usage', link: '/guides/vanilla-js/' },
            { label: 'Custom Progress UI', link: '/guides/custom-ui/' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
