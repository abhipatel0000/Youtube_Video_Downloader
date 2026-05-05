import React, { useState, useRef } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import UrlInput from './components/UrlInput';
import VideoPreview from './components/VideoPreview';
import FormatSelector from './components/FormatSelector';
import DownloadButton from './components/DownloadButton';
import ProgressBar from './components/ProgressBar';
import Loader from './components/Loader';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ShieldCheck, Zap, Globe, CircleCheck } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [videoInfo, setVideoInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [error, setError] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('idle');
  const [url, setUrl] = useState('');

  // Progress state fed by SSE stream
  const [progress, setProgress] = useState({ status: 'idle', percent: 0, speed: '', eta: '' });
  const sseRef = useRef(null); // holds the active EventSource
  const sseClosedIntentionally = useRef(false); // prevents onerror from firing on deliberate close

  // ── fetch info ────────────────────────────────────────────────
  const fetchVideoInfo = async (videoUrl) => {
    setIsLoading(true);
    setError(null);
    setVideoInfo(null);
    setDownloadStatus('idle');
    setProgress({ status: 'idle', percent: 0, speed: '', eta: '' });
    setUrl(videoUrl);

    try {
      const response = await axios.post(`${API_BASE_URL}/get-info`, { url: videoUrl });
      setVideoInfo(response.data);
      if (response.data.formats?.length > 0) {
        setSelectedFormat(response.data.formats[0]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch video information. Please check the URL.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── download ─────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!videoInfo || !selectedFormat) return;

    // Close any previous SSE connection
    if (sseRef.current) {
      sseClosedIntentionally.current = true;
      sseRef.current.close();
      sseRef.current = null;
    }
    sseClosedIntentionally.current = false;

    setIsDownloading(true);
    setDownloadStatus('idle');
    setError(null);
    setProgress({ status: 'starting', percent: 0, speed: '', eta: '' });

    try {
      // Step 1 – kick off the download job, get a download_id back immediately
      const { data } = await axios.post(`${API_BASE_URL}/download`, {
        url,
        format_id: selectedFormat.format_id,
        ext: selectedFormat.ext,
        title: videoInfo.title,
      });

      const { download_id } = data;

      // Step 2 – open SSE stream for progress updates
      const sse = new EventSource(`${API_BASE_URL}/progress/${download_id}`);
      sseRef.current = sse;

      sse.onmessage = async (event) => {
        const entry = JSON.parse(event.data);
        setProgress({
          status:  entry.status,
          percent: entry.percent ?? 0,
          speed:   entry.speed  ?? '',
          eta:     entry.eta    ?? '',
          error:   entry.error  ?? null,
        });

        if (entry.status === 'done') {
          sseClosedIntentionally.current = true;
          sse.close();
          sseRef.current = null;

          // Step 3 – fetch the finished file from the server
          try {
            const fileResponse = await axios.get(`${API_BASE_URL}/file/${download_id}`, {
              responseType: 'blob',
            });

            const blobUrl  = window.URL.createObjectURL(new Blob([fileResponse.data]));
            const link     = document.createElement('a');
            link.href      = blobUrl;
            const safeTitle = videoInfo.title.replace(/[^a-z0-9]/gi, '_');
            link.setAttribute('download', `${safeTitle}.${selectedFormat.ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);

            setDownloadStatus('success');
            // Auto-hide progress bar after 4 seconds
            setTimeout(() => {
              setProgress({ status: 'idle', percent: 0, speed: '', eta: '' });
              setDownloadStatus('idle');
            }, 4000);
          } catch (fetchErr) {
            console.error(fetchErr);
            setDownloadStatus('error');
            setError('File transfer failed after download completed.');
          } finally {
            setIsDownloading(false);
          }
        }

        if (entry.status === 'error') {
          sseClosedIntentionally.current = true;
          sse.close();
          sseRef.current = null;
          setDownloadStatus('error');
          setError(entry.error || 'Download failed. Try a different format.');
          setIsDownloading(false);
        }
      };

      sse.onerror = () => {
        // Ignore errors caused by our own intentional close()
        if (sseClosedIntentionally.current) {
          sseClosedIntentionally.current = false;
          return;
        }
        sse.close();
        sseRef.current = null;
        setDownloadStatus('error');
        setError('Lost connection to the download server. Please retry.');
        setIsDownloading(false);
        setProgress(p => ({ ...p, status: 'error' }));
      };

    } catch (err) {
      console.error(err);
      setDownloadStatus('error');
      setError(err.response?.data?.detail || 'Download failed. Some formats might not be available for this video.');
      setIsDownloading(false);
      setProgress({ status: 'idle', percent: 0, speed: '', eta: '' });
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20">
      <Navbar />

      <main className="container mx-auto px-6 pt-32 md:pt-40 max-w-5xl">
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-primary-200 to-primary-500"
          >
            Video Downloads, <br /> Made Simple.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto"
          >
            High-speed YouTube downloader for videos and MP3s. Paste your link below to get started.
          </motion.p>
        </div>

        <UrlInput onFetch={fetchVideoInfo} isLoading={isLoading} />

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error-banner"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isLoading && <Loader key="loader" />}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {videoInfo && !isLoading && (
            <motion.div
              key="video-panel"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              <div className="space-y-8">
                <VideoPreview videoInfo={videoInfo} />
                <div className="hidden lg:block">
                  <Features />
                </div>
              </div>

              <div className="space-y-4">
                <FormatSelector
                  formats={videoInfo.formats}
                  selectedFormat={selectedFormat}
                  onSelect={setSelectedFormat}
                />
                <DownloadButton
                  onClick={handleDownload}
                  isLoading={isDownloading}
                  status={downloadStatus}
                />
                {/* ── Live progress bar ── */}
                <ProgressBar
                  status={progress.status}
                  percent={progress.percent}
                  speed={progress.speed}
                  eta={progress.eta}
                  error={progress.error}
                />
              </div>

              <div className="lg:hidden">
                <Features />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!videoInfo && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-yellow-400" />}
              title="Lightning Fast"
              desc="Optimized processing ensures you get your files in seconds."
            />
            <FeatureCard
              icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
              title="Secure & Private"
              desc="No logs, no tracking. Your downloads are your business."
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6 text-primary-400" />}
              title="Global Support"
              desc="Download from any region with high-quality encoding."
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}

const FeatureCard = ({ icon, title, desc }) => (
  <div className="p-6 glass-card border-white/5 hover:border-primary-500/30 transition-colors group">
    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-500/10 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-500">{desc}</p>
  </div>
);

const Features = () => (
  <div className="p-6 glass-card bg-primary-900/10 border-primary-500/20">
    <h4 className="font-bold text-primary-400 mb-3 flex items-center gap-2">
      <Zap className="w-4 h-4" />
      Why QuickTube?
    </h4>
    <ul className="space-y-2 text-sm text-slate-400">
      <li className="flex items-start gap-2">
        <CircleCheck className="w-4 h-4 text-primary-500 mt-0.5" />
        No intrusive ads or popups
      </li>
      <li className="flex items-start gap-2">
        <CircleCheck className="w-4 h-4 text-primary-500 mt-0.5" />
        Highest quality available (up to 4K)
      </li>
      <li className="flex items-start gap-2">
        <CircleCheck className="w-4 h-4 text-primary-500 mt-0.5" />
        Permanent MP3 conversion
      </li>
      <li className="flex items-start gap-2">
        <CircleCheck className="w-4 h-4 text-primary-500 mt-0.5" />
        Mobile-friendly responsive design
      </li>
    </ul>
  </div>
);

export default App;
