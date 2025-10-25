// csrf-helper.js
let csrfToken = null;

// Get CSRF token from server
async function initCsrfToken() {
	try {
		const response = await fetch(`/api/csrf-token`, {
			credentials: "include",
		});
		const data = await response.json();
		csrfToken = data.csrfToken;
		// console.log('✅ CSRF token loaded:', csrfToken);

		// // CHECK IF COOKIE WAS SET
		// console.log('🍪 All cookies after CSRF fetch:', document.cookie);
	} catch (err) {
		console.error("❌ Failed to get CSRF token:", err);
	}
}

async function refreshCsrfToken() {
	try {
		const response = await fetch(`/api/csrf-token`, {
			credentials: "include",
		});
		const data = await response.json();
		csrfToken = data.csrfToken;
		// console.log('✅ CSRF token loaded:', csrfToken);
		return csrfToken;
	} catch (err) {
		// console.error('❌ Failed to refresh CSRF token:', err);
		return null;
	}
}

// Get the current token (use this in your fetch calls)
function getCsrfToken() {
	return csrfToken;
}

// Initialize token when this file loads
initCsrfToken();

// Export functions so other files can use them
window.getCsrfToken = getCsrfToken;
window.initCsrfToken = initCsrfToken;
window.refreshCsrfToken = refreshCsrfToken;
