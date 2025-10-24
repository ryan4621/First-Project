document.addEventListener('DOMContentLoaded', function() {
  // Add this at the very beginning of your script tag
  // Intercept fetch responses globally
  // const originalFetch = window.fetch;
  // window.fetch = function(...args) {
  //   return originalFetch(...args).then(response => {
  //     if (response.status === 403) {
  //       // Clear cookie and redirect to login
  //       document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  //       window.location.href = '../frontend/farfetch.html'; // Adjust to your login page path
  //     }
  //     return response;
  //   });
  // };

  // Logout modal controls
  const logoutBtn = document.getElementsByClassName('logout-btn')[0];
  const logoutCancel = document.getElementById('logout-cancel');
  const logoutConfirm = document.getElementById('logout-confirm');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('logout-modal');
      if (modal) modal.style.display = 'block';
    });
  }

  if (logoutCancel) {
    logoutCancel.addEventListener('click', () => {
      const modal = document.getElementById('logout-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  if (logoutConfirm) {
    logoutConfirm.addEventListener('click', async () => {
      try {
        await fetch('https://localhost:3000/auth/logout', { 
          method: 'POST', 
          credentials: 'include',
          headers: {
          'x-csrf-token': window.getCsrfToken()
          }
        });
        window.location.replace('../frontend/farfetch.html');
      } catch (error) {
        console.error('Logout failed:', error);
      }
    });
  }

  // Hamburger menu functionality - Wrap in DOMContentLoaded

  const hamburgerMenu = document.getElementById('hamburger-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  // Debug: Check if elements exist
  if (!hamburgerMenu) console.error('Hamburger menu element not found');
  if (!sidebar) console.error('Sidebar element not found');
  if (!overlay) console.error('Overlay element not found');

  // Only proceed if all elements exist
  if (hamburgerMenu && sidebar && overlay) {
    // Toggle sidebar on hamburger click
    hamburgerMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      // hamburgerMenu.classList.toggle('active');
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    });

    // Close sidebar when clicking overlay
    overlay.addEventListener('click', () => {
      hamburgerMenu.classList.remove('active');
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });

    // Close sidebar when clicking a navigation link
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburgerMenu.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      const isClickInsideSidebar = sidebar.contains(e.target);
      const isClickOnHamburger = hamburgerMenu.contains(e.target);
      
      if (!isClickInsideSidebar && !isClickOnHamburger && sidebar.classList.contains('active')) {
        hamburgerMenu.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    });
  }
}); 