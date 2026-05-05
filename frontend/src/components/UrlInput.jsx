import React, { useState } from 'react';
import { Link2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const UrlInput = ({ onFetch, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onFetch(url);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-3xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Link2 className={`w-6 h-6 transition-colors ${url ? 'text-primary-400' : 'text-slate-500'}`} />
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube video URL here..."
          className="input-field pl-14 pr-36 h-16 shadow-2xl"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="absolute right-2 top-2 bottom-2 btn-primary !px-5 !rounded-lg"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Fetch <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
      <p className="mt-4 text-center text-slate-500 text-sm">
        Supports YouTube videos, Shorts, and Live streams.
      </p>
    </motion.div>
  );
};

export default UrlInput;
