//signup.js

document.addEventListener("DOMContentLoaded", () => {
  const form2 = document.querySelector(".form2");
  const form1 = document.querySelector(".form1")

  // Handle Sign Up form submission
  form2.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = form2.querySelector('input[name="email"]').value.trim();
    const name = form2.querySelector('input[name="name"]').value.trim();
    const password = form2.querySelector('input[name="pwd"]').value.trim();
    const subscribe = form2.querySelector('input[name="signedin"]').checked;
    
    // Basic validation
    if (!name || !email || !password) {
      showToast("Please fill in all required fields.", "error");
      return;
    }
    
    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showToast("Please enter a valid email address.", 'error')
      return;
    }
    
    // Password validation
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordPattern.test(password)) {
      showToast("Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.", 'error')
      return;
    }
    
    const signupData = { name, email, password, subscribe };
    
    try {
      const response = await fetch("https://localhost:3000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: 'include',
        body: JSON.stringify(signupData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }
      
      // Show verification modal/page
      showVerificationModal(email);

      const resendBtn = document.querySelector(".resend-btn")
      const cooldownDiv = document.getElementById("resend-cooldown");
      const countdownTimer = document.getElementById("countdown-timer");
      
      resendBtn.disabled = true;
      resendBtn.textContent = "Resend Verification Email"
        // Start cooldown
        cooldownDiv.style.display = 'block';
        let secondsRemaining = 60;
        countdownTimer.textContent = secondsRemaining;
        
        const cooldownInterval = setInterval(() => {
          secondsRemaining--;
          countdownTimer.textContent = secondsRemaining;
          
          if (secondsRemaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownDiv.style.display = 'none';
            resendBtn.disabled = false;
          }
        }, 1000);
      
    } catch (error) {
      console.error("Error:", error);
      showToast(error.message, 'error')
    }
  });
  
  // Show verification modal
  function showVerificationModal(email) {
    // Hide registration form
    document.querySelector('.form2').style.display = 'none';
    
    // Show verification message
    const container = document.querySelector('.container2');
    container.innerHTML = `
      <div class="verification-container text-center p-4">
        <div class="verification-icon mb-3">
          <i class="bi bi-envelope-check" style="font-size: 4rem; color: #28a745;"></i>
        </div>
        <h3>Verify Your Email</h3>
        <p class="mt-3">We've sent a verification email to:</p>
        <p class="fw-bold">${email}</p>
        <p class="text-muted mt-3">Please check your inbox and click the verification link to complete your registration.</p>
        <p class="text-muted">The link will expire in 24 hours.</p>
        
        <div class="mt-4">
          <p class="text-muted">Didn't receive the email?</p>
          <button class="btn resend-btn btn-outline-dark" onclick="resendVerification('${email}')">Resend Verification Email</button>
          <div class="resend-cooldown" id="resend-cooldown" style="display: none; margin-top: 10px; color: #666;">
            <p>You can resend in <span id="countdown-timer">60</span> seconds</p>
          </div>
        </div>
        
        <div class="mt-4">
          <a href="farfetch.html" class="text-dark">Return to homepage</a>
        </div>
      </div>
    `;
    startVerificationCheck(email);
  }
  
  // Resend verification function (make it global)
  window.resendVerification = async function(email) {
    try {

      const resendBtn = document.querySelector(".resend-btn")
      const cooldownDiv = document.getElementById("resend-cooldown");
      const countdownTimer = document.getElementById("countdown-timer");

      resendBtn.disabled = true;
      resendBtn.textContent = "Resending email..."

      const freshToken = await window.refreshCsrfToken();
    
      if (!freshToken) {
        showToast("Security token expired. Please refresh the page.", 'error')
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend Verification Email";
        return;
      }
      
      const response = await fetch("https://localhost:3000/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'x-csrf-token': freshToken
        },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast("Verification email sent! Please check your inbox.", 'success')
        resendBtn.textContent = "Resend Verification Email"
        // Start cooldown
        cooldownDiv.style.display = 'block';
        let secondsRemaining = 60;
        countdownTimer.textContent = secondsRemaining;
        
        const cooldownInterval = setInterval(() => {
          secondsRemaining--;
          countdownTimer.textContent = secondsRemaining;
          
          if (secondsRemaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownDiv.style.display = 'none';
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend Verification Email";
          }
        }, 1000);
      } else {
        // Check if email is already verified
        if (data.alreadyVerified) {
          showToast("Email already verified. Please log in to your account.", 'info')
        } else {
          showToast(data.message || "Failed to resend email", 'error')
        }
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend Verification Email";
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("Failed to resend verification email", 'error')
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification Email"
    }
  };

  // Toggle "Keep me signed in" icon
  const checkboxContainer = form1.querySelector(".form-check");
  if (checkboxContainer) {
    const checkedIcon = checkboxContainer.querySelector(".checked-icon");
    const boxIcon = checkboxContainer.querySelector(".box-icon");
    checkboxContainer.addEventListener("click", () => {
      if (checkedIcon.style.display === "none") {
        checkedIcon.style.display = "inline-block";
        boxIcon.style.display = "none";
      } else {
        checkedIcon.style.display = "none";
        boxIcon.style.display = "inline-block";
      }
    });
  }

  // Add this function to signup.js

  // Check verification status periodically (optional enhancement)
  function startVerificationCheck(email) {
    let checkCount = 0;
    const maxChecks = 60; // Check for 5 minutes (60 × 5 seconds)
    
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        return;
      }
      
      try {
        // Check if email is verified
        const response = await fetch(`https://localhost:3000/auth/check-verification?email=${encodeURIComponent(email)}`, {
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.verified) {
          clearInterval(checkInterval);
          
          // Remove waiting modal
          const container = document.querySelector('.container2');
          if (container) {
            // Show success message
            container.innerHTML = `
              <div class="verification-container text-center p-4">
                <div class="verification-icon mb-3">
                  <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
                </div>
                <h3>Email Verified!</h3>
                <p class="mt-3">Your email has been successfully verified.</p>
                <button class="btn btn-dark mt-3" onclick="window.location.reload()">Continue to Sign In</button>
              </div>
            `;
          }
        }
      } catch (error) {
        console.error('Verification check error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  // Call this after showing verification modal
  // Add to your existing showVerificationModal function after it displays:
  // startVerificationCheck(email);
});