// security.js

export function initializeSecurity() {

  // Add this at the top of the security.js file, after the export function line
  let currentOffset = 0;
  
  // Change password functionality
  async function changePassword(currentPassword, newPassword, confirmPassword) {
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new Error("New passwords do not match");
    }

    // Validate password strength (basic validation)
    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long");
    }

    try {
      const response = await fetch(`${websiteUrl}/api/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to change password");
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Handle password form submission
  function handlePasswordFormSubmit() {
    const passwordForm = document.getElementById('security-password-form');
    
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const currentPassword = document.getElementById('security-current-password').value;
      const newPassword = document.getElementById('security-new-password').value;
      const confirmPassword = document.getElementById('security-confirm-password').value;

      // Clear any existing error states
      clearPasswordErrors();

      try {
        // Show loading state
        const submitBtn = passwordForm.querySelector('button[type="submit"]');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        await changePassword(currentPassword, newPassword, confirmPassword);
        
        // Success - clear form and show success message
        passwordForm.reset();
        showSecurityToast("Password changed successfully!", "success");
        setTimeout(() => {
          window.location.href = "../frontend/farfetch.html";
        }, 4000);        

        
      } catch (error) {
        console.error("Password change error:", error);
        
        // Show specific error messages
        if (error.message.includes("do not match")) {
          showPasswordError('security-confirm-password', error.message);
        } else if (error.message.includes("6 characters")) {
          showPasswordError('security-new-password', error.message);
        } else if (error.message.includes("Old password")) {
          showPasswordError('security-current-password', "Current password is incorrect");
        } else {
          showSecurityToast("Failed to change password: " + error.message, "error");
        }
      } finally {
        // Remove loading state
        const submitBtn = passwordForm.querySelector('button[type="submit"]');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }

  // Show password field error
  function showPasswordError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.classList.add('error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.security-error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'security-error-message';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
  }

  // Clear all password errors
  function clearPasswordErrors() {
    const passwordFields = [
      'security-current-password',
      'security-new-password', 
      'security-confirm-password'
    ];
    
    passwordFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      field.classList.remove('error');
      
      const errorMsg = field.parentNode.querySelector('.security-error-message');
      if (errorMsg) {
        errorMsg.remove();
      }
    });
  }

  // Show security toast notification
  function showSecurityToast(message, type = 'success') {
    const toast = document.getElementById('settings-toast');
    toast.textContent = message;
    toast.className = `settings-toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Password strength indicator (optional enhancement)
  function initializePasswordStrengthIndicator() {
    const newPasswordField = document.getElementById('security-new-password');
    
    newPasswordField.addEventListener('input', (e) => {
      const password = e.target.value;
      // You could add visual password strength indicator here
      // For now, just clear errors when user starts typing
      if (password.length > 0) {
        e.target.classList.remove('error');
        const errorMsg = e.target.parentNode.querySelector('.security-error-message');
        if (errorMsg) {
          errorMsg.remove();
        }
      }
    });
  }

  // 2FA status management

  async function initialize2FAStatus() {
    const enable2FABtn = document.getElementById('security-enable-2fa-btn');
    const statusIndicator = document.querySelector('.security-status-dot');
    const statusText = document.querySelector('.security-status-text');

    // Load current 2FA status
    await load2FAStatus();

    enable2FABtn.addEventListener('click', async () => {
      try {
        const currentlyEnabled = enable2FABtn.textContent.trim() === 'Disable 2FA';
        const newState = !currentlyEnabled;
        
        // Get user info first
        const userResponse = await fetch(`${websiteUrl}/api/profile`, {
          method: "GET",
          credentials: "include"
        });
        
        if (!userResponse.ok) {
          throw new Error("Failed to get user info");
        }
        
        const userData = await userResponse.json();
        const user = userData.user;
        
        // If trying to enable 2FA and email is not verified, show error immediately
        if (newState && !user.email_verified) {
          showSecurityToast("You must verify your email before enabling two-factor authentication.", "error");
          return;
        }
        
        // Show password confirmation modal
        const result = await show2FAConfirmationModal(newState, user.email, user.email_verified);
        
        if (!result.confirmed) {
          return; // User cancelled
        }
        
        enable2FABtn.classList.add('loading');
        enable2FABtn.disabled = true;
        
        const response = await fetch(`${websiteUrl}/api/2fa/toggle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'x-csrf-token': window.getCsrfToken()
          },
          credentials: "include",
          body: JSON.stringify({ 
            enable: newState,
            password: result.password 
          })
        });

        const responseData = await response.json();

        if (response.ok) {
          showSecurityToast(`2FA ${newState ? 'enabled' : 'disabled'} successfully!`, "success");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          throw new Error(responseData.message || "Failed to toggle 2FA");
        }
      } catch (error) {
        console.error("2FA toggle error:", error);
        showSecurityToast("Failed to toggle 2FA: " + error.message, "error");
      } finally {
        enable2FABtn.classList.remove('loading');
        enable2FABtn.disabled = false;
      }
    });
  };

  // New function to show 2FA confirmation modal
  function show2FAConfirmationModal(enabling, userEmail, emailVerified) {
    return new Promise((resolve) => {
      const modal = document.getElementById('account-deletion-modal');
      const modalTitle = document.getElementById('account-action-title');
      const modalWarning = document.getElementById('account-action-warning');
      const passwordInput = document.getElementById('deletion-password-input');
      const passwordGroup = passwordInput.closest('.security-form-group');
      const confirmBtn = document.getElementById('confirm-deletion-btn');
      const cancelBtn = document.getElementById('cancel-deletion-btn');
      const closeBtn = document.getElementById('close-deletion-modal');

      // Set modal content
      modalTitle.textContent = enabling ? 'Enable Two-Factor Authentication' : 'Disable Two-Factor Authentication';
      
      if (enabling) {
        modalWarning.innerHTML = `
          Two-factor authentication will be activated for your account.
          <br><br>
          <strong>Email:</strong> ${userEmail}
          <br><br>
          You will receive a 6-digit code via email each time you log in.
        `;
      } else {
        modalWarning.textContent = 'Two-factor authentication will be disabled. You will no longer need a verification code to log in.';
      }
      
      passwordGroup.style.display = 'block';
      confirmBtn.textContent = enabling ? 'Enable 2FA' : 'Disable 2FA';
      confirmBtn.className = enabling ? 'settings-btn settings-btn-primary' : 'settings-btn settings-btn-warning';
      
      modal.classList.add('show');
      passwordInput.value = '';
      
      // Focus on password input after modal shows
      setTimeout(() => passwordInput.focus(), 100);

      const handleConfirm = () => {
        const password = passwordInput.value;
        
        if (!password) {
          showSecurityToast("Password is required", "error");
          return;
        }
        
        modal.classList.remove('show');
        cleanup();
        resolve({ confirmed: true, password });
      };

      const handleCancel = () => {
        modal.classList.remove('show');
        cleanup();
        resolve({ confirmed: false, password: null });
      };

      const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleModalBackdropClick);
      };

      const handleModalBackdropClick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
      modal.addEventListener('click', handleModalBackdropClick);
    });
  };
  
  // Load 2FA status from backend
  async function load2FAStatus() {
      try {
      const response = await fetch(`${websiteUrl}/api/2fa/status`, {
          method: "GET",
          credentials: "include"
      });
  
      if (response.ok) {
          const data = await response.json();
          update2FAStatus(data.enabled);
      }
      } catch (error) {
      console.error("Failed to load 2FA status:", error);
      }
  }
  
  // Update 2FA UI based on status
  function update2FAStatus(enabled) {
      const enable2FABtn = document.getElementById('security-enable-2fa-btn');
      const statusIndicator = document.querySelector('.security-status-dot');
      const statusText = document.querySelector('.security-status-text');
      
      if (enabled) {
      statusIndicator.className = 'security-status-dot security-status-enabled';
      statusText.textContent = 'Two-Factor Authentication is enabled';
      enable2FABtn.textContent = 'Disable 2FA';
      enable2FABtn.className = 'settings-btn settings-btn-warning';
      } else {
      statusIndicator.className = 'security-status-dot security-status-disabled';
      statusText.textContent = 'Two-Factor Authentication is disabled';
      enable2FABtn.textContent = 'Enable 2FA';
      enable2FABtn.className = 'settings-btn settings-btn-primary';
      }
  }

  // Security questions functionality
  async function initializeSecurityQuestions() {
    const setupQuestionsBtn = document.getElementById('security-setup-questions-btn');
    const questionsStatus = document.getElementById('security-questions-status');
    
    // Load current security questions status
    await loadSecurityQuestionsStatus();
    
    setupQuestionsBtn.addEventListener('click', () => {
      showSecurityQuestionsModal();
    });
    
    // Initialize modal functionality
    initializeSecurityQuestionsModal();
  }

  // Load security questions status
  async function loadSecurityQuestionsStatus() {
    try {
      const response = await fetch(`${websiteUrl}/api/security-questions/status`, {
        method: "GET",
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        updateSecurityQuestionsStatus(data.hasQuestions);
      }
    } catch (error) {
      console.error("Failed to load security questions status:", error);
    }
  }

  // Update security questions UI status
  function updateSecurityQuestionsStatus(hasQuestions) {
    const statusIndicator = document.querySelector('#security-questions-status .security-status-dot');
    const statusText = document.querySelector('#security-questions-status .security-status-text');
    const setupBtn = document.getElementById('security-setup-questions-btn');
    
    if (hasQuestions) {
      statusIndicator.className = 'security-status-dot security-status-enabled';
      statusText.textContent = 'Security questions are set up';
      setupBtn.textContent = 'Update Questions';
    } else {
      statusIndicator.className = 'security-status-dot security-status-disabled';
      statusText.textContent = 'Security questions not set up';
      setupBtn.textContent = 'Set Up Questions';
    }
  }

  // Show security questions modal
  function showSecurityQuestionsModal() {
    const modal = document.getElementById('security-questions-modal');
    modal.classList.add('show');
  }

  // Initialize security questions modal
  function initializeSecurityQuestionsModal() {
    const modal = document.getElementById('security-questions-modal');
    const closeBtn = document.getElementById('close-questions-modal');
    const cancelBtn = document.getElementById('cancel-questions-btn');
    const saveBtn = document.getElementById('save-questions-btn');
    const form = document.getElementById('security-questions-form');
    
    // Close modal handlers
    closeBtn.addEventListener('click', hideSecurityQuestionsModal);
    cancelBtn.addEventListener('click', hideSecurityQuestionsModal);
    
    // Backdrop click to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideSecurityQuestionsModal();
      }
    });
    
    // Save questions handler
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveSecurityQuestions();
    });
    
    // Form submission handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveSecurityQuestions();
    });
  }

  // Hide security questions modal
  function hideSecurityQuestionsModal() {
    const modal = document.getElementById('security-questions-modal');
    const form = document.getElementById('security-questions-form');
    modal.classList.remove('show');
    form.reset();
  }

  // Save security questions
  async function saveSecurityQuestions() {
    const form = document.getElementById('security-questions-form');
    const saveBtn = document.getElementById('save-questions-btn');
    
    try {
      // Validate form
      const formData = new FormData(form);
      const data = {
        question1: formData.get('question1'),
        answer1: formData.get('answer1'),
        question2: formData.get('question2'),
        answer2: formData.get('answer2'),
        question3: formData.get('question3'),
        answer3: formData.get('answer3')
      };
      
      // Check all fields are filled
      for (const [key, value] of Object.entries(data)) {
        if (!value || value.trim() === '') {
          showSecurityToast(`Please fill in all questions and answers`, "error");
          return;
        }
      }
      
      // Check that different questions are selected
      if (data.question1 === data.question2 || data.question1 === data.question3 || data.question2 === data.question3) {
        showSecurityToast("Please select different questions for each field", "error");
        return;
      }
      
      // Show loading state
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;
      
      const response = await fetch(`${websiteUrl}/api/security-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showSecurityToast("Security questions saved successfully!", "success");
        hideSecurityQuestionsModal();
        updateSecurityQuestionsStatus(true);
      } else {
        throw new Error(result.message || "Failed to save security questions");
      }
      
    } catch (error) {
      console.error("Error saving security questions:", error);
      showSecurityToast("Failed to save security questions: " + error.message, "error");
    } finally {
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
    }
  }

  // Sessions management functionality
  async function initializeSessionsManagement() {
      const refreshSessionsBtn = document.getElementById('security-refresh-sessions-btn');
      const sessionsList = document.getElementById('security-sessions-list');
      
      // Load sessions on page load
      await loadActiveSessions();
      
      refreshSessionsBtn.addEventListener('click', async () => {
      refreshSessionsBtn.classList.add('loading');
      refreshSessionsBtn.disabled = true;
      
      try {
          await loadActiveSessions();
          showSecurityToast("Sessions refreshed successfully!", "success");
      } catch (error) {
          showSecurityToast("Failed to refresh sessions", "error");
      } finally {
          refreshSessionsBtn.classList.remove('loading');
          refreshSessionsBtn.disabled = false;
      }
      });
  }
  
  // Load and display active sessions
  async function loadActiveSessions() {
      try {
      const response = await fetch(`${websiteUrl}/api/sessions`, {
          method: "GET",
          credentials: "include"
      });
  
      if (response.ok) {
          const data = await response.json();
          displaySessions(data.sessions);
      } else {
          throw new Error("Failed to load sessions");
      }
      } catch (error) {
      console.error("Error loading sessions:", error);
      const sessionsList = document.getElementById('security-sessions-list');
      sessionsList.innerHTML = '<p>Failed to load sessions</p>';
      }
  }
  
  // Display sessions in the UI
  function displaySessions(sessions) {
      const sessionsList = document.getElementById('security-sessions-list');
      
      if (sessions.length === 0) {
      sessionsList.innerHTML = '<p>No active sessions found</p>';
      return;
      }
  
      sessionsList.innerHTML = sessions.map(session => `
      <div class="security-session-item">
          <div class="security-session-info">
          <div class="security-session-device">${session.device_info || 'Unknown Device'}</div>
          <div class="security-session-details">
              <span class="security-session-location">${session.ip_address || 'Unknown Location'}</span>
              <span class="security-session-time">${formatSessionTime(session.last_active)}</span>
          </div>
          </div>
          ${session.is_current 
          ? '<span class="security-session-badge">Current</span>'
          : `<button class="settings-btn settings-btn-danger settings-btn-small" onclick="terminateSession(${session.id})">Terminate</button>`
          }
      </div>
      `).join('');
  
      // Add terminate all button if there are multiple sessions
      if (sessions.length > 1) {
      sessionsList.innerHTML += `
          <div style="margin-top: 1rem;">
          <button class="settings-btn settings-btn-warning" onclick="terminateAllSessions()">
              Terminate All Other Sessions
          </button>
          </div>
      `;
      }
  }
  
  // Format session time
  function formatSessionTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Active now';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
      return `${Math.floor(diffMins / 1440)} days ago`;
  }
  
  // Terminate specific session
  window.terminateSession = async function(sessionId) {
      try {
      const response = await fetch(`${websiteUrl}/api/sessions/${sessionId}`, {
          method: "DELETE",
          credentials: "include",
          headers: {
            'x-csrf-token': window.getCsrfToken()
          }
      });
  
      if (response.ok) {
          showSecurityToast("Session terminated successfully!", "success");
          await loadActiveSessions(); // Refresh the list
      } else {
          const result = await response.json();
          throw new Error(result.message || "Failed to terminate session");
      }
      } catch (error) {
      showSecurityToast("Failed to terminate session: " + error.message, "error");
      }
  };
  
  // Terminate all other sessions
  window.terminateAllSessions = async function() {
      try {
      const response = await fetch(`${websiteUrl}/api/sessions/terminate-all`, {
        method: "POST",
        credentials: "include",
        headers: {
          'x-csrf-token': window.getCsrfToken()
        }
      });
  
      if (response.ok) {
          showSecurityToast("All other sessions terminated!", "success");
          await loadActiveSessions(); // Refresh the list
      } else {
          const result = await response.json();
          throw new Error(result.message || "Failed to terminate sessions");
      }
      } catch (error) {
      showSecurityToast("Failed to terminate sessions: " + error.message, "error");
      }
  };

  // Activity logs functionality
  async function initializeActivityLogs() {
    const loadMoreBtn = document.getElementById('security-load-more-activity-btn');
    const activityList = document.getElementById('security-activity-list');
    
    let currentOffset = 0;
    const limit = 10;
    
    // Load initial activity logs
    await loadActivityLogs(true);
    
    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.classList.add('loading');
      loadMoreBtn.disabled = true;
      
      try {
        await loadActivityLogs(false);
        showSecurityToast("More activities loaded", "success");
      } catch (error) {
        showSecurityToast("Failed to load more activities", "error");
      } finally {
        loadMoreBtn.classList.remove('loading');
        loadMoreBtn.disabled = false;
      }
    });
  }

  // Load activity logs from backend
  async function loadActivityLogs(isInitial = false) {
    try {
      if (isInitial) {
        currentOffset = 0;
      }
      
      const response = await fetch(`${websiteUrl}/api/activity-logs?limit=10&offset=${currentOffset}`, {
        method: "GET",
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        displayActivityLogs(data.activities, isInitial);
        currentOffset += data.activities.length;
        
        // Hide load more button if no more activities
        const loadMoreBtn = document.getElementById('security-load-more-activity-btn');
        if (data.activities.length < 10) {
          loadMoreBtn.style.display = 'none';
        }
      } else {
        throw new Error("Failed to load activity logs");
      }
    } catch (error) {
      console.error("Error loading activity logs:", error);
      const activityList = document.getElementById('security-activity-list');
      if (isInitial) {
        activityList.innerHTML = '<p>Failed to load activity logs</p>';
      }
    }
  }

  // Display activity logs in UI
  function displayActivityLogs(activities, isInitial = false) {
    const activityList = document.getElementById('security-activity-list');
    
    if (isInitial && activities.length === 0) {
      activityList.innerHTML = '<p>No activity logs found</p>';
      return;
    }
    
    const activityHTML = activities.map(activity => `
      <div class="security-activity-item">
        <div class="security-activity-icon">${getActivityIcon(activity.activity_type)}</div>
        <div class="security-activity-info">
          <div class="security-activity-title">${activity.description}</div>
          <div class="security-activity-details">
            <span class="security-activity-time">${formatActivityTime(activity.created_at)}</span>
            ${activity.device_info ? `<span class="security-activity-device">${activity.device_info}</span>` : ''}
            ${activity.ip_address ? `<span class="security-activity-ip">${activity.ip_address}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
    
    if (isInitial) {
      activityList.innerHTML = activityHTML;
    } else {
      activityList.insertAdjacentHTML('beforeend', activityHTML);
    }
  }

  // Get icon for activity type
  function getActivityIcon(activityType) {
    const icons = {
      'login': '🔐',
      'logout': '🚪',
      'password_change': '🔑',
      'profile_update': '👤',
      '2fa_enabled': '🛡️',
      '2fa_disabled': '🔓',
      'session_terminated': '❌'
    };
    return icons[activityType] || '📝';
  }

  // Format activity time
  function formatActivityTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? 'Just now' : `${diffMins} minutes ago`;
    } else if (diffDays < 1) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // Dangerous account actions
  function initializeDangerousActions() {
    const deactivateBtn = document.getElementById('security-deactivate-btn');
    const deleteBtn = document.getElementById('security-delete-btn');

    deactivateBtn.addEventListener('click', async () => {
      const result = await showAccountActionConfirmation(
        'Deactivate Account',
        'Your account will be temporarily disabled. Do you want to proceed with this request?',
        true,
        false
      );
      
      if (result.confirmed && result.password) {
        await deactivateAccount(result.password);
      }
    });
    
    deleteBtn.addEventListener('click', async () => {
      const result = await showAccountActionConfirmation(
        'Delete Account',
        'This action cannot be undone. All your data will be permanently deleted.',
        false,
        true
      );
      
      if (result.confirmed && result.password) {
        await deleteAccount(result.password);
      }
    });
  }

  // Show account action confirmation modal
  function showAccountActionConfirmation(title, message, deactivateClicked, deleteClicked) {
    return new Promise((resolve) => {
      const modal = document.getElementById('account-deletion-modal');
      const modalTitle = document.getElementById('account-action-title');
      const modalWarning = document.getElementById('account-action-warning');
      const passwordInput = document.getElementById('deletion-password-input');
      const confirmBtn = document.getElementById('confirm-deletion-btn');
      const cancelBtn = document.getElementById('cancel-deletion-btn');
      const closeBtn = document.getElementById('close-deletion-modal');

      modalTitle.textContent = title;
      modalWarning.textContent = message;
      
      confirmBtn.textContent = deleteClicked
      ? 'Delete Account'
      : deactivateClicked
      ? 'Deactivate Account'
      : 'Confirm';

      
      modal.classList.add('show');
      passwordInput.value = '';

      const handleConfirm = () => {
        const password = passwordInput.value;
        
        if (!password) {
          showSecurityToast("Password is required", "error");
          return;
        }
        
        modal.classList.remove('show');
        cleanup();
        resolve({ confirmed: true, password });
      };

      const handleCancel = () => {
        modal.classList.remove('show');
        cleanup();
        resolve({ confirmed: false, password: null });
      };

      const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleModalBackdropClick);
      };

      const handleModalBackdropClick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
      modal.addEventListener('click', handleModalBackdropClick);
    });
  }

  // Deactivate account
  async function deactivateAccount(password) {
    try {
      const response = await fetch(`${websiteUrl}/api/account/deactivate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      // In the deactivateAccount function, change the success message:
      if (response.ok) {
        showSecurityToast("Account deactivated successfully. Contact support to reactivate.", "success");
        setTimeout(() => {
          window.location.href = "../frontend/farfetch.html";
        }, 3000);

      } else {
        throw new Error(result.message || "Failed to deactivate account");
      }
    } catch (error) {
      showSecurityToast("Failed to deactivate account: " + error.message, "error");
    }
  }

  // Delete account permanently
  async function deleteAccount(password) {
    try {
      const response = await fetch(`${websiteUrl}/api/account/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      // In the deleteAccount function, change the success message:
      if (response.ok) {
        showSecurityToast("Account deleted successfully. You have 30 days to recover it.", "success");
        setTimeout(() => {
          window.location.href = "../frontend/farfetch.html";
        }, 3000);

      } else {
        throw new Error(result.message || "Failed to delete account");
      }
    } catch (error) {
      showSecurityToast("Failed to delete account: " + error.message, "error");
    }
  }

  // Password visibility toggle functionality
  function initializePasswordVisibilityToggle() {
    const toggleButtons = document.querySelectorAll('.security-password-toggle');
    
    toggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        const targetId = button.getAttribute('data-target');
        const passwordInput = document.getElementById(targetId);
        const eyeIcon = button.querySelector('.security-eye-icon');
        
        if (passwordInput.type === 'password') {
          // Show password
          passwordInput.type = 'text';
          eyeIcon.textContent = '🙈'; // Closed eye
          button.setAttribute('aria-label', 'Hide password');
        } else {
          // Hide password
          passwordInput.type = 'password';
          eyeIcon.textContent = '👁'; // Open eye
          button.setAttribute('aria-label', 'Show password');
        }
      });
      
      // Set initial aria-label
      button.setAttribute('aria-label', 'Show password');
    });
  }

  // Initialize all security functionality
  function initializeAllSecurityFeatures() {
    handlePasswordFormSubmit();
    initializePasswordStrengthIndicator();
    initializePasswordVisibilityToggle();
    initialize2FAStatus();
    initializeSecurityQuestions();
    initializeSessionsManagement();
    initializeActivityLogs();
    initializeDangerousActions();
    
    console.log("Security features initialized");
  }

  // Public API
  return {
    initialize: initializeAllSecurityFeatures,
    changePassword: changePassword,
    showToast: showSecurityToast,
    load2FAStatus: load2FAStatus
  };
}