import React from 'react';
import { Video, CodeXml } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="bg-primary-600 p-2 rounded-lg shadow-lg shadow-primary-900/40">
          <Video className="text-white w-6 h-6" />
        </div>
        <span className="text-2xl font-bold font-['Outfit'] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          QuickTube
        </span>
      </div>
      <div className="flex items-center gap-6">
        <a 
          href="https://github.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-white transition-colors"
        >
          <CodeXml className="w-5 h-5" />
        </a>
      </div>
    </nav>
  );
};

export default Navbar;
