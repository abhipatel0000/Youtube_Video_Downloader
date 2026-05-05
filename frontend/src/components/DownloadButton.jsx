import React from 'react';
import { Download, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DownloadButton = ({ onClick, isLoading, status }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`w-full py-5 rounded-2xl font-bold text-xl transition-all duration-500 flex items-center justify-center gap-3 overflow-hidden relative ${
        status === 'success' 
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
          : status === 'error'
          ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
          : 'bg-primary-600 hover:bg-primary-500 text-white shadow-xl shadow-primary-900/30'
      }`}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Processing Media...</span>
          </motion.div>
        ) : status === 'success' ? (
          <motion.div 
            key="success"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3"
          >
            <Check className="w-6 h-6" />
            <span>Download Started!</span>
          </motion.div>
        ) : status === 'error' ? (
          <motion.div 
            key="error"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3"
          >
            <AlertCircle className="w-6 h-6" />
            <span>Failed to Download</span>
          </motion.div>
        ) : (
          <motion.div 
            key="idle"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3"
          >
            <Download className="w-6 h-6" />
            <span>Download Now</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isLoading && (
        <motion.div 
          className="absolute bottom-0 left-0 h-1 bg-white/40"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 15, ease: "linear" }}
        />
      )}
    </button>
  );
};

export default DownloadButton;
