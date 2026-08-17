import { useState, useCallback } from "react";
import { Dices } from "lucide-react";
import { motion } from "motion/react";

export default function RandomDiceButton() {
  const [isRolling, setIsRolling] = useState(false);

  const handleClick = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gamegata:random-warp"));
    }

    // Reset local rolling state in case navigation is delayed or cancelled
    setTimeout(() => {
      setIsRolling(false);
    }, 2500);
  }, [isRolling]);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      aria-label="Random Game"
      title="Discover a random nightmare"
      className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors duration-150 cursor-pointer border border-transparent hover:border-white/10 outline-none select-none group"
    >
      {/* Background ambient glow on hover */}
      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500/0 via-purple-500/0 to-transparent group-hover:from-red-500/10 group-hover:via-purple-500/10 transition-all duration-300 pointer-events-none" />

      {/* Dices Icon with dynamic roll animation */}
      <motion.div
        animate={
          isRolling
            ? {
                rotate: [0, 90, 180, 270, 360],
                scale: [1, 1.25, 0.9, 1.15, 1],
              }
            : {}
        }
        transition={{
          duration: 0.7,
          ease: "easeInOut",
        }}
        className="relative z-10 flex items-center justify-center"
      >
        <Dices
          className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white/80 group-hover:text-white transition-colors duration-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.15)] group-hover:drop-shadow-[0_0_12px_rgba(255,42,42,0.5)]"
          strokeWidth={1.8}
        />
      </motion.div>
    </motion.button>
  );
}
