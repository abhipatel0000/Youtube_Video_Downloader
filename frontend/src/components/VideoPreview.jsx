import React from 'react';
import { motion } from 'framer-motion';
import { Clock, User, CircleCheck } from 'lucide-react';

const VideoPreview = ({ videoInfo }) => {
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card overflow-hidden"
    >
      <div className="md:flex">
        <div className="md:w-1/3 relative group">
          <img 
            src={videoInfo.thumbnail} 
            alt={videoInfo.title} 
            className="w-full h-full object-cover aspect-video md:aspect-square"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-primary-600/90 text-white px-3 py-1 rounded-full text-sm font-medium">
              Preview
            </span>
          </div>
        </div>
        <div className="p-6 md:w-2/3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-400 text-sm font-semibold uppercase tracking-wider mb-2">
              <CircleCheck className="w-4 h-4" />
              Video Found
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white line-clamp-2 leading-tight mb-4">
              {videoInfo.title}
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5">
              <User className="w-5 h-5 text-slate-500" />
              <div className="overflow-hidden">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Uploader</p>
                <p className="text-sm font-medium text-slate-200 truncate">{videoInfo.author}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5">
              <Clock className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Duration</p>
                <p className="text-sm font-medium text-slate-200">{formatDuration(videoInfo.duration)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoPreview;
