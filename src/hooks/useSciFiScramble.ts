import { useState, useEffect, useCallback, useRef } from "react";

export function useSciFiScramble(targetText: string) {
  const [displayText, setDisplayText] = useState(targetText);
  const isScramblingRef = useRef(false);

  const startScramble = useCallback(() => {
    if (isScramblingRef.current) return;
    isScramblingRef.current = true;
    let iterations = 0;
    
    const interval = setInterval(() => {
      setDisplayText(() => {
        return targetText.split("")
          .map((char, index) => {
            if (index < iterations) {
              return targetText[index];
            }
            if (char === ".") return "."; // Preserve the trailing dot
            const randomChars = "01$#@%&?*XΔΩ[]{}<>";
            return randomChars[Math.floor(Math.random() * randomChars.length)];
          })
          .join("");
      });

      iterations += 1 / 3; // Resolve 1 character every 3 frames (approx. 90ms per character)
      if (iterations >= targetText.length) {
        clearInterval(interval);
        setDisplayText(targetText);
        isScramblingRef.current = false;
      }
    }, 30);
  }, [targetText]);

  // Trigger once on mount for a cool loading decryption effect
  useEffect(() => {
    let initialIterations = 0;
    isScramblingRef.current = true;

    const initialInterval = setInterval(() => {
      setDisplayText(() => {
        return targetText.split("")
          .map((char, index) => {
            if (index < initialIterations) {
              return targetText[index];
            }
            if (char === ".") return ".";
            const randomChars = "01$#@%&?*XΔΩ[]{}<>";
            return randomChars[Math.floor(Math.random() * randomChars.length)];
          })
          .join("");
      });

      initialIterations += 1 / 3;
      if (initialIterations >= targetText.length) {
        clearInterval(initialInterval);
        setDisplayText(targetText);
        isScramblingRef.current = false;
      }
    }, 30);

    return () => {
      clearInterval(initialInterval);
    };
  }, [targetText]);

  return { displayText, startScramble };
}
