import React from 'react';

const Loader = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-primary-500/20 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-slate-400 font-medium animate-pulse">Fetching video information...</p>
    </div>
  );
};

export default Loader;
