//settings.js

document.addEventListener("DOMContentLoaded", async () => {
	// Import modules
	const { initializePreferences } = await import("./preferences.js");
	const { initializeSecurity } = await import("./security.js");

	// Initialize modules
	const preferences = initializePreferences();
	const security = initializeSecurity();

	// Tab switching functionality
	function initializeTabSwitching() {
		const preferencesTabBtn = document.getElementById("preferences-tab-btn");
		const securityTabBtn = document.getElementById("security-tab-btn");
		const preferencesSection = document.getElementById("preferences-section");
		const securitySection = document.getElementById("security-section");

		// Function to switch tabs
		function switchTab(activeTab) {
			// Remove active class from all tab buttons
			preferencesTabBtn.classList.remove("active");
			securityTabBtn.classList.remove("active");

			// Hide all sections
			preferencesSection.classList.add("hidden");
			securitySection.classList.add("hidden");

			// Show the selected tab and section
			if (activeTab === "preferences") {
				preferencesTabBtn.classList.add("active");
				preferencesSection.classList.remove("hidden");
			} else if (activeTab === "security") {
				securityTabBtn.classList.add("active");
				securitySection.classList.remove("hidden");
			}
		}

		// Add click event listeners to tab buttons
		preferencesTabBtn.addEventListener("click", (e) => {
			e.preventDefault();
			switchTab("preferences");
		});

		securityTabBtn.addEventListener("click", (e) => {
			e.preventDefault();
			switchTab("security");
		});

		// Handle keyboard navigation for accessibility
		function handleTabKeyboard(e) {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				e.target.click();
			}
		}

		preferencesTabBtn.addEventListener("keydown", handleTabKeyboard);
		securityTabBtn.addEventListener("keydown", handleTabKeyboard);

		// Initialize with preferences tab active (default)
		switchTab("preferences");
	}

	// Check if user is authenticated
	async function checkAuthentication() {
		try {
			const response = await fetch(`/auth/me`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				window.location.href = "../frontend/farfetch.html";
				return false;
			}

			const userData = await response.json();
			// console.log("Authenticated user:", userData);
			return true;
		} catch (error) {
			console.error("Authentication check failed:", error);
			window.location.href = "../frontend/farfetch.html";
			return false;
		}
	}

	// Initialize everything
	async function initialize() {
		// Check if user is authenticated first
		const isAuthenticated = await checkAuthentication();
		if (!isAuthenticated) return;

		// Initialize tab switching
		initializeTabSwitching();

		// Initialize preferences functionality
		preferences.initialize();

		// Initialize security functionality
		security.initialize();

		initializeCollapsibleCards();

		// Load user preferences
		await preferences.loadPreferences();

		// Apply saved language AFTER preferences are loaded
		await preferences.applySavedLanguage();

		console.log("Settings page fully initialized");
	}

	// // Logout functionality with confirmation
	// function initializeLogout() {
	//   const logoutBtn = document.querySelector('.logout-btn');

	//   logoutBtn.addEventListener('click', async (e) => {
	//     e.preventDefault();

	//     // Show confirmation modal
	//     const confirmed = await showLogoutConfirmationModal();
	//     if (!confirmed) return;

	//     try {
	//       const response = await fetch(`/logout`, {
	//         method: "POST",
	//         credentials: "include"
	//       });

	//       if (response.ok) {
	//         window.location.href = "../frontend/farfetch.html";
	//       } else {
	//         window.location.href = "../frontend/farfetch.html";
	//       }
	//     } catch (error) {
	//       console.error("Logout error:", error);
	//       window.location.href = "../frontend/farfetch.html";
	//     }
	//   });
	// }

	// // Show logout confirmation modal
	// function showLogoutConfirmationModal() {
	//   return new Promise((resolve) => {
	//     const modal = document.getElementById('settings-modal-overlay');
	//     const modalTitle = document.getElementById('settings-modal-title');
	//     const modalMessage = document.getElementById('settings-modal-message');
	//     const confirmBtn = document.getElementById('settings-modal-confirm');
	//     const cancelBtn = document.getElementById('settings-modal-cancel');
	//     const closeBtn = document.getElementById('settings-modal-close');

	//     modalTitle.textContent = "Confirm Logout";
	//     modalMessage.textContent = "Are you sure you want to log out of your account?";
	//     confirmBtn.textContent = "Logout";
	//     confirmBtn.className = "settings-btn settings-btn-primary";
	//     modal.classList.add('show');

	//     const handleConfirm = () => {
	//       modal.classList.remove('show');
	//       cleanup();
	//       resolve(true);
	//     };

	//     const handleCancel = () => {
	//       modal.classList.remove('show');
	//       cleanup();
	//       resolve(false);
	//     };

	//     const cleanup = () => {
	//       confirmBtn.removeEventListener('click', handleConfirm);
	//       cancelBtn.removeEventListener('click', handleCancel);
	//       closeBtn.removeEventListener('click', handleCancel);
	//       modal.removeEventListener('click', handleModalBackdropClick);
	//     };

	//     const handleModalBackdropClick = (e) => {
	//       if (e.target === modal) {
	//         handleCancel();
	//       }
	//     };

	//     confirmBtn.addEventListener('click', handleConfirm);
	//     cancelBtn.addEventListener('click', handleCancel);
	//     closeBtn.addEventListener('click', handleCancel);
	//     modal.addEventListener('click', handleModalBackdropClick);
	//   });
	// }

	// Add this function to your settings.js file

	// Collapsible functionality
	function initializeCollapsibleCards() {
		const toggles = document.querySelectorAll(".settings-card-toggle");

		toggles.forEach((toggle) => {
			toggle.addEventListener("click", (e) => {
				e.preventDefault();

				const targetId = toggle.getAttribute("data-target");
				const content = document.getElementById(targetId);
				const card = toggle.closest(".settings-card-collapsible");
				const chevron = toggle.querySelector(".chevron-icon");

				if (content.classList.contains("expanded")) {
					// Collapse
					content.classList.remove("expanded");
					card.classList.remove("expanded");
					chevron.textContent = "▼";
				} else {
					// Expand
					content.classList.add("expanded");
					card.classList.add("expanded");
					chevron.textContent = "▲";
				}
			});
		});

		// Optional: Expand first section by default
		// const firstNotificationSection = document.getElementById('notification-settings');
		// if (firstNotificationSection) {
		//   firstNotificationSection.classList.add('expanded');
		//   firstNotificationSection.closest('.settings-card-collapsible').classList.add('expanded');
		//   const firstChevron = document.querySelector('[data-target="notification-settings"] .chevron-icon');
		//   if (firstChevron) firstChevron.textContent = '▲';
		// }
	}

	// Start initialization
	await initialize();
});
