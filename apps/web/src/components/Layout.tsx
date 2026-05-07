import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col font-sans">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0F]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            ZipIt
          </Link>
          <nav className="flex items-center gap-8 text-sm font-medium">
            <Link to="/app" className="hover:text-blue-400 transition-colors">App</Link>
            <Link to="/docs" className="hover:text-blue-400 transition-colors">Docs</Link>
            <a href="https://github.com/khatiwadaprashant/zipit" className="px-4 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors">
              GitHub
            </a>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-sm text-gray-500">
            © 2026 DropStream / ZipIt. Built with OPFS & fflate.
          </div>
          <div className="flex gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
