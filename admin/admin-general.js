// Hamburger menu functionality
const websiteUrl = "https://localhost:3000";

document.addEventListener('DOMContentLoaded', function() {

  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch(...args).then(response => {
      if (response.status === 403) {
        // Clear cookie and redirect to login
        document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '../frontend/farfetch.html'; // Adjust to your login page path
      }
      return response;
    });
  };
  
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (hamburgerBtn && sidebar && overlay) {
    // Toggle menu on hamburger click
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hamburgerBtn.classList.toggle('active');
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    });

    // Close menu when clicking overlay
    overlay.addEventListener('click', () => {
      hamburgerBtn.classList.remove('active');
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });

    // Close menu when clicking a sidebar link
    const sidebarLinks = document.querySelectorAll('.sidebar a');
    sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburgerBtn.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const isClickInsideSidebar = sidebar.contains(e.target);
      const isClickOnHamburger = hamburgerBtn.contains(e.target);
      
      if (!isClickInsideSidebar && !isClickOnHamburger && sidebar.classList.contains('active')) {
        hamburgerBtn.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    });
  }

  // Logout functionality
  const logoutBtn = document.getElementById('logoutBtn');
  const modal = document.getElementById('logoutModal');
  const closeModal = document.querySelector('.close');
  const cancelBtn = document.getElementById('cancelLogout');
  const confirmBtn = document.getElementById('confirmLogout');

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'block';
  });

  closeModal.addEventListener('click', () => modal.style.display = 'none');
  cancelBtn.addEventListener('click', () => modal.style.display = 'none');

  confirmBtn.addEventListener('click', async () => {
    try {
      await fetch(`${websiteUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-csrf-token': window.getCsrfToken()
        }
      });
      sessionStorage.clear();
      window.location.href = '../frontend/farfetch.html';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });

  // Check super admin status
  (function() {
    const isSuperAdmin = sessionStorage.getItem('isSuperAdmin');
    if (isSuperAdmin === 'true') {
      document.body.classList.add('super-admin');
    }
    
    fetch(`${websiteUrl}/auth/me`, { credentials: 'include' })
    .then(res => res.json())
    .then(user => {
      console.log('User role:', user.role);
      if (user.role === 'super_admin') {
        sessionStorage.setItem('isSuperAdmin', 'true');
        document.body.classList.add('super-admin');
      } else {
        sessionStorage.setItem('isSuperAdmin', 'false');
        document.body.classList.remove('super-admin');
      }
    })
    .catch(err => console.error('Failed to check user role:', err));
  })(); 

  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
});