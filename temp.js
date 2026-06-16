
    async function login() {
      const password = document.getElementById('passwordInput').value;
      const errorDiv = document.getElementById('errorMsg');
      errorDiv.style.display = 'none';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        if (res.ok) {
          window.location.reload();
        } else {
          errorDiv.style.display = 'block';
        }
      } catch (e) {
        errorDiv.textContent = 'Connection error.';
        errorDiv.style.display = 'block';
      }
    }
  