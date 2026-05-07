import { useState, useCallback } from 'react';
import { useZipIt, ZipItUI } from '@khatiwadaprashant/zipit-react';
import { Plus, Download } from 'lucide-react';

export default function Downloader() {
  const zipIt = useZipIt({ concurrency: 4 });
  const [urlInput, setUrlInput] = useState('');

  const handleAddUrls = useCallback(() => {
    if (!urlInput.trim()) return;

    const urls = urlInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const fileDescriptors = urls.map(url => {
      try {
        const parsed = new URL(url);
        const filename = parsed.pathname.split('/').pop() || 'download';
        return {
          id: crypto.randomUUID(),
          url,
          path: filename,
          sizeBytes: undefined,
        };
      } catch (e) {
        console.warn('Invalid URL:', url);
        return null;
      }
    }).filter(Boolean) as any[];

    zipIt.addFiles(fileDescriptors);
    setUrlInput('');
  }, [urlInput, zipIt]);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Add URLs to ZIP</h2>
        <p className="text-gray-400 text-sm">
          Paste a list of direct file URLs (one per line). They will be streamed directly into a ZIP file in your browser.
        </p>
        <div className="relative">
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image1.jpg&#10;https://example.com/video.mp4"
            className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono"
          />
        </div>
        <div className="flex justify-end gap-4">
          <button
            onClick={handleAddUrls}
            disabled={!urlInput.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add to Queue
          </button>
          <button
            onClick={() => zipIt.start()}
            disabled={zipIt.files.size === 0 || zipIt.isRunning}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Start ZIP Download
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-12">
        <ZipItUI value={zipIt} zipName="my-archive.zip" />
      </div>
    </div>
  );
}
