interface SciFiLogoProps {
  withLink?: boolean;
  as?: 'h1' | 'span' | 'div';
}

export default function SciFiLogo({ withLink = true, as = 'h1' }: SciFiLogoProps) {
  const Tag = as;
  const headerContent = (
    <Tag
      className="text-[17px] sm:text-2xl md:text-3xl font-extrabold text-white tracking-[0.03em] cursor-pointer select-none inline-block uppercase"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <span className="italic font-normal lowercase">ho</span>GAMEGATA
    </Tag>
  );

  if (withLink) {
    return (
      <a href="/" className="hover:opacity-85 block focus:outline-none w-fit">
        {headerContent}
      </a>
    );
  }

  return headerContent;
}
