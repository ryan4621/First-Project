// login.js

document.addEventListener("DOMContentLoaded", () => {
	const boxIcon = document.querySelector(".box-icon");
	const checkedIcon = document.querySelector(".checked-icon");
	// const form1 = document.querySelector(".form1");
	const signin = document.querySelector(".signin");

	// Store login state for 2FA
	let pendingLoginData = null;

	checkedIcon.addEventListener("click", () => {
		checkedIcon.style.display = "none";
		boxIcon.style.display = "block";
	});

	boxIcon.addEventListener("click", () => {
		boxIcon.style.display = "none";
		checkedIcon.style.display = "block";
	});

	function showToast(message, type = "info") {
		console.log("showToast called:", message, type);
		const toast = document.createElement("div");
		toast.className = `toast toast-${type}`;

		// Strong inline styles, with some properties set !important to beat external !important rules
		toast.style.setProperty("display", "block", "important");
		// Use cssText for non-priority styles and keep !important where helpful
		toast.style.cssText += `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 350px;
      opacity: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: translateY(-10px);
      transition: opacity 250ms ease, transform 250ms ease;
    `;

		// Background by type
		switch (type) {
			case "success":
				toast.style.backgroundColor = "#28a745";
				break;
			case "error":
				toast.style.backgroundColor = "#dc3545";
				break;
			case "warning":
				toast.style.backgroundColor = "#ffc107";
				toast.style.color = "#000";
				break;
			default:
				toast.style.backgroundColor = "#007bff";
		}

		toast.textContent = message;
		// append (if body not ready, append to documentElement)
		(document.body || document.documentElement).appendChild(toast);

		// Force reflow and animate in using RAF (reliable)
		setTimeout(() => {
			toast.style.opacity = "1";
			toast.style.transform = "translateY(0)";
		}, 100);

		// Auto remove
		const remove = () => {
			toast.style.opacity = "0";
			toast.style.transform = "translateY(-10px)";
			setTimeout(() => {
				if (toast.parentNode) toast.parentNode.removeChild(toast);
			}, 260);
		};
		setTimeout(remove, 2000);

		return toast;
	}

	// Show 2FA modal
	function show2FAModal(userId, keepMeSignedIn) {
		pendingLoginData = { userId, keepMeSignedIn };

		// Create modal HTML if it doesn't exist
		if (!document.getElementById("twoFactorModal")) {
			const modalHTML = `
        <div class="modal fade" id="twoFactorModal" data-bs-backdrop="static" data-bs-keyboard="false">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0" style="max-width: 400px; margin: auto;">
              <div class="modal-header border-0 pb-0">
                <h5 class="modal-title fw-light">Two-Factor Authentication</h5>
              </div>
              <div class="modal-body">
                <p class="text-muted">Enter the 6-digit code sent to your email address.</p>
                <div class="form-group">
                  <input 
                    type="text" 
                    id="twoFactorCode" 
                    class="form-control text-center border-0" 
                    maxlength="6" 
                    placeholder="000000"
                    style="outline: 1px solid black; font-size: 1.8rem; letter-spacing: 0.8rem; font-family: 'Courier New', monospace;"
                    autocomplete="off"
                  >
                  <small class="form-text text-muted mt-2 d-block">Code expires in 15 minutes</small>
                </div>
                <button type="button" class="btn btn-dark w-100 mt-3" id="verify2FABtn">
                  Verify Code
                </button>
                <button type="button" class="btn btn-link w-100 mt-2" id="resend2FABtn">
                  Resend Code
                </button>
                <button type="button" class="btn btn-link w-100 text-muted" id="cancel2FABtn">
                  Cancel Login
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

			document.body.insertAdjacentHTML("beforeend", modalHTML);

			// Initialize modal event listeners
			const modal = document.getElementById("twoFactorModal");
			const codeInput = document.getElementById("twoFactorCode");
			const verifyBtn = document.getElementById("verify2FABtn");
			const resendBtn = document.getElementById("resend2FABtn");
			const cancelBtn = document.getElementById("cancel2FABtn");

			// Auto-submit when 6 digits entered
			codeInput.addEventListener("input", (e) => {
				e.target.value = e.target.value.replace(/\D/g, "");
				if (e.target.value.length === 6) {
					verifyBtn.click();
				}
			});

			// Verify button
			verifyBtn.addEventListener("click", async () => {
				const code = codeInput.value.trim();
				if (code.length !== 6) {
					showToast("Please enter a 6-digit code", "error");
					return;
				}

				await verify2FACode(code);
			});

			// Resend button
			resendBtn.addEventListener("click", async () => {
				if (!pendingLoginData) return;

				resendBtn.disabled = true;
				resendBtn.textContent = "Sending...";

				try {
					const response = await fetch(`/auth/2fa/resend`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"x-csrf-token": window.getCsrfToken(),
						},
						credentials: "include",
						body: JSON.stringify({ userId: pendingLoginData.userId }),
					});

					const data = await response.json();

					if (response.ok) {
						showToast("New code sent to your email", "success");
						codeInput.value = "";
						codeInput.focus();
					} else {
						showToast(data.message || "Failed to resend code", "error");
					}
				} catch (error) {
					console.error("Resend error:", error);
					showToast("Failed to resend code", "error");
				} finally {
					resendBtn.disabled = false;
					resendBtn.textContent = "Resend Code";
				}
			});

			// Cancel button
			cancelBtn.addEventListener("click", () => {
				const bsModal = bootstrap.Modal.getInstance(modal);
				if (bsModal) bsModal.hide();
				pendingLoginData = null;
				codeInput.value = "";
			});
		}

		// Show the modal
		const modal = new bootstrap.Modal(
			document.getElementById("twoFactorModal")
		);
		modal.show();

		// Focus on input after modal is shown
		document
			.getElementById("twoFactorModal")
			.addEventListener("shown.bs.modal", () => {
				document.getElementById("twoFactorCode").focus();
			});
	}

	// Verify 2FA code
	async function verify2FACode(code) {
		if (!pendingLoginData) return;

		const verifyBtn = document.getElementById("verify2FABtn");
		const codeInput = document.getElementById("twoFactorCode");

		verifyBtn.disabled = true;
		verifyBtn.textContent = "Verifying...";

		try {
			const response = await fetch(`/auth/2fa/verify`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-csrf-token": window.getCsrfToken(),
				},
				credentials: "include",
				body: JSON.stringify({
					userId: pendingLoginData.userId,
					code: code,
					keepMeSignedIn: pendingLoginData.keepMeSignedIn,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				showToast("Login successful!", "success");

				// Hide modal
				const modal = bootstrap.Modal.getInstance(
					document.getElementById("twoFactorModal")
				);
				if (modal) modal.hide();

				// Redirect based on role
				if (data.role === "admin") {
					window.location.href = "../admin/admin.html";
				} else {
					window.location.href = "../user/dashboard.html";
				}
			} else {
				showToast(data.message || "Invalid code", "error");
				codeInput.value = "";
				codeInput.focus();
			}
		} catch (error) {
			console.error("Verification error:", error);
			showToast("Verification failed", "error");
			codeInput.value = "";
			codeInput.focus();
		} finally {
			verifyBtn.disabled = false;
			verifyBtn.textContent = "Verify Code";
		}
	}

	signin.addEventListener("click", async (e) => {
		e.preventDefault();

		console.log("Submit event fired");

		const email = form1.querySelector(".email").value.trim();
		const password = form1.querySelector(".password").value.trim();
		const keepMeSignedIn = checkedIcon.style.display === "block";

		if (!email || !password) {
			showToast("Please enter both email and password.", "error");
			return;
		}

		const token = window.getCsrfToken();
		if (!token) {
			console.error("No CSRF token available, refreshing...");
			await window.initCsrfToken();
		}

		const loginData = { email, password, keepMeSignedIn };
		console.log("Login Data:", loginData);
		console.log("CSRF Token:", window.getCsrfToken());

		try {
			const response = await fetch(`/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-csrf-token": window.getCsrfToken(),
				},
				credentials: "include",
				body: JSON.stringify(loginData),
			});

			const data = await response.json();

			if (!response.ok) {
				// Clear any existing auth cookie on error
				document.cookie =
					"authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

				// Handle email not found
				if (data.emailNotFound) {
					showToast("Email not registered", "error");
					return;
				}

				// Handle specific account status errors
				if (data.accountStatus === "deactivated") {
					showToast(
						"Account deactivated, contact support for more info",
						"error"
					);
					return;
				}

				if (data.accountStatus === "suspended") {
					showToast(
						"Account suspended, contact support for more info",
						"error"
					);
					return;
				}

				if (data.accountStatus === "deleted") {
					showToast("Account deleted, contact support for more info", "error");
					return;
				}

				// Handle other errors
				throw new Error(data.message || "Login failed");
			}

			// Check if 2FA is required
			if (data.requires2FA) {
				showToast("Verification code sent to your email", "info");
				show2FAModal(data.userId, keepMeSignedIn);
				return;
			}

			// Success - redirect based on role
			if (data.role === "admin" || data.role === "super_admin") {
				window.location.href = "../admin/admin.html";
			} else {
				window.location.href = "../user/dashboard.html";
			}

			console.log("Server response:", data);
			console.log("Login successful! Role:", data.role);
		} catch (error) {
			console.error("Error:", error);
			showToast(error.message, "error");
		}
	});
});
