import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "ZipIt",
  description: "High-performance client-side ZIP streaming and batch download engine.",
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Demo', link: 'https://zipit.dev' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is ZipIt?', link: '/guide/what-is-zipit' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Browser Support', link: '/guide/browser-support' },
        ]
      },
      {
        text: 'Core Engine',
        items: [
          { text: 'Download Orchestration', link: '/guide/orchestration' },
          { text: 'OPFS Staging', link: '/guide/opfs' },
          { text: 'ZIP Streaming', link: '/guide/zip-streaming' },
        ]
      },
      {
        text: 'Frameworks',
        items: [
          { text: 'React Hooks', link: '/guide/react' },
          { text: 'Vue Composables', link: '/guide/vue' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Prashant8Khatiwada/zipit' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Prashant Khatiwada'
    }
  }
})
