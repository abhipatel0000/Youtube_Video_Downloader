import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Props
 * ─────
 * status   : 'idle' | 'starting' | 'downloading' | 'processing' | 'done' | 'error'
 * percent  : 0–100
 * speed    : string  e.g. "3.20 MiB/s"
 * eta      : string  e.g. "00:42"
 * error    : string | null
 */
const ProgressBar = ({ status, percent = 0, speed = '', eta = '', error = null }) => {
  if (status === 'idle') return null;

  const isActive = status === 'downloading' || status === 'starting' || status === 'processing';
  const isDone   = status === 'done';
  const isError  = status === 'error';

  // Colour palette per stage
  const trackColour = isError
    ? 'bg-red-500/20'
    : isDone
    ? 'bg-emerald-500/20'
    : 'bg-primary-500/20';

  const fillColour = isError
    ? 'bg-gradient-to-r from-red-600 to-red-400'
    : isDone
    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
    : status === 'processing'
    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
    : 'bg-gradient-to-r from-primary-600 via-primary-400 to-violet-400';

  // During "processing" we show an indeterminate pulse
  const displayPct = isDone ? 100 : isError ? 0 : percent;

  const statusLabel = {
    starting:    'Connecting…',
    downloading: 'Downloading',
    processing:  'Merging & Encoding…',
    done:        'Download Complete!',
    error:       'Download Failed',
  }[status] ?? '';

  const StatusIcon = isError
    ? AlertTriangle
    : isDone
    ? CheckCircle2
    : status === 'processing'
    ? Zap
    : Loader2;

  return (
    <AnimatePresence>
      <motion.div
        key="progress-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="mt-4 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-md p-5 space-y-3"
        style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between text-sm font-medium">
          <span className={`flex items-center gap-2 ${isError ? 'text-red-400' : isDone ? 'text-emerald-400' : 'text-slate-300'}`}>
            <StatusIcon
              className={`w-4 h-4 ${isActive && !isDone ? 'animate-spin' : ''}`}
              style={status === 'processing' ? { animation: 'none' } : undefined}
            />
            {statusLabel}
          </span>

          <span className={`tabular-nums font-bold text-base ${isError ? 'text-red-400' : isDone ? 'text-emerald-400' : 'text-white'}`}>
            {isError ? '—' : `${displayPct}%`}
          </span>
        </div>

        {/* Progress track */}
        <div className={`relative h-3 w-full rounded-full overflow-hidden ${trackColour}`}>
          {status === 'processing' ? (
            // Indeterminate shimmer for the post-download merge step
            <motion.div
              className={`absolute inset-y-0 w-1/3 rounded-full ${fillColour}`}
              animate={{ left: ['0%', '100%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ translateX: '-100%' }}
            />
          ) : (
            <motion.div
              className={`h-full rounded-full ${fillColour} relative overflow-hidden`}
              initial={{ width: 0 }}
              animate={{ width: `${displayPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Shimmer overlay */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </motion.div>
          )}
        </div>

        {/* Speed & ETA */}
        {status === 'downloading' && (speed || eta) && (
          <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
            {speed && <span>⚡ {speed}</span>}
            {eta   && <span>ETA {eta}</span>}
          </div>
        )}

        {/* Error message */}
        {isError && error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default ProgressBar;
