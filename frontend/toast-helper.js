// toast-helper.js

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 2000) {
  console.log('showToast called:', message, type);
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Strong inline styles
  toast.style.setProperty('display', 'block', 'important');
  toast.style.cssText += `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 20000;
    max-width: 350px;
    opacity: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transform: translateX(10px);
    transition: opacity 250ms ease, transform 250ms ease-out;
    word-wrap: break-word;
  `;

  // Background by type
  switch(type) {
    case 'success':
      toast.style.backgroundColor = '#28a745';
      break;
    case 'error':
      toast.style.backgroundColor = '#dc3545';
      break;
    case 'warning':
      toast.style.backgroundColor = '#9e8025ff';
    //   toast.style.color = '#000';
      break;
    default: // 'info'
      toast.style.backgroundColor = '#007bff';
  }

  toast.textContent = message;
  
  // Append to body
  (document.body || document.documentElement).appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);

  // Auto remove after duration
  const remove = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(10px)';
    setTimeout(() => { 
      if (toast.parentNode) toast.parentNode.removeChild(toast); 
    }, 260);
  };
  
  setTimeout(remove, duration);

  return toast;
}

function redirectWithToast(message, type, targetUrl, delay = 2000) {
  showToast(message, type);
  setTimeout(() => {
    window.location.href = targetUrl;
  }, delay);
}

function reloadWithToast(message, type, delay = 2000) {
  showToast(message, type);
  setTimeout(() => {
    window.location.reload();
  }, delay);
}

// Make it globally available
window.showToast = showToast;
window.redirectWithToast = redirectWithToast;
window.reloadWithToast = reloadWithToast;