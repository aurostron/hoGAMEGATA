'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AUROSTRON_PROJECT_ASCII } from '@/lib/asciiArt';

interface MatrixAsciiBannerProps {
  asciiText?: string;
  href?: string;
  className?: string;
}

const GLYPHS = '0123456789ABCDEF:;*+-/\\|<>=~_[]{}!?@#$%^&';

export const MatrixAsciiBanner: React.FC<MatrixAsciiBannerProps> = ({
  asciiText = AUROSTRON_PROJECT_ASCII,
  href = 'https://github.com/aurostron',
  className = '',
}) => {
  const [displayText, setDisplayText] = useState<string>(asciiText);
  const [isGlitching, setIsGlitching] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  // Precompute lines, dimensions, and column delays for rain effect
  const { lines, numRows, numCols, colDelays } = useMemo(() => {
    const rawLines = asciiText.split('\n').filter((l) => l.length > 0);
    const maxLen = Math.max(...rawLines.map((l) => l.length));
    const padded = rawLines.map((l) => l.padEnd(maxLen, ' '));
    const rows = padded.length;
    const cols = maxLen;

    // Left-to-right cascade wave with pseudo-random jitter
    const delays: number[] = [];
    for (let c = 0; c < cols; c++) {
      const waveBase = (c / cols) * 0.42;
      const jitter = Math.sin(c * 19.7 + 3.3) * 0.12 + 0.12;
      delays.push(waveBase + jitter * 0.3);
    }

    return {
      lines: padded,
      numRows: rows,
      numCols: cols,
      colDelays: delays,
    };
  }, [asciiText]);

  // Generate a matrix rain / decode frame at given progress (0.0 to 1.0)
  const generateRainFrame = useCallback(
    (progress: number): string => {
      if (progress >= 1.0) return asciiText;

      const frameLines: string[] = [];
      const glyphsLen = GLYPHS.length;

      for (let r = 0; r < numRows; r++) {
        let rowStr = '';
        const line = lines[r];

        for (let c = 0; c < numCols; c++) {
          const origChar = line[c] || ' ';
          if (origChar === ' ') {
            rowStr += ' ';
            continue;
          }

          const delay = colDelays[c];
          // Time available for this column to fall: ~0.55 of total progress
          const colProgress = Math.max(0, (progress - delay) / 0.52);
          // Rain head position
          const rainHead = colProgress * (numRows + 4) - 2;

          if (colProgress <= 0) {
            // Ahead of rain wave: slight random flicker
            rowStr += Math.random() < 0.25 ? GLYPHS[Math.floor(Math.random() * glyphsLen)] : origChar;
          } else if (r > rainHead) {
            // Ahead of rain drop head: active scrambled matrix glyphs
            rowStr += GLYPHS[Math.floor(Math.random() * glyphsLen)];
          } else if (r >= rainHead - 2 && r <= rainHead) {
            // Rain drop head tip: active matrix glyph
            rowStr += GLYPHS[Math.floor(Math.random() * glyphsLen)];
          } else {
            // Behind rain head: settled back into the pristine original character
            rowStr += origChar;
          }
        }
        frameLines.push(rowStr);
      }

      return frameLines.join('\n');
    },
    [asciiText, colDelays, lines, numCols, numRows]
  );

  const triggerAnimation = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsGlitching(true);
    startTimeRef.current = performance.now();

    const duration = 1350; // ms total duration

    const step = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1.0, elapsed / duration);

      if (progress >= 1.0) {
        setDisplayText(asciiText);
        setIsGlitching(false);
        isRunningRef.current = false;
        animFrameRef.current = null;
        return;
      }

      setDisplayText(generateRainFrame(progress));
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [asciiText, generateRainFrame]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={`w-full overflow-hidden border-t border-white/[0.04] ${className}`}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex justify-center items-center group py-6 sm:py-8 px-2 sm:px-4 w-full overflow-hidden cursor-pointer"
        aria-label="an aurostron Project"
        onMouseEnter={triggerAnimation}
        onTouchStart={triggerAnimation}
        onClick={() => {
          if (!isRunningRef.current) {
            triggerAnimation();
          }
        }}
      >
        <pre
          className={`font-mono leading-[1.1] select-none whitespace-pre text-center w-full block transition-colors duration-500 ${
            isGlitching
              ? 'text-[#00ff41] drop-shadow-[0_0_12px_rgba(0,255,65,0.7)]'
              : 'text-zinc-800 group-hover:text-zinc-600'
          }`}
          style={{
            fontSize: 'clamp(5px, calc((100vw - 2rem) / 122), 24px)',
          }}
          aria-hidden="true"
        >
          {displayText}
        </pre>
      </a>
    </div>
  );
};

export default MatrixAsciiBanner;
