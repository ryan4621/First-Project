// Preferences functionality for settings page

export function initializePreferences() {

  // Function to programmatically change Google Translate language
  // function changeGoogleTranslateLanguage(langCode) {
  //   const translateSelect = document.querySelector('.goog-te-combo');
  //   if (translateSelect) {
  //     translateSelect.value = langCode;
  //     translateSelect.dispatchEvent(new Event('change'));
  //   }
  // }

  // Function to set Google Translate cookie
  function setGoogleTranslateCookie(langCode) {
    // Google Translate uses this cookie format
    const googleTransCookie = `/en/${langCode}`;
    document.cookie = `googtrans=${googleTransCookie}; path=/; max-age=31536000`; // 1 year
    document.cookie = `googtrans=${googleTransCookie}; path=/; domain=${window.location.hostname}; max-age=31536000`;
  }

  // On page load, apply saved language
  async function applySavedLanguage() {
    try {
      const response = await fetch("https://localhost:3000/api/preferences", {
        method: "GET",
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        const savedLang = data.preferences.language;
        
        // Set cookie on page load
        setGoogleTranslateCookie(savedLang);
      }
    } catch (error) {
      console.error("Failed to apply saved language:", error);
    }
  }

  // Load user preferences from backend
  async function loadUserPreferences() {
    try {
      const response = await fetch("https://localhost:3000/api/preferences", {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const preferences = data.preferences;
      
      console.log("Loaded preferences:", preferences);
      
      // Populate preference fields
      populatePreferenceFields(preferences);
      
    } catch (error) {
      console.error("Failed to load preferences:", error);
      showPreferencesToast("Failed to load preferences. Using defaults.", "error");
    }
  }

  // Populate all preference form fields with user data
  function populatePreferenceFields(preferences) {
    // Notification settings
    document.getElementById('preferences-notifications-email').checked = preferences.notifications_email;
    document.getElementById('preferences-notifications-sms').checked = preferences.notifications_sms;
    document.getElementById('preferences-notifications-push').checked = preferences.notifications_push;
    document.getElementById('preferences-marketing-emails').checked = preferences.marketing_emails;
    document.getElementById('preferences-order-updates').checked = preferences.order_updates;
    document.getElementById('preferences-promotional-offers').checked = preferences.promotional_offers;
    
    // Language & Currency
    document.getElementById('preferences-language-select').value = preferences.language || 'en';
    document.getElementById('preferences-currency-select').value = preferences.currency || 'USD';
    
    // Privacy settings
    document.getElementById('preferences-profile-visibility').value = preferences.profile_visibility || 'public';
    document.getElementById('preferences-show-online-status').checked = preferences.show_online_status;
    document.getElementById('preferences-allow-search-engines').checked = preferences.allow_search_engines;
  }

  // Save preferences functionality
  async function saveUserPreferences() {
    try {
      // Show loading state
      const saveBtn = document.getElementById('preferences-save-btn');
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;
      
      // Collect all preference data
      const preferencesData = {
        notifications_email: document.getElementById('preferences-notifications-email').checked,
        notifications_sms: document.getElementById('preferences-notifications-sms').checked,
        notifications_push: document.getElementById('preferences-notifications-push').checked,
        marketing_emails: document.getElementById('preferences-marketing-emails').checked,
        order_updates: document.getElementById('preferences-order-updates').checked,
        promotional_offers: document.getElementById('preferences-promotional-offers').checked,
        language: document.getElementById('preferences-language-select').value,
        currency: document.getElementById('preferences-currency-select').value,
        profile_visibility: document.getElementById('preferences-profile-visibility').value,
        show_online_status: document.getElementById('preferences-show-online-status').checked,
        allow_search_engines: document.getElementById('preferences-allow-search-engines').checked
      };

      console.log("Saving preferences:", preferencesData);

      const response = await fetch("https://localhost:3000/api/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify(preferencesData)
      });

      const result = await response.json();

      if (response.ok) {
        // Set the cookie for Google Translate
        setGoogleTranslateCookie(preferencesData.language);
        
        // Force page reload to apply translation
        showPreferencesToast("Preferences saved! Reloading...", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

    } catch (error) {
      console.error("Error saving preferences:", error);
      showPreferencesToast("Failed to save preferences. Please try again.", "error");
    } finally {
      // Remove loading state
      const saveBtn = document.getElementById('preferences-save-btn');
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
    }
  }

  // Reset preferences to defaults
  async function resetPreferences() {
    try {
      // Show confirmation modal
      const confirmed = await showPreferencesConfirmationModal(
        "Reset Preferences",
        "Are you sure you want to reset all preferences to defaults? This action cannot be undone."
      );

      if (!confirmed) return;

      // Show loading state
      const resetBtn = document.getElementById('preferences-reset-btn');
      resetBtn.classList.add('loading');
      resetBtn.disabled = true;

      const response = await fetch("https://localhost:3000/api/preferences/reset", {
        method: "POST",
        credentials: "include"
      });

      const result = await response.json();

      if (response.ok) {
        showPreferencesToast("Preferences reset to defaults!", "success");
        // Reload preferences to update UI
        populatePreferenceFields(result.preferences);
        console.log("Preferences reset:", result);
      } else {
        throw new Error(result.message || "Failed to reset preferences");
      }

    } catch (error) {
      console.error("Error resetting preferences:", error);
      showPreferencesToast("Failed to reset preferences. Please try again.", "error");
    } finally {
      // Remove loading state
      const resetBtn = document.getElementById('preferences-reset-btn');
      resetBtn.classList.remove('loading');
      resetBtn.disabled = false;
    }
  }

  // Show preferences toast notification
  function showPreferencesToast(message, type = 'success') {
    const toast = document.getElementById('settings-toast');
    toast.textContent = message;
    toast.className = `settings-toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Show confirmation modal for preferences
  function showPreferencesConfirmationModal(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('settings-modal-overlay');
      const modalTitle = document.getElementById('settings-modal-title');
      const modalMessage = document.getElementById('settings-modal-message');
      const confirmBtn = document.getElementById('settings-modal-confirm');
      const cancelBtn = document.getElementById('settings-modal-cancel');
      const closeBtn = document.getElementById('settings-modal-close');

      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modal.classList.add('show');

      // Handle confirm
      const handleConfirm = () => {
        modal.classList.remove('show');
        cleanup();
        resolve(true);
      };

      // Handle cancel/close
      const handleCancel = () => {
        modal.classList.remove('show');
        cleanup();
        resolve(false);
      };

      // Cleanup event listeners
      const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleModalBackdropClick);
      };

      // Handle backdrop click
      const handleModalBackdropClick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };

      // Add event listeners
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
      modal.addEventListener('click', handleModalBackdropClick);
    });
  }

  // Initialize preferences button event listeners
  function initializePreferencesButtons() {
    const saveBtn = document.getElementById('preferences-save-btn');
    const resetBtn = document.getElementById('preferences-reset-btn');

    // Add event listeners
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveUserPreferences();
    });

    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetPreferences();
    });
  }

  // Initialize all preferences functionality
  function initializeAllPreferencesFeatures() {
    initializePreferencesButtons();
    console.log("Preferences functionality initialized");
  }

  // Public API
  return {
    initialize: initializeAllPreferencesFeatures,
    loadPreferences: loadUserPreferences,
    savePreferences: saveUserPreferences,
    resetPreferences: resetPreferences,
    showToast: showPreferencesToast,
    applySavedLanguage: applySavedLanguage  // Export this
  };
}