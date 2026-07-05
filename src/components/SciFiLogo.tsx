interface SciFiLogoProps {
  withLink?: boolean;
}

export default function SciFiLogo({ withLink = true }: SciFiLogoProps) {
  const headerContent = (
    <h1
      className="text-2xl md:text-3xl font-black text-white tracking-tight cursor-pointer select-none inline-block"
    >
      <span className="italic">ho</span>GAMEGATA.
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
