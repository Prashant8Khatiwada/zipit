import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Zap, 
  RefreshCw, 
  FolderTree, 
  ShieldCheck, 
  Cpu, 
  Layers 
} from 'lucide-react';

const features = [
  {
    title: 'On-the-fly ZIP Streaming',
    description: 'Compress files directly in the browser as they download. No server-side processing, no memory spikes.',
    icon: Zap,
  },
  {
    title: 'Resumable Downloads',
    description: 'IndexedDB-backed state tracking allows users to resume interrupted downloads even after a page reload.',
    icon: RefreshCw,
  },
  {
    title: 'Native Folder Support',
    description: 'Uses the File System Access API to recreate complex folder structures directly on the user\'s disk.',
    icon: FolderTree,
  },
  {
    title: 'OPFS Staging',
    description: 'High-performance buffering using the Origin Private File System for near-native disk write speeds.',
    icon: ShieldCheck,
  },
  {
    title: 'Multi-threaded Workers',
    description: 'Download and compression tasks are offloaded to Web Workers to keep the UI smooth and responsive.',
    icon: Cpu,
  },
  {
    title: 'Intelligent Backpressure',
    description: 'Automatic balancing of network fetch speed and disk write speed to prevent browser crashes.',
    icon: Layers,
  },
];

const steps = [
  { step: '01', title: 'Add URLs', description: 'Provide a list of direct file URLs or drag & drop files.' },
  { step: '02', title: 'Stream & Compress', description: 'Files are fetched in parallel and compressed on-the-fly.' },
  { step: '03', title: 'Save to Disk', description: 'Receive a single ZIP file or a structured folder instantly.' },
];

const codeSnippet = `import { createZipIt } from '@zipit/core';

const zipit = createZipIt({ concurrency: 4 });

zipit.add('https://api.com/photo.jpg', { 
  path: 'vacation/sunset.jpg' 
});

await zipit.start();
console.log('Download complete!');`;

export default function Landing() {
  return (
    <div className="bg-[#0A0A0F] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-24 px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8"
          >
            Download anything. <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              ZIP everything.
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            The framework-agnostic engine for client-side streaming downloads and on-the-fly ZIP generation. Build production-grade download experiences in minutes.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link 
              to="/app" 
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              Open Downloader
            </Link>
            <a 
              href="https://zipit.docs" 
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold text-lg transition-all"
            >
              Read Docs
            </a>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-4 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Killer Features</h2>
            <p className="text-gray-400">Engineered for performance, reliability, and scale.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="p-8 bg-white/5 border border-white/10 rounded-2xl hover:border-blue-500/50 transition-colors"
              >
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-6">
                  <f.icon className="text-blue-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400">A seamless pipeline from URL to disk.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((s, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="text-center"
              >
                <div className="text-6xl font-black text-white/5 mb-4">{s.step}</div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="py-24 px-4 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Developer First API</h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Integration shouldn't be a chore. ZipIt provides a clean, TypeSafe API that feels natural in any TypeScript environment. No more fighting with Blobs and manual Stream management.
              </p>
              <ul className="space-y-4">
                {['Zero dependencies', 'Fully typed', 'Event-driven', 'React hooks included'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="bg-[#010101] p-1 rounded-2xl border border-white/10 shadow-2xl"
            >
              <div className="flex gap-1.5 p-4 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <pre className="p-6 text-sm font-mono overflow-x-auto text-blue-300">
                <code>{codeSnippet}</code>
              </pre>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto p-12 bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl shadow-2xl shadow-blue-500/20">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Ready to streamline your downloads?</h2>
          <p className="text-blue-100 mb-10 text-lg">Join 0+ developers building faster web experiences.</p>
          <Link 
            to="/app" 
            className="px-10 py-4 bg-white text-blue-600 hover:bg-gray-100 rounded-xl font-bold text-lg transition-all active:scale-95 inline-block"
          >
            Start Building for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
