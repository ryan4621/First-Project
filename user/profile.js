//profile.js
document.addEventListener("DOMContentLoaded", async () => {

  function bannerEmailVerify(){
    document.getElementById('banner-verify-btn').addEventListener('click', async () => {
      const btn = document.getElementById('banner-verify-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      
      try {
        // Refresh CSRF token before sending
        const freshToken = await window.refreshCsrfToken();
        
        if (!freshToken) {
          showToast("Security token expired. Please refresh the page.", 'error')
          btn.disabled = false;
          btn.textContent = 'Resend verification';
          return;
        }

        const response = await fetch("https://localhost:3000/auth/resend-verification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'x-csrf-token': freshToken
          },
          credentials: "include",
          body: JSON.stringify({ email: user.user.email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          showToast("Verification email sent! Please check your inbox.", 'success')
          btn.textContent = 'Resend verification';

          // Get cooldown duration from server response
          const cooldownSeconds = data.cooldownSeconds || 60;
          const cooldownEndTime = Date.now() + (cooldownSeconds * 1000);
          localStorage.setItem('resendCooldownEnd', cooldownEndTime);
          
          // Start cooldown
          startResendCooldown();
        }else if (response.status === 429) {
          // Server says too many requests - sync client cooldown with server
          showToast(data.message || "Please wait before requesting another email", 'error')
          btn.textContent = 'Resend verification';
          
          if (data.remainingSeconds) {
            const cooldownEndTime = Date.now() + (data.remainingSeconds * 1000);
            localStorage.setItem('resendCooldownEnd', cooldownEndTime);
            startResendCooldown();
          } else {
            btn.disabled = false;
            btn.textContent = 'Resend verification';
          }
        } else {
          // Check if email is already verified
          if (data.alreadyVerified) {
            reloadWithToast("This email is already verified.", 'info')
          } else {
            showToast(data.message || "Failed to send verification email", 'error')
            btn.disabled = false;
            btn.textContent = 'Resend verification';
          }
        }
      } catch (error) {
        console.error('Error:', error);
        showToast("Failed to send verification email", 'error')
        btn.disabled = false;
        btn.textContent = 'Resend verification';
      }
    });
  };

  let user;
  const profileDiv = document.querySelector(".profile-info");

  // 🔹 Check if user is logged in
  try {
    const response = await fetch("https://localhost:3000/api/profile", {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) {
      window.location.href = "../frontend/farfetch.html";
      return;
    }

    user = await response.json();

    profileDiv.innerHTML = `
    <ul>
      <li id="display-name"><strong>Name:</strong> ${user.user.name || "Not set"}</li>
      <li id="display-email"><strong>Email:</strong> ${user.user.email || "Not set"}</li>
      <li id="display-phone"><strong>Phone:</strong> ${user.user.phone || "Not set"}</li>
      <li id="display-gender"><strong>Gender:</strong> ${user.user.gender || "Not set"}</li>
      <li id="display-country"><strong>Country:</strong> ${user.user.country || "Not set"}</li>
    </ul>
    `;

    // Handle email verification display
    const emailDisplay = document.getElementById('display-email');
    if (user.user.email_verified) {
      emailDisplay.innerHTML = `<strong>Email:</strong> ${user.user.email} <span class="badge bg-success ms-2"><i class="bi bi-check-circle-fill"></i> Verified</span>`;
    } else {
      // Show inline verify button
      emailDisplay.innerHTML = `
        <strong>Email:</strong> ${user.user.email} 
        <span class="badge bg-warning text-dark ms-2"><i class="bi bi-exclamation-circle-fill"></i> Not Verified</span>
      `;
    };

    // Show banner alert if email not verified (OUTSIDE the if/else)
    if (!user.user.email_verified) {
      const alertBanner = document.getElementById('email-verification-alert');
      if (alertBanner) {
        alertBanner.style.display = 'block';
        bannerEmailVerify();
        // Add this line to check for existing cooldown
        checkResendCooldown();
      }
    }

    // Gender select
    const genderSelect = document.querySelector('#select-gender');
    if (user.user.gender) {
      genderSelect.value = user.user.gender;
    }

  } catch (err) {
    console.error("Auth check failed:", err);
    redirectWithToast('Error loggin in', 'error', '../frontend/farfetch.html')
    return;
  }

  const countrySelect = document.querySelector('#select-country');

  // Clear existing options except the first placeholder
  countrySelect.innerHTML = `<option selected disabled>Select Country</option>`;

  // Fetch countries from your backend
  try {
    const res = await fetch("https://localhost:3000/api/countries");
    const countries = await res.json();

    countries.forEach(country => {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      countrySelect.appendChild(option);
    });

    // Set current user's country if it exists
    if (user.user.country) {
      countrySelect.value = user.user.country;
    }

  } catch (err) {
    console.error("Failed to load countries:", err);
  }

  const updateBtn = document.getElementById("edit-details-btn");
  const cancelBtn = document.getElementById("cancel-edit-btn");
  const editForm = document.getElementById("details-form");
  const detailsDisplay = document.querySelector(".profile-info");

  // Switch to edit mode
  updateBtn.addEventListener("click", () => {
    detailsDisplay.style.display = "none";
    updateBtn.style.display = "none";
    editForm.style.display = "block";
  });

  // Cancel editing
  cancelBtn.addEventListener("click", () => {
    editForm.style.display = "none";
    detailsDisplay.style.display = "block";
    updateBtn.style.display = "block";
  });

  function startResendCooldown() {
    const btn = document.getElementById('banner-verify-btn');
    const cooldownDiv = document.getElementById("resend-cooldown");
    const countdownTimer = document.getElementById("countdown-timer");
    
    btn.disabled = true;
    cooldownDiv.style.display = 'block';
    
    function updateCooldown() {
      const cooldownEndTime = localStorage.getItem('resendCooldownEnd');
      if (!cooldownEndTime) {
        clearInterval(cooldownInterval);
        return;
      }
      
      const secondsRemaining = Math.ceil((cooldownEndTime - Date.now()) / 1000);
      
      if (secondsRemaining <= 0) {
        clearInterval(cooldownInterval);
        localStorage.removeItem('resendCooldownEnd');
        cooldownDiv.style.display = 'none';
        btn.disabled = false;
      } else {
        countdownTimer.textContent = secondsRemaining;
      }
    }
    
    updateCooldown();
    const cooldownInterval = setInterval(updateCooldown, 1000);
  }

  function checkResendCooldown() {
    const cooldownEndTime = localStorage.getItem('resendCooldownEnd');
    
    if (cooldownEndTime) {
      const secondsRemaining = Math.ceil((cooldownEndTime - Date.now()) / 1000);
      
      if (secondsRemaining > 0) {
        startResendCooldown();
      } else {
        localStorage.removeItem('resendCooldownEnd');
      }
    }
  }

  // Pre-fill form inputs
  editForm.querySelector('input[name="name"]').value = user.user.name || "";
  editForm.querySelector('input[name="email"]').value = user.user.email || "";
  const phoneInput = editForm.querySelector('input[name="phone"]');
  phoneInput.value = user.user.phone || "";
  phoneInput.placeholder = user.user.phone ? "Input Phone Number" : "";

  // Handle form submission
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const updateSubmitBtn = editForm.querySelector('.profile-btn-primary')
    updateSubmitBtn.disabled = true;
    updateSubmitBtn.textContent = 'Updating...';

    const formData = new FormData(editForm);
    const data = Object.fromEntries(formData.entries());

    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.email)) {
      showToast("Please enter a valid email address.", 'error')
      updateSubmitBtn.disabled = false;
      updateSubmitBtn.textContent = 'Save Changes';
      return;
    }

    const isUnchanged =
      data.name === user.user.name &&
      data.email === user.user.email &&
      data.phone === (user.user.phone || "") &&
      data.gender === (user.user.gender || "") &&
      data.country === (user.user.country || "");
    
    if(isUnchanged){
      editForm.style.display = "none"
      detailsDisplay.style.display = "block"
      updateBtn.style.display = "block";
      updateSubmitBtn.disabled = false;
      updateSubmitBtn.textContent = 'Save Changes';
      return;
    }

    // Validate required fields
    if (!data.name || !data.email || !data.phone || !data.gender || !data.country) {
      showToast("All fields must be filled before saving.", 'error')
      updateSubmitBtn.disabled = false;
      updateSubmitBtn.textContent = 'Save Changes';
      return;
    }

    try {
      const response = await fetch("https://localhost:3000/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message, 'success')

        // Store old email for comparison BEFORE updating user object
        const oldEmail = user.user.email;
        
        // Update user object
        user.user = result.user;

        // Rebuild profile display with updated data
        profileDiv.innerHTML = `
          <ul>
            <li id="display-name"><strong>Name:</strong> ${result.user.name}</li>
            <li id="display-email"><strong>Email:</strong> ${result.user.email}</li>
            <li id="display-phone"><strong>Phone:</strong> ${result.user.phone}</li>
            <li id="display-gender"><strong>Gender:</strong> ${result.user.gender}</li>
            <li id="display-country"><strong>Country:</strong> ${result.user.country}</li>
          </ul>
        `;

        // Update email display with verification status
        const emailDisplay = document.getElementById('display-email');
        if (result.user.email_verified) {
          emailDisplay.innerHTML = `<strong>Email:</strong> ${result.user.email} <span class="badge bg-success ms-2"><i class="bi bi-check-circle-fill"></i> Verified</span>`;
        } else {
          emailDisplay.innerHTML = `
            <strong>Email:</strong> ${result.user.email} 
            <span class="badge bg-warning text-dark ms-2"><i class="bi bi-exclamation-circle-fill"></i> Not Verified</span>
          `;
        }

        // If email was changed, set cooldown for resend button
        if (data.email !== oldEmail) {
          const cooldownEndTime = Date.now() + (60 * 1000);
          localStorage.setItem('resendCooldownEnd', cooldownEndTime);
        }

        editForm.style.display = "none";
        detailsDisplay.style.display = "block";
        updateBtn.style.display = "block";

        // Reload page to reflect changes and restore cooldown
        window.location.reload();

      } else {
        showToast("Update failed: " + (result.message || "Unknown error"), 'error')
        updateSubmitBtn.disabled = false;
        updateSubmitBtn.textContent = 'Save Changes';
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("Something went wrong. Please try again later.", 'error')
      updateSubmitBtn.disabled = false;
      updateSubmitBtn.textContent = 'Save Changes';
    }
  });


  const profileFileInput = document.getElementById('profileFileInput');
  const profileUploadArea = document.getElementById('profileUploadArea');
  const profileCurrentPhoto = document.getElementById('profileCurrentPhoto');
  const profileUploadInstructions = document.getElementById('profileUploadInstructions');
  const profilePreviewArea = document.getElementById('profilePreviewArea');
  const profilePreviewImage = document.getElementById('profilePreviewImage');
  const profileUploadButtons = document.getElementById('profileUploadButtons');
  const profileUploadBtn = document.getElementById('profileUploadBtn');
  const profileCancelUploadBtn = document.getElementById('profileCancelUploadBtn');
  const profileReuploadBtn = document.getElementById('profileReuploadBtn');
  const profileProgressContainer = document.getElementById('profileProgressContainer');
  const profileProgressFill = document.getElementById('profileProgressFill');
  const profileProgressText = document.getElementById('profileProgressText');
  const profileErrorMessage = document.getElementById('profileErrorMessage');
  const profileSuccessMessage = document.getElementById('profileSuccessMessage');

  let profileSelectedFile = null;
  let profileUploadInProgress = false;

  // Load current profile photo on page load
  async function loadCurrentProfilePhoto() {
    try {
      const response = await fetch('https://localhost:3000/auth/me', { 
        credentials: 'include' 
      });
      
      // console.log('Response status:', response.status);
      
      const user = await response.json();
      // console.log('Full user object:', user);
      // console.log('Profile image value:', user.profile_image);
      // console.log('Type of profile_image:', typeof user.profile_image);
      
      if (user.profile_image) {
        // console.log('Calling updateCurrentProfilePhoto with:', user.profile_image);
        updateCurrentProfilePhoto(user.profile_image);
      } else {
        console.log('No profile_image found in user object');
      }
    } catch (error) {
      console.error('Failed to load current photo:', error);
    }
  }

  loadCurrentProfilePhoto(); 

  // Click profile photo to show upload area
  profileCurrentPhoto.addEventListener('click', () => {
    if (!profileUploadInProgress) {
      showProfileUploadArea();
    }
  });

  // Show upload area and instructions
  function showProfileUploadArea() {
    profileUploadInstructions.style.display = 'block';
    profileUploadArea.style.display = 'block';
    profilePreviewArea.style.display = 'none';
    profileUploadButtons.style.display = 'none';
  }

  // Hide upload area and instructions
  function hideProfileUploadArea() {
    profileUploadInstructions.style.display = 'none';
    profileUploadArea.style.display = 'none';
    profilePreviewArea.style.display = 'none';
    profileUploadButtons.style.display = 'none';
  }

  // Click upload area to select file
  profileUploadArea.addEventListener('click', () => {
    if (!profileUploadInProgress) {
      profileFileInput.click();
    }
  });

  // Drag and drop functionality
  profileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    profileUploadArea.classList.add('profile-dragover');
  });

  profileUploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    profileUploadArea.classList.remove('profile-dragover');
  });

  profileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    profileUploadArea.classList.remove('profile-dragover');
    
    if (!profileUploadInProgress && e.dataTransfer.files.length > 0) {
      handleProfileFileSelect(e.dataTransfer.files[0]);
    }
  });

  // File input change
  profileFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleProfileFileSelect(e.target.files[0]);
    }
  });

  // Handle file selection
  function handleProfileFileSelect(file) {
    hideProfileMessages();

    if (!validateProfileFile(file)) {
        return;
    }

    profileSelectedFile = file;
    showProfilePreview(file);
  }

  // Show preview area
  function showProfilePreview(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      profilePreviewImage.src = e.target.result;
      profileUploadArea.style.display = 'none';
      profilePreviewArea.style.display = 'block';
      profileUploadButtons.style.display = 'flex';
    };
    
    reader.readAsDataURL(file);
  }

  // Validate file
  function validateProfileFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      showProfileError('Please select a valid image file (PNG, JPG, JPEG)');
      return false;
    }

    if (file.size > maxSize) {
      showProfileError('File size must be less than 5MB');
      return false;
    }

    return true;
  }

  // Reupload button - show upload area again
  profileReuploadBtn.addEventListener('click', () => {
    profileSelectedFile = null;
    profileFileInput.value = '';
    showProfileUploadArea();
  });

  // Cancel button
  profileCancelUploadBtn.addEventListener('click', () => {
    resetProfileUpload();
  });

  // Upload button
  profileUploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // e.stopPropagation();
    if (profileSelectedFile && !profileUploadInProgress) {
      uploadProfileFile();
    }
  });

  // Upload file using ImageKit
  async function uploadProfileFile() {
    if (!profileSelectedFile) return;

    profileUploadInProgress = true;
    profileUploadBtn.disabled = true;
    profileUploadBtn.textContent = 'Uploading...';
    profileProgressContainer.style.display = 'block';
    hideProfileMessages();

    try {
      // Start progress animation
      simulateProfileProgress();

      // Get ImageKit signature from backend
      const sigRes = await fetch("https://localhost:3000/api/upload-signature", {
        credentials: "include"
      });

      if (!sigRes.ok) {
        throw new Error('Failed to get upload token');
      }
  
      const sigData = await sigRes.json();

      // Upload to ImageKit
      const formData = new FormData();
      formData.append("file", profileSelectedFile);
      formData.append("publicKey", "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=");
      formData.append("signature", sigData.signature);
      formData.append("expire", sigData.expire);
      formData.append("token", sigData.token);
      formData.append("fileName", `profile-${Date.now()}-${profileSelectedFile.name}`);

      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData
      });

      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        // Update user profile with new image URL
        const updateRes = await fetch("https://localhost:3000/api/update-profile-photo", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            'x-csrf-token': window.getCsrfToken()
          },
          credentials: "include",
          body: JSON.stringify({ profile_image: uploadData.url })
        });

        if (updateRes.ok) {
          showProfileSuccess('Profile photo uploaded successfully!');
          updateCurrentProfilePhoto(uploadData.url);

          // Hide everything except the profile photo circle after successful upload
          setTimeout(() => {
            resetProfileUpload();
          }, 2000);
        } else {
          const errorData = await updateRes.json();
          showProfileError(errorData.message || 'Failed to update profile');
        }
      } else {
        showProfileError('Image upload failed. Please try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showProfileError('Network error. Please check your connection and try again.');
    } finally {
      profileUploadInProgress = false;
      profileUploadBtn.disabled = false;
      profileUploadBtn.textContent = 'Upload Photo';
      profileProgressContainer.style.display = 'none';
    }
  }

  // Simulate upload progress
  function simulateProfileProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 100) {
        progress = 100;
        clearInterval(interval);
      }
      profileProgressFill.style.width = progress + '%';
      profileProgressText.textContent = `Uploading... ${Math.round(progress)}%`;
    }, 200);
  }

  // Reset upload state
  function resetProfileUpload() {
    profileSelectedFile = null;
    profileFileInput.value = '';
    hideProfileUploadArea();
    hideProfileMessages();
    profileProgressFill.style.width = '0%';
  }

  // Update current photo display (persists after reload)
  function updateCurrentProfilePhoto(photoUrl) {
    // console.log('updateCurrentProfilePhoto called with:', photoUrl);
    // console.log('Current photo element exists?', !!profileCurrentPhoto);
  
    profileCurrentPhoto.innerHTML = `<img src="${photoUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;

    // console.log('innerHTML set to:', profileCurrentPhoto.innerHTML);
  }

  // Message functions
  function showProfileError(message) {
    profileErrorMessage.textContent = message;
    profileErrorMessage.style.display = 'block';
    profileSuccessMessage.style.display = 'none';
  }

  function showProfileSuccess(message) {
    profileSuccessMessage.textContent = message;
    profileSuccessMessage.style.display = 'block';
    profileErrorMessage.style.display = 'none';
  }

  function hideProfileMessages() {
    profileErrorMessage.style.display = 'none';
    profileSuccessMessage.style.display = 'none';
  }

  class PaymentMethodManager {
    constructor() {
      this.stripe = null;
      this.elements = null;
      this.cardElement = null;
      this.setupIntent = null;
      this.stripePublishableKey = 'pk_test_51SAMlKAJvXS66ZSZFjuWB6eFvikg9ZO09VFJTCmSixa7JtqW7ya1zNilnBMUr3RxFjbBD6W8KyVP1zHFqWz9PzZT00SqysCRXu'; // Replace with your actual key
      
      this.init();
    }

    async init() {
      this.setupEventListeners();
      await this.loadPaymentMethods();
    }

    setupEventListeners() {
      // Add payment method button
      document.getElementById('add-payment-method-btn').addEventListener('click', () => {
        this.openAddPaymentMethodModal();
      });

      // Close modal buttons - UPDATED IDs
      document.getElementById('payment-close-modal').addEventListener('click', () => {
        this.closeModal();
      });
      
      document.getElementById('payment-cancel-btn').addEventListener('click', () => {
        this.closeModal();
      });

      // Form submission - UPDATED ID
      document.getElementById('payment-add-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePaymentMethod();
      });

      // Confirmation modal - UPDATED ID
      document.getElementById('payment-confirm-cancel').addEventListener('click', () => {
        this.closeConfirmModal();
      });
    }

    async loadPaymentMethods() {
      const loadingElement = document.getElementById('payment-methods-loading');
      const listElement = document.getElementById('payment-methods-list');

      try {
        const response = await fetch('https://localhost:3000/api/payment-methods', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to load payment methods');
        }

        const data = await response.json();
        
        if (loadingElement) {
          loadingElement.style.display = 'none'; // Hide loading instead of remove
        }
        
        this.renderPaymentMethods(data.paymentMethods);

      } catch (error) {
        console.error('Load payment methods error:', error);
        if (loadingElement) {
          loadingElement.style.display = 'none';
        }
        if (listElement) {
          listElement.innerHTML = '<p style="color: #dc3545;">Failed to load payment methods. Please refresh the page.</p>';
        }
      }
    }

    renderPaymentMethods(paymentMethods) {
      const listElement = document.getElementById('payment-methods-list');
      
      if (paymentMethods.length === 0) {
        listElement.innerHTML = `
          <div class="empty-state">
            <h4>No Payment Methods</h4>
            <p>Add a payment method to make checkout faster and easier.</p>
          </div>
        `;
        return;
      }

      listElement.innerHTML = paymentMethods.map(pm => `
        <div class="payment-method-card ${pm.is_default ? 'default' : ''}">
          <div class="payment-method-info">
            <h4>
              ${pm.card_brand.charAt(0).toUpperCase() + pm.card_brand.slice(1)} **** ${pm.card_last4}
              ${pm.is_default ? '<span class="default-badge">Default</span>' : ''}
            </h4>
            <p>Expires ${pm.card_exp_month}/${pm.card_exp_year}</p>
          </div>
          <div class="payment-method-actions">
            ${!pm.is_default ? `<button class="btn-small btn-primary" onclick="paymentMethodManager.setDefault(${pm.id})">Set Default</button>` : ''}
            <button class="btn-small btn-danger" onclick="paymentMethodManager.deletePaymentMethod(${pm.id}, '${pm.card_brand} **** ${pm.card_last4}')">Delete</button>
          </div>
        </div>
      `).join('');
    }

    async openAddPaymentMethodModal() {
      try {
        // Create setup intent
        const response = await fetch('https://localhost:3000/api/payment-methods/setup-intent', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'x-csrf-token': window.getCsrfToken()
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create setup intent');
        }

        const data = await response.json();
        
        // Initialize Stripe with your publishable key
        this.stripe = Stripe(this.stripePublishableKey);
        
        // Setup Stripe Elements
        const style = {
          base: {
            color: '#424770',
            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': { color: '#aab7c4' }
          },
          invalid: { color: '#9e2146', iconColor: '#fa755a' }
        };

        this.elements = this.stripe.elements();
        this.cardElement = this.elements.create('card', { style });
        
        // Show modal - UPDATED ID
        document.getElementById('payment-modal-overlay').style.display = 'flex';
        
        // Mount card element - UPDATED ID
        setTimeout(() => {
          const cardContainer = document.getElementById('payment-card-element');
          if (cardContainer) {
            this.cardElement.mount('#payment-card-element');
            
            this.cardElement.on('change', ({error}) => {
              const displayError = document.getElementById('payment-card-errors');
              if (displayError) {
                displayError.textContent = error ? error.message : '';
              }
            });
          }
        }, 100);

        this.setupIntent = data;

      } catch (error) {
        console.error('Error opening add payment method modal:', error);
        this.showError('Failed to initialize payment method form: ' + error.message);
      }
    }

    async savePaymentMethod() {
      const submitBtn = document.getElementById('payment-save-btn');
      const btnText = document.getElementById('payment-save-btn-text');
      const btnLoading = document.getElementById('payment-save-btn-loading');
      
      try {
        // Show loading
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';

        // Get setup intent from Stripe
        const {setupIntent, error} = await this.stripe.confirmCardSetup(
          this.setupIntent.clientSecret,
          {
            payment_method: {
              card: this.cardElement,
            }
          }
        );

        if (error) {
          throw new Error(error.message);
        }

        // Save to backend - UPDATED ID
        const isDefault = document.getElementById('payment-set-default').checked;
        
        const response = await fetch('https://localhost:3000/api/payment-methods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': window.getCsrfToken()
            },
          credentials: 'include',
          body: JSON.stringify({
            setupIntentId: setupIntent.id,
            isDefault: isDefault
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to save payment method');
        }

        this.showSuccess('Payment method added successfully!');
        
        setTimeout(() => {
          this.closeModal();
          this.loadPaymentMethods();
        }, 1500);

      } catch (error) {
        console.error('Save payment method error:', error);
        this.showError(error.message);
      } finally {
        // Reset loading state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
      }
    }

    async setDefault(paymentMethodId) {
        try {
            const response = await fetch(`https://localhost:3000/api/payment-methods/${paymentMethodId}/default`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'x-csrf-token': window.getCsrfToken()
                }
            });

            if (!response.ok) {
                throw new Error('Failed to set default payment method');
            }

            await this.loadPaymentMethods();
            this.showToast('Default payment method updated');

        } catch (error) {
            console.error('Set default error:', error);
            this.showToast(error.message, 'error');
        }
    }

    deletePaymentMethod(paymentMethodId, cardDisplay) {
        this.showConfirmModal(
            `Are you sure you want to delete ${cardDisplay}?`,
            async () => {
                try {
                    const response = await fetch(`https://localhost:3000/api/payment-methods/${paymentMethodId}`, {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: {
                            'x-csrf-token': window.getCsrfToken()
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete payment method');
                    }

                    this.closeConfirmModal();
                    await this.loadPaymentMethods();
                    this.showToast('Payment method deleted');

                } catch (error) {
                    console.error('Delete error:', error);
                    this.showToast(error.message, 'error');
                }
            }
        );
    }

    showConfirmModal(message, onConfirm) {
      document.getElementById('payment-confirm-message').textContent = message;
      document.getElementById('payment-confirm-overlay').style.display = 'flex';
      
      const confirmBtn = document.getElementById('payment-confirm-action');
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      
      newConfirmBtn.addEventListener('click', onConfirm);
    }
  
    closeConfirmModal() {
      document.getElementById('payment-confirm-overlay').style.display = 'none';
    }
  
    closeModal() {
      document.getElementById('payment-modal-overlay').style.display = 'none';
      
      // Clean up Stripe elements
      if (this.cardElement) {
          this.cardElement.unmount();
          this.cardElement = null;
      }
      
      // Reset form
      document.getElementById('payment-add-form').reset();
      this.clearMessages();
    }
  
    showError(message) {
      const errorEl = document.getElementById('payment-method-errors');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      
      const successEl = document.getElementById('payment-method-success');
      successEl.style.display = 'none';
    }
  
    showSuccess(message) {
      const successEl = document.getElementById('payment-method-success');
      successEl.textContent = message;
      successEl.style.display = 'block';
      
      const errorEl = document.getElementById('payment-method-errors');
      errorEl.style.display = 'none';
    }
  
    clearMessages() {
      document.getElementById('payment-method-errors').style.display = 'none';
      document.getElementById('payment-method-success').style.display = 'none';
      const cardErrors = document.getElementById('payment-card-errors');
      if (cardErrors) cardErrors.textContent = '';
    }
  
    showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 10001;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
      `;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      setTimeout(() => toast.style.transform = 'translateX(0)', 100);
      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  //  Initialize when DOM is loaded
  window.paymentMethodManager = new PaymentMethodManager();
});