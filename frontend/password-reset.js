// password-reset.js

let resetEmail = '';
let resetToken = '';

// Import the toast function from login.js or define it here
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 250ms ease, transform 250ms ease;
  `;

  switch(type) {
    case 'success':
      toast.style.backgroundColor = '#28a745';
      break;
    case 'error':
      toast.style.backgroundColor = '#dc3545';
      break;
    case 'warning':
      toast.style.backgroundColor = '#ffc107';
      toast.style.color = '#000';
      break;
    default:
      toast.style.backgroundColor = '#007bff';
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 100);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  }, 3000);
}

// Step 1: Send reset code
document.getElementById('sendResetCode')?.addEventListener('click', async () => {
  const email = document.getElementById('resetEmail').value.trim();
  
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }

  try {
    const response = await fetch('https://localhost:3000/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.getCsrfToken()
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (response.ok) {
      resetEmail = email;
      showToast('Reset code sent to your email!', 'success');
      
      // Move to step 2
      document.getElementById('resetStep1').style.display = 'none';
      document.getElementById('resetStep2').style.display = 'block';
    } else {
      throw new Error(data.message || 'Failed to send reset code');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// Step 2: Verify reset code
document.getElementById('verifyResetCode')?.addEventListener('click', async () => {
  const code = document.getElementById('resetCode').value.trim();
  
  if (!code || code.length !== 6) {
    showToast('Please enter the 6-digit code', 'error');
    return;
  }

  try {
    const response = await fetch('https://localhost:3000/password-reset/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.getCsrfToken()
      },
      body: JSON.stringify({ email: resetEmail, code })
    });

    const data = await response.json();

    if (response.ok) {
      resetToken = data.resetToken;
      showToast('Code verified!', 'success');
      
      // Move to step 3
      document.getElementById('resetStep2').style.display = 'none';
      document.getElementById('resetStep3').style.display = 'block';
    } else {
      throw new Error(data.message || 'Invalid code');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// Step 3: Reset password
document.getElementById('resetPassword')?.addEventListener('click', async () => {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!newPassword || !confirmPassword) {
    showToast('Please fill in both password fields', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  try {
    const response = await fetch('https://localhost:3000/password-reset/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.getCsrfToken()
      },
      body: JSON.stringify({ 
        email: resetEmail, 
        resetToken, 
        newPassword 
      })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Password reset successfully!', 'success');
      
      // Reset the modal and close it
      setTimeout(() => {
        document.getElementById('resetStep1').style.display = 'block';
        document.getElementById('resetStep2').style.display = 'none';
        document.getElementById('resetStep3').style.display = 'none';
        document.getElementById('resetEmail').value = '';
        document.getElementById('resetCode').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        // Close modal using Bootstrap
        const modal = bootstrap.Modal.getInstance(document.getElementById('passwordResetModal'));
        if (modal) modal.hide();
      }, 2000);
    } else {
      throw new Error(data.message || 'Failed to reset password');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// Back to step 1
document.getElementById('backToStep1')?.addEventListener('click', () => {
    document.getElementById('resetStep2').style.display = 'none';
    document.getElementById('resetStep1').style.display = 'block';
});

// Reset modal when it's closed
document.getElementById('passwordResetModal')?.addEventListener('hidden.bs.modal', () => {
  document.getElementById('resetStep1').style.display = 'block';
  document.getElementById('resetStep2').style.display = 'none';
  document.getElementById('resetStep3').style.display = 'none';
  document.getElementById('resetEmail').value = '';
  document.getElementById('resetCode').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  resetEmail = '';
  resetToken = '';
});