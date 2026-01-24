import React, { useEffect, useState } from 'react';

interface GenerationProgressBarProps {
  current: number;
  total: number;
  statusText: string;
  startTime: number | null;
}

const GenerationProgressBar: React.FC<GenerationProgressBarProps> = ({
  current,
  total,
  statusText,
  startTime
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!startTime) {
      setElapsedTime(0);
      setEstimatedTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      setElapsedTime(elapsed);

      // Calculate estimated time remaining based on average time per post
      if (current > 0 && current < total && total > 0) {
        const avgTimePerPost = elapsed / current;
        const remainingPosts = total - current;
        const estimated = avgTimePerPost * remainingPosts;
        setEstimatedTimeRemaining(Math.max(0, estimated));
      } else if (current >= total && total > 0) {
        // All posts completed, show final time
        setEstimatedTimeRemaining(0);
      }
    }, 100); // Update every 100ms for smooth progress

    return () => clearInterval(interval);
  }, [startTime, current, total]);

  const progress = total > 0 && current >= 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Progress Bar */}
      <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full transition-all duration-300 ease-out shadow-lg"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Status Info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="font-bold text-slate-700">{statusText}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-600">
          <span className="font-medium">
            {current} / {total}
          </span>
          {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
            <span className="text-xs font-medium">
              ~{formatTime(estimatedTimeRemaining)} remaining
            </span>
          )}
          {elapsedTime > 0 && (
            <span className="text-xs text-slate-500">
              {formatTime(elapsedTime)} elapsed
            </span>
          )}
        </div>
      </div>

      {/* Progress Percentage */}
      <div className="text-center">
        <span className="text-2xl font-black text-indigo-600">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export default GenerationProgressBar;

