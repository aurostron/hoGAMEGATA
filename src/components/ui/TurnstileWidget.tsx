import React, { useEffect, useRef, useState } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onVerify,
  onExpire,
  onError,
  className = 'flex justify-center my-3 min-h-[65px]',
  theme = 'dark',
  size = 'normal',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const SCRIPT_ID = 'cloudflare-turnstile-script';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const checkTurnstile = () => {
      if ((window as any).turnstile) {
        setIsReady(true);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => checkTurnstile();
      document.head.appendChild(script);
    } else if ((window as any).turnstile) {
      setIsReady(true);
    } else {
      script.addEventListener('load', checkTurnstile);
    }

    const interval = setInterval(checkTurnstile, 200);

    return () => {
      clearInterval(interval);
      if (script) {
        script.removeEventListener('load', checkTurnstile);
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady || !containerRef.current || !(window as any).turnstile) return;

    if (widgetIdRef.current) {
      try {
        (window as any).turnstile.remove(widgetIdRef.current);
      } catch (e) {
        // ignore
      }
      widgetIdRef.current = null;
    }

    const siteKey =
      import.meta.env?.PUBLIC_TURNSTILE_SITE_KEY ||
      '1x00000000000000000000AA';

    try {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: (token: string) => {
          onVerify(token);
        },
        'expired-callback': () => {
          if (onExpire) onExpire();
        },
        'error-callback': () => {
          if (onError) onError();
        },
      });
    } catch (err) {
      console.warn('[Turnstile] Render error:', err);
    }

    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [isReady, theme, size]);

  return (
    <div className={className}>
      <div ref={containerRef} className="flex justify-center items-center w-full" />
    </div>
  );
};
