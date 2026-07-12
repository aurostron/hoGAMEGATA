interface SciFiLogoProps {
  withLink?: boolean;
}

export default function SciFiLogo({ withLink = true }: SciFiLogoProps) {
  const headerContent = (
    <h1
      className="text-2xl md:text-3xl font-extrabold text-white tracking-[0.05em] cursor-pointer select-none inline-block uppercase"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <span className="italic font-normal lowercase">ho</span>GAMEGATA
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
