// admin-support.js
class SupportManager {
	constructor() {
		this.currentPage = 1;
		this.limit = 20;
		this.filters = {
			status: "all",
			priority: "all",
			subject: "all",
			search: "",
		};
		this.tickets = [];
		this.stats = {};
		this.init();
	}

	init() {
		this.bindEventListeners();
		this.loadStats();
		this.loadTickets();
	}

	bindEventListeners() {
		// Filter event listeners
		document.getElementById("statusFilter").addEventListener("change", (e) => {
			this.filters.status = e.target.value;
			this.currentPage = 1;
			this.loadTickets();
		});

		document
			.getElementById("priorityFilter")
			.addEventListener("change", (e) => {
				this.filters.priority = e.target.value;
				this.currentPage = 1;
				this.loadTickets();
			});

		document.getElementById("subjectFilter").addEventListener("change", (e) => {
			this.filters.subject = e.target.value;
			this.currentPage = 1;
			this.loadTickets();
		});

		// Search with debounce
		let searchTimeout;
		document.getElementById("searchInput").addEventListener("input", (e) => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				this.filters.search = e.target.value;
				this.currentPage = 1;
				this.loadTickets();
			}, 500);
		});

		// Action buttons
		document.getElementById("refreshBtn").addEventListener("click", () => {
			this.refreshData();
		});

		document.getElementById("exportBtn").addEventListener("click", () => {
			this.exportTickets();
		});

		// Pagination
		document.getElementById("prevPageBtn").addEventListener("click", () => {
			if (this.currentPage > 1) {
				this.currentPage--;
				this.loadTickets();
			}
		});

		document.getElementById("nextPageBtn").addEventListener("click", () => {
			this.currentPage++;
			this.loadTickets();
		});

		// Modal controls
		document.getElementById("closeModalBtn").addEventListener("click", () => {
			this.closeModal();
		});

		document.getElementById("ticketModal").addEventListener("click", (e) => {
			if (e.target.id === "ticketModal") {
				this.closeModal();
			}
		});

		// Logout functionality
		this.setupLogoutModal();
	}

	setupLogoutModal() {
		const logoutBtn = document.getElementById("logoutBtn");
		const modal = document.getElementById("logoutModal");
		const closeModal = document.querySelector(".close");
		const cancelBtn = document.getElementById("cancelLogout");
		const confirmBtn = document.getElementById("confirmLogout");

		logoutBtn.addEventListener("click", (e) => {
			e.preventDefault();
			modal.style.display = "block";
		});

		closeModal.addEventListener("click", () => (modal.style.display = "none"));
		cancelBtn.addEventListener("click", () => (modal.style.display = "none"));

		confirmBtn.addEventListener("click", async () => {
			try {
				await fetch(`/auth/logout`, {
					method: "POST",
					credentials: "include",
					headers: {
						"x-csrf-token": window.getCsrfToken(),
					},
				});
				sessionStorage.clear();
				window.location.href = "../frontend/farfetch.html";
			} catch (err) {
				console.error("Logout failed:", err);
			}
		});

		window.addEventListener("click", (e) => {
			if (e.target === modal) modal.style.display = "none";
		});
	}

	async loadStats() {
		try {
			const response = await fetch(`/admin/contact/statistics`, {
				credentials: "include",
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const data = await response.json();
			this.stats = data.data;
			this.updateStatsDisplay();
		} catch (error) {
			console.error("Failed to load stats:", error);
			this.showErrorMessage("Failed to load statistics");
		}
	}

	updateStatsDisplay() {
		if (!this.stats.byStatus) return;

		// Initialize counts
		let pendingCount = 0;
		let inProgressCount = 0;
		let resolvedCount = 0;
		let closedCount = 0;

		// Calculate counts from status data
		this.stats.byStatus.forEach((item) => {
			switch (item.status) {
				case "pending":
					pendingCount = item.count;
					break;
				case "in_progress":
					inProgressCount = item.count;
					break;
				case "resolved":
					resolvedCount += item.count;
					break;
				case "closed":
					closedCount += item.count;
					break;
			}
		});

		// Calculate high priority count
		let highPriorityCount = 0;
		if (this.stats.byPriority) {
			this.stats.byPriority.forEach((item) => {
				if (item.priority === "high" || item.priority === "urgent") {
					highPriorityCount += item.count;
				}
			});
		}

		// Update DOM
		document.getElementById("pendingCount").textContent = pendingCount;
		document.getElementById("inProgressCount").textContent = inProgressCount;
		document.getElementById("resolvedCount").textContent = resolvedCount;
		document.getElementById("highPriorityCount").textContent =
			highPriorityCount;
		document.getElementById("closedCount").textContent = closedCount;
	}

	async loadTickets() {
		this.showLoadingState();

		try {
			const params = new URLSearchParams({
				...this.filters,
				limit: this.limit,
				page: this.currentPage,
				sortBy: "created_at",
				sortOrder: "DESC",
			});

			const response = await fetch(`/admin/contact/submissions?${params}`, {
				credentials: "include",
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const data = await response.json();
			this.tickets = data.data.submissions;
			this.pagination = data.data.pagination;

			this.renderTickets();
			this.updatePagination();
		} catch (error) {
			console.error("Failed to load tickets:", error);
			this.showErrorState("Failed to load support tickets");
		}
	}

	showLoadingState() {
		document.getElementById("loadingState").style.display = "block";
		document.getElementById("emptyState").style.display = "none";
		document.getElementById("ticketsTable").style.display = "none";
		document.getElementById("paginationContainer").style.display = "none";
	}

	showErrorState(message) {
		document.getElementById("loadingState").style.display = "none";
		document.getElementById("emptyState").style.display = "block";
		document.getElementById("ticketsTable").style.display = "none";
		document.getElementById("paginationContainer").style.display = "none";

		const emptyState = document.getElementById("emptyState");
		emptyState.innerHTML = `
      <div class="support-empty-icon">⚠️</div>
      <h3>Error Loading Tickets</h3>
      <p>${message}</p>
      <button class="support-btn support-btn-primary" onclick="supportManager.refreshData()">
        Try Again
      </button>
    `;
	}

	renderTickets() {
		const tbody = document.getElementById("ticketsTableBody");

		if (this.tickets.length === 0) {
			document.getElementById("loadingState").style.display = "none";
			document.getElementById("emptyState").style.display = "block";
			document.getElementById("ticketsTable").style.display = "none";
			document.getElementById("paginationContainer").style.display = "none";
			return;
		}

		document.getElementById("loadingState").style.display = "none";
		document.getElementById("emptyState").style.display = "none";
		document.getElementById("ticketsTable").style.display = "table";
		document.getElementById("paginationContainer").style.display = "flex";

		tbody.innerHTML = this.tickets
			.map((ticket) => this.renderTicketRow(ticket))
			.join("");

		// Update ticket count
		document.getElementById(
			"displayedTicketsCount"
		).textContent = `${this.tickets.length} tickets`;

		document.getElementById(
			"totalTicketsInfo"
		).textContent = `Total: ${this.pagination.total} tickets`;
	}

	renderTicketRow(ticket) {
		const createdDate = new Date(ticket.created_at).toLocaleDateString(
			"en-US",
			{
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}
		);

		const customerName = ticket.user_name || ticket.name;
		const customerInfo = ticket.user_id
			? `${customerName} (User)`
			: `${customerName} (Guest)`;

		return `
      <tr>
        <td>#${ticket.id}</td>
        <td>
          <div>
            <strong>${customerInfo}</strong><br>
            <small style="color: #7f8c8d;">${ticket.email}</small>
          </div>
        </td>
        <td>
          <div>
            <strong>${this.formatSubject(ticket.subject)}</strong><br>
            <small style="color: #7f8c8d;">${this.truncateText(
							ticket.message,
							50
						)}</small>
          </div>
        </td>
        <td>
          <span class="support-status-badge support-status-${ticket.status.replace(
						"_",
						"-"
					)}">
            ${this.formatStatus(ticket.status)}
          </span>
        </td>
        <td>
          <span class="support-priority-badge support-priority-${
						ticket.priority
					}">
            ${ticket.priority}
          </span>
        </td>
        <td>${createdDate}</td>
        <td>
          <div class="support-ticket-actions">
            <button class="support-action-btn support-action-view" 
                    onclick="supportManager.viewTicket(${ticket.id})" 
                    title="View Details">
              👁️
            </button>
            <button class="support-action-btn support-action-edit" 
                    onclick="supportManager.editTicket(${ticket.id})" 
                    title="Edit Status">
              ✏️
            </button>
          </div>
        </td>
      </tr>
    `;
	}

	formatSubject(subject) {
		const subjects = {
			general: "General Inquiry",
			account: "Account Issues",
			product: "Product Questions",
			technical: "Technical Support",
			billing: "Billing & Payments",
			feedback: "Feedback",
			other: "Other",
		};
		return subjects[subject] || subject;
	}

	formatStatus(status) {
		const statuses = {
			pending: "Pending",
			in_progress: "In Progress",
			resolved: "Resolved",
			closed: "Closed",
		};
		return statuses[status] || status;
	}

	truncateText(text, length) {
		return text.length > length ? text.substring(0, length) + "..." : text;
	}

	updatePagination() {
		const { total, hasMore } = this.pagination;
		const totalPages = Math.ceil(total / this.limit);

		document.getElementById("prevPageBtn").disabled = this.currentPage === 1;
		document.getElementById("nextPageBtn").disabled = !hasMore;

		document.getElementById(
			"paginationInfo"
		).textContent = `Page ${this.currentPage} of ${totalPages}`;

		// Generate page numbers
		this.generatePageNumbers(totalPages);
	}

	generatePageNumbers(totalPages) {
		const container = document.getElementById("pageNumbers");
		container.innerHTML = "";

		const maxVisiblePages = 5;
		let startPage = Math.max(
			1,
			this.currentPage - Math.floor(maxVisiblePages / 2)
		);
		let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

		if (endPage - startPage < maxVisiblePages - 1) {
			startPage = Math.max(1, endPage - maxVisiblePages + 1);
		}

		for (let page = startPage; page <= endPage; page++) {
			const pageBtn = document.createElement("button");
			pageBtn.className = `support-pagination-btn ${
				page === this.currentPage ? "active" : ""
			}`;
			pageBtn.textContent = page;
			pageBtn.addEventListener("click", () => {
				this.currentPage = page;
				this.loadTickets();
			});
			container.appendChild(pageBtn);
		}
	}

	async viewTicket(ticketId) {
		this.showModal();
		this.showModalLoading();

		try {
			const response = await fetch(`/admin/contact/submission/${ticketId}`, {
				credentials: "include",
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const ticket = await response.json();
			this.renderTicketDetails(ticket);
		} catch (error) {
			console.error("Failed to load ticket details:", error);
			this.showModalError("Failed to load ticket details");
		}
	}

	async editTicket(ticketId) {
		this.showModal();
		this.showModalLoading();

		try {
			const response = await fetch(`/admin/contact/submission/${ticketId}`, {
				credentials: "include",
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const ticket = await response.json();
			this.renderTicketEditForm(ticket);
		} catch (error) {
			console.error("Failed to load ticket for editing:", error);
			this.showModalError("Failed to load ticket for editing");
		}
	}

	renderTicketDetails(ticket) {
		document.getElementById(
			"modalTitle"
		).textContent = `Ticket #${ticket.id} - Details`;

		const createdDate = new Date(ticket.created_at).toLocaleDateString(
			"en-US",
			{
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}
		);

		const respondedDate = ticket.responded_at
			? new Date(ticket.responded_at).toLocaleDateString("en-US", {
					weekday: "long",
					year: "numeric",
					month: "long",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
			  })
			: "Not responded";

		document.getElementById("modalBody").innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Customer Information</h4>
            <p><strong>Name:</strong> ${ticket.name}</p>
            <p><strong>Email:</strong> ${ticket.email}</p>
            <p><strong>Account:</strong> ${
							ticket.user_id ? "Registered User" : "Guest"
						}</p>
          </div>
          <div>
            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Ticket Information</h4>
            <p><strong>Subject:</strong> ${this.formatSubject(
							ticket.subject
						)}</p>
            <p><strong>Priority:</strong> 
              <span class="support-priority-badge support-priority-${
								ticket.priority
							}">
                ${ticket.priority}
              </span>
            </p>
            <p><strong>Status:</strong> 
              <span class="support-status-badge support-status-${ticket.status.replace(
								"_",
								"-"
							)}">
                ${this.formatStatus(ticket.status)}
              </span>
            </p>
          </div>
        </div>
        
        <div>
          <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Message</h4>
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #3498db;">
            ${ticket.message.replace(/\n/g, "<br>")}
          </div>
        </div>

        ${
					ticket.admin_notes
						? `
          <div>
            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Admin Notes</h4>
            <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; border-left: 4px solid #f39c12;">
              ${ticket.admin_notes.replace(/\n/g, "<br>")}
            </div>
          </div>
        `
						: ""
				}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem; color: #7f8c8d;">
          <p><strong>Created:</strong> ${createdDate}</p>
          <p><strong>Responded:</strong> ${respondedDate}</p>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
          <button class="support-btn support-btn-secondary" onclick="supportManager.closeModal()">
            Close
          </button>
          <button class="support-btn support-btn-primary" onclick="supportManager.editTicket(${
						ticket.id
					})">
            Edit Ticket
          </button>
        </div>
      </div>
    `;
	}

	renderTicketEditForm(ticket) {
		document.getElementById(
			"modalTitle"
		).textContent = `Edit Ticket #${ticket.id}`;

		document.getElementById("modalBody").innerHTML = `
      <form id="editTicketForm">
        <div style="display: grid; gap: 1.5rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Status</label>
              <select id="editStatus" class="support-filter-select" style="width: 100%;">
                <option value="pending" ${
									ticket.status === "pending" ? "selected" : ""
								}>Pending</option>
                <option value="in_progress" ${
									ticket.status === "in_progress" ? "selected" : ""
								}>In Progress</option>
                <option value="resolved" ${
									ticket.status === "resolved" ? "selected" : ""
								}>Resolved</option>
                <option value="closed" ${
									ticket.status === "closed" ? "selected" : ""
								}>Closed</option>
              </select>
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Priority</label>
              <select id="editPriority" class="support-filter-select" style="width: 100%;">
                <option value="low" ${
									ticket.priority === "low" ? "selected" : ""
								}>Low</option>
                <option value="normal" ${
									ticket.priority === "normal" ? "selected" : ""
								}>Normal</option>
                <option value="high" ${
									ticket.priority === "high" ? "selected" : ""
								}>High</option>
                <option value="urgent" ${
									ticket.priority === "urgent" ? "selected" : ""
								}>Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Admin Notes</label>
            <textarea id="editAdminNotes" 
                      style="width: 100%; min-height: 120px; padding: 0.75rem; border: 2px solid #e9ecef; border-radius: 8px; font-family: inherit; resize: vertical;"
                      placeholder="Add internal notes about this ticket...">${
												ticket.admin_notes || ""
											}</textarea>
            <small style="color: #7f8c8d;">These notes are only visible to admins.</small>
          </div>

          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Original Message</h4>
            <p style="margin: 0; color: #7f8c8d;">${ticket.message}</p>
          </div>

          <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
            <button type="button" class="support-btn support-btn-secondary" onclick="supportManager.closeModal()">
              Cancel
            </button>
            <button type="submit" class="support-btn support-btn-primary">
              Update Ticket
            </button>
          </div>
        </div>
      </form>
    `;

		// Handle form submission
		document
			.getElementById("editTicketForm")
			.addEventListener("submit", (e) => {
				e.preventDefault();
				this.updateTicket(ticket.id);
			});
	}

	async updateTicket(ticketId) {
		const status = document.getElementById("editStatus").value;
		const priority = document.getElementById("editPriority").value;
		const admin_notes = document.getElementById("editAdminNotes").value;

		try {
			const response = await fetch(`/admin/contact/submission/${ticketId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					"x-csrf-token": window.getCsrfToken(),
				},
				credentials: "include",
				body: JSON.stringify({ status, priority, admin_notes }),
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const result = await response.json();

			this.closeModal();
			this.showSuccessMessage("Ticket updated successfully");
			this.refreshData(false);
		} catch (error) {
			console.error("Failed to update ticket:", error);
			this.showErrorMessage("Failed to update ticket");
		}
	}

	showModal() {
		document.getElementById("ticketModal").style.display = "block";
	}

	closeModal() {
		document.getElementById("ticketModal").style.display = "none";
	}

	showModalLoading() {
		document.getElementById("modalBody").innerHTML = `
      <div class="support-loading">
        <div class="support-loading-spinner"></div>
        <p>Loading ticket details...</p>
      </div>
    `;
	}

	showModalError(message) {
		document.getElementById("modalBody").innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h3>Error</h3>
        <p>${message}</p>
        <button class="support-btn support-btn-primary" onclick="supportManager.closeModal()">
          Close
        </button>
      </div>
    `;
	}

	async exportTickets() {
		try {
			const params = new URLSearchParams(this.filters);
			const response = await fetch(`/admin/contact/export?${params}`, {
				credentials: "include",
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `support-tickets-${
				new Date().toISOString().split("T")[0]
			}.csv`;
			a.click();
			window.URL.revokeObjectURL(url);

			this.showSuccessMessage("Tickets exported successfully");
		} catch (error) {
			console.error("Failed to export tickets:", error);
			this.showErrorMessage("Failed to export tickets");
		}
	}

	refreshData(showMessage = true) {
		this.loadStats();
		this.loadTickets();
		if (showMessage) {
			this.showSuccessMessage("Data refreshed successfully");
		}
	}

	showSuccessMessage(message) {
		this.showToast(message, "success");
	}

	showErrorMessage(message) {
		this.showToast(message, "error");
	}

	showToast(message, type) {
		const toast = document.createElement("div");
		toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      ${type === "success" ? "background: #27ae60;" : "background: #e74c3c;"}
    `;
		toast.textContent = message;

		document.body.appendChild(toast);

		setTimeout(() => (toast.style.transform = "translateX(0)"), 100);
		setTimeout(() => {
			toast.style.transform = "translateX(100%)";
			setTimeout(() => toast.remove(), 300);
		}, 3000);
	}
}

// Check super admin status immediately on page load
(function () {
	// Check if we already know the user is super admin
	const isSuperAdmin = sessionStorage.getItem("isSuperAdmin");

	if (isSuperAdmin === "true") {
		// Immediately show the link without waiting for fetch
		document.body.classList.add("super-admin");
	}

	// Verify role in background (in case it changed)
	fetch(`/auth/me`, { credentials: "include" })
		.then((res) => res.json())
		.then((user) => {
			console.log("User role:", user.role);
			if (user.role === "super_admin") {
				sessionStorage.setItem("isSuperAdmin", "true");
				document.body.classList.add("super-admin");
			} else {
				sessionStorage.setItem("isSuperAdmin", "false");
				document.body.classList.remove("super-admin");
			}
		})
		.catch((err) => {
			console.error("Failed to check user role:", err);
		});
})();

// Initialize support manager when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
	window.supportManager = new SupportManager();
});
