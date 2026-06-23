import { useSciFiScramble } from "../hooks/useSciFiScramble";

interface SciFiLogoProps {
  withLink?: boolean;
}

export default function SciFiLogo({ withLink = true }: SciFiLogoProps) {
  const { displayText: logoText, startScramble: scrambleLogo } = useSciFiScramble("hoGAMEGATA.");

  const headerContent = (
    <h1
      onMouseEnter={scrambleLogo}
      className="text-2xl md:text-3xl font-black text-white tracking-tight cursor-pointer select-none inline-block min-w-[180px] md:min-w-[220px]"
    >
      <span className="italic">{logoText.substring(0, 2)}</span>
      {logoText.substring(2)}
    </h1>
  );

  if (withLink) {
    return (
      <a href="/" className="hover:opacity-85 block focus:outline-none">
        {headerContent}
      </a>
    );
  }

  return headerContent;
}
