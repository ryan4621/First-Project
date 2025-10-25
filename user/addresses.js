// addresses.js - Updated with new modal IDs

const AddressAPI = {
	baseURL: `/api`,

	async getAddresses() {
		try {
			const response = await fetch(`${this.baseURL}/addresses`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Error fetching addresses:", error);
			throw error;
		}
	},

	async createAddress(addressData) {
		try {
			const response = await fetch(`${this.baseURL}/addresses`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-csrf-token": window.getCsrfToken(),
				},
				credentials: "include",
				body: JSON.stringify(addressData),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Error creating address:", error);
			throw error;
		}
	},

	async updateAddress(addressId, addressData) {
		try {
			const response = await fetch(`${this.baseURL}/addresses/${addressId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					"x-csrf-token": window.getCsrfToken(),
				},
				credentials: "include",
				body: JSON.stringify(addressData),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Error updating address:", error);
			throw error;
		}
	},

	async deleteAddress(addressId) {
		try {
			const response = await fetch(`${this.baseURL}/addresses/${addressId}`, {
				method: "DELETE",
				credentials: "include",
				headers: {
					"x-csrf-token": window.getCsrfToken(),
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Error deleting address:", error);
			throw error;
		}
	},

	async setDefaultAddress(addressId) {
		try {
			const response = await fetch(
				`${this.baseURL}/addresses/${addressId}/default`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"x-csrf-token": window.getCsrfToken(),
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Error setting default address:", error);
			throw error;
		}
	},
};

// Modal functionality - UPDATED IDs
const addAddressBtn = document.getElementById("add-address-btn");
const addressModal = document.getElementById("address-modal-overlay");
const closeModal = document.getElementById("address-close-modal");
const cancelBtn = document.getElementById("address-cancel-btn");
const addressForm = document.getElementById("address-form");
const toast = document.getElementById("toast");
const deleteModal = document.getElementById("address-delete-modal-overlay");
const closeDeleteModal = document.getElementById("address-delete-close-modal");
const cancelDeleteBtn = document.getElementById("address-cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("address-confirm-delete-btn");
let deletingAddressId = null;

let currentMode = "add";
let editingAddressId = null;

// Open modal
addAddressBtn.addEventListener("click", () => {
	currentMode = "add";
	editingAddressId = null;

	document.querySelector(".address-modal-header h3").textContent =
		"Add New Address";
	document.getElementById("save-address-btn").textContent = "Save Address";

	addressForm.reset();
	addressModal.style.display = "flex";
	loadCountries();
});

// Close modal
function closeAddressModal() {
	addressModal.style.display = "none";
	addressForm.reset();
	clearErrors();
}

closeModal.addEventListener("click", closeAddressModal);
cancelBtn.addEventListener("click", closeAddressModal);

addressModal.addEventListener("click", (e) => {
	if (e.target === addressModal) {
		closeAddressModal();
	}
});

// Load countries
async function loadCountries() {
	try {
		const response = await fetch(`/api/countries`);
		const countries = await response.json();

		const countrySelect = document.getElementById("country");
		countrySelect.innerHTML = '<option value="">Select Country</option>';

		countries.forEach((country) => {
			const option = document.createElement("option");
			option.value = country;
			option.textContent = country;
			countrySelect.appendChild(option);
		});
	} catch (error) {
		console.error("Error loading countries:", error);
	}
}

// Show toast notification
function showToast(message, type = "success") {
	toast.textContent = message;
	toast.className = `toast ${type}`;
	toast.classList.add("show");

	setTimeout(() => {
		toast.classList.remove("show");
	}, 3000);
}

// Clear error messages
function clearErrors() {
	const errorMessages = document.querySelectorAll(".address-error-message");
	errorMessages.forEach((error) => (error.style.display = "none"));
}

// Show field error
function showFieldError(fieldName, message) {
	const errorElement = document.getElementById(`${fieldName}_error`);
	if (errorElement) {
		errorElement.textContent = message;
		errorElement.style.display = "block";
	}
}

// Validate form
function validateForm(formData) {
	clearErrors();
	let isValid = true;

	const requiredFields = [
		"full_name",
		"street",
		"city",
		"postal_code",
		"country",
	];

	requiredFields.forEach((field) => {
		if (!formData[field] || formData[field].trim() === "") {
			showFieldError(field, "This field is required");
			isValid = false;
		}
	});

	return isValid;
}

// Load and display addresses
async function loadAddresses() {
	try {
		const response = await AddressAPI.getAddresses();
		const addresses = response.addresses;
		displayAddresses(addresses);
	} catch (error) {
		console.error("Error loading addresses:", error);
		showToast("Failed to load addresses", "error");
	}
}

// Display addresses in the UI
function displayAddresses(addresses) {
	const addressList = document.getElementById("address-list");
	const noAddressMessage = document.getElementById("no-addresses-message");

	if (addresses.length === 0) {
		if (noAddressMessage) {
			noAddressMessage.style.display = "block";
		}
		return;
	}

	if (noAddressMessage) {
		noAddressMessage.style.display = "none";
	}

	const addressCards = addresses
		.map(
			(address) => `
        <div class="card" data-address-id="${address.id}">
            <p><strong>${address.full_name}</strong> ${
				address.is_default
					? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8rem;">DEFAULT</span>'
					: ""
			}</p>
            <p>${address.street}</p>
            <p>${address.city}${address.state ? ", " + address.state : ""} ${
				address.postal_code
			}</p>
            <p>${address.country}</p>
            ${address.phone ? `<p>Phone: ${address.phone}</p>` : ""}
            <div class="card-actions">
                <button class=" btn-secondary edit-address-btn" data-address-id="${
									address.id
								}">Edit</button>
                <button class="btn btn-small btn-danger delete-address-btn" data-address-id="${
									address.id
								}">Delete</button>
                ${
									!address.is_default
										? `<button class="btn btn-small set-default-btn" data-address-id="${address.id}">Set Default</button>`
										: ""
								}
            </div>
        </div>
    `
		)
		.join("");

	addressList.innerHTML = addressCards;
	addAddressEventListeners();
}

// Add event listeners to address action buttons
function addAddressEventListeners() {
	document.querySelectorAll(".delete-address-btn").forEach((btn) => {
		btn.addEventListener("click", handleDeleteAddress);
	});

	document.querySelectorAll(".set-default-btn").forEach((btn) => {
		btn.addEventListener("click", handleSetDefault);
	});

	document.querySelectorAll(".edit-address-btn").forEach((btn) => {
		btn.addEventListener("click", handleEditAddress);
	});
}

// Handle delete address
async function handleDeleteAddress(e) {
	const addressId = e.target.dataset.addressId;
	openDeleteModal(addressId);
}

function openDeleteModal(addressId) {
	deletingAddressId = addressId;
	deleteModal.style.display = "flex";
}

function closeDeleteConfirmModal() {
	deleteModal.style.display = "none";
	deletingAddressId = null;
}

closeDeleteModal.addEventListener("click", closeDeleteConfirmModal);
cancelDeleteBtn.addEventListener("click", closeDeleteConfirmModal);

confirmDeleteBtn.addEventListener("click", async (e) => {
	if (!deletingAddressId) return;

	e.target.disabled = true;
	e.target.textContent = "Deleting...";

	try {
		await AddressAPI.deleteAddress(deletingAddressId);
		showToast("Address deleted successfully!", "success");

		const response = await AddressAPI.getAddresses();
		const addresses = response.addresses;

		if (addresses.length === 0) {
			setTimeout(() => {
				window.location.reload();
			}, 1500);
		} else {
			loadAddresses();
		}

		closeDeleteConfirmModal();
	} catch (error) {
		console.error("Error deleting address:", error);
		showToast("Failed to delete address", "error");
		e.target.disabled = false;
		e.target.textContent = "Delete";
	}
});

// Handle set default address
async function handleSetDefault(e) {
	const addressId = e.target.dataset.addressId;

	e.target.disabled = true;
	e.target.textContent = "Setting...";

	try {
		await AddressAPI.setDefaultAddress(addressId);
		showToast("Default address updated!", "success");
		loadAddresses();
	} catch (error) {
		console.error("Error setting default:", error);
		showToast("Failed to set default address", "error");
		e.target.disabled = false;
		e.target.textContent = "Set Default";
	}
}

// Handle edit address
function handleEditAddress(e) {
	const addressId = e.target.dataset.addressId;
	const addressCard = e.target.closest(".card");
	const addressData = extractAddressFromCard(addressCard, addressId);

	currentMode = "edit";
	editingAddressId = addressId;

	populateEditForm(addressData);
	addressModal.style.display = "flex";
	loadCountries();
}

// Handle form submission
addressForm.addEventListener("submit", async (e) => {
	e.preventDefault();

	const formData = new FormData(addressForm);
	const addressData = Object.fromEntries(formData.entries());

	addressData.is_default = addressData.is_default === "1";

	if (!validateForm(addressData)) {
		return;
	}

	const saveBtn = document.getElementById("save-address-btn");
	saveBtn.disabled = true;
	saveBtn.textContent = currentMode === "edit" ? "Updating..." : "Saving...";

	try {
		if (currentMode === "edit") {
			await AddressAPI.updateAddress(editingAddressId, addressData);
			showToast("Address updated successfully!", "success");
		} else {
			await AddressAPI.createAddress(addressData);
			showToast("Address added successfully!", "success");
		}

		closeAddressModal();
		loadAddresses();
	} catch (error) {
		console.error("Error saving address:", error);
		showToast(
			currentMode === "edit"
				? "Failed to update address. Please try again."
				: "Failed to save address. Please try again.",
			"error"
		);
	} finally {
		saveBtn.disabled = false;
		saveBtn.textContent =
			currentMode === "edit" ? "Update Address" : "Save Address";
	}
});

// Extract address data from the card element
function extractAddressFromCard(card, addressId) {
	return { id: addressId };
}

// Populate form for editing
async function populateEditForm(addressData) {
	try {
		const response = await AddressAPI.getAddresses();
		const addresses = response.addresses;
		const address = addresses.find((addr) => addr.id == editingAddressId);

		if (!address) {
			showToast("Address not found", "error");
			return;
		}

		document.getElementById("full_name").value = address.full_name || "";
		document.getElementById("phone").value = address.phone || "";
		document.getElementById("street").value = address.street || "";
		document.getElementById("city").value = address.city || "";
		document.getElementById("state").value = address.state || "";
		document.getElementById("postal_code").value = address.postal_code || "";
		document.getElementById("country").value = address.country || "";
		document.getElementById("is_default").checked = address.is_default === 1;

		document.querySelector(".address-modal-header h3").textContent =
			"Edit Address";
		document.getElementById("save-address-btn").textContent = "Update Address";
	} catch (error) {
		console.error("Error loading address for edit:", error);
		showToast("Failed to load address data", "error");
	}
}

// Load addresses when page loads
loadAddresses();
