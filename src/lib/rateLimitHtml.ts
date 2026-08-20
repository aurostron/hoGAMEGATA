/**
 * Generates a full-tab HTML response displaying /images/rate-limit.jpeg
 * with history navigation lock ("no go back options") for 429 / 500 API errors.
 */
export function createRateLimitHtmlResponse(status: number = 429, retryAfter: number = 900): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Access Restricted | Rate Limit</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: #000;
      user-select: none;
      -webkit-user-select: none;
    }
    .full-screen-container {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      z-index: 99999999;
    }
    .full-screen-image {
      width: 100%;
      height: 100%;
      object-fit: fill;
      object-position: center;
      display: block;
      pointer-events: none;
    }
  </style>
</head>
<body oncontextmenu="return false;">
  <div class="full-screen-container">
    <img src="/images/rate-limit.jpeg" alt="Rate Limit Exceeded" class="full-screen-image" />
  </div>
  <script>
    (function lockNavigation() {
      try {
        sessionStorage.setItem('api_rate_limit_lockout', '1');
        document.cookie = "api_rate_limit_lockout=1; max-age=900; path=/; SameSite=Lax";
      } catch (e) {}

      // Freeze browser history navigation (no go back options)
      history.pushState(null, null, location.href);
      window.onpopstate = function () {
        history.pushState(null, null, location.href);
      };

      window.addEventListener('keydown', function(e) {
        if (
          (e.altKey && (e.key === 'ArrowLeft' || e.key === 'Left')) ||
          e.key === 'Backspace' ||
          (e.ctrlKey && (e.key === 'r' || e.key === 'R'))
        ) {
          e.preventDefault();
        }
      });
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": String(retryAfter),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
