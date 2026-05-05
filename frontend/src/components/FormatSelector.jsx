import React from 'react';
import { Play, Music, Monitor, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const FormatSelector = ({ formats, selectedFormat, onSelect }) => {
  const getIcon = (resolution) => {
    if (resolution.includes('MP3')) return <Music className="w-5 h-5" />;
    const res = parseInt(resolution);
    if (res >= 1080) return <Monitor className="w-5 h-5" />;
    return <Play className="w-5 h-5" />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Download className="w-5 h-5 text-primary-500" />
        Select Download Format
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {formats.map((format) => (
          <motion.button
            key={format.format_id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(format)}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
              selectedFormat?.format_id === format.format_id
                ? 'bg-primary-600/20 border-primary-500 shadow-lg shadow-primary-900/20'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                selectedFormat?.format_id === format.format_id ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {getIcon(format.resolution)}
              </div>
              <div className="text-left">
                <p className="font-bold text-white">{format.resolution}</p>
                <p className="text-xs text-slate-500 uppercase tracking-tighter">
                  {format.ext} • {format.note || 'Standard'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-300">{formatSize(format.filesize)}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default FormatSelector;
