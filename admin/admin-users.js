//admin-users.js

(() => {
	const apiBase = `/admin`;
	let state = {
		page: 1,
		limit: 20,
		q: "",
		role: "",
		sort: "created_asc",
		totalPages: 1,
	};

	// DOM
	const tbody = document.getElementById("users-table-body");
	const pagination = document.getElementById("pagination");
	const searchInput = document.getElementById("searchInput");
	const roleFilter = document.getElementById("roleFilter");
	const sortSelect = document.getElementById("sortSelect");
	const limitSelect = document.getElementById("limitSelect");
	const searchBtn = document.getElementById("searchBtn");
	const exportCsvBtn = document.getElementById("exportCsvBtn");
	const exportPdfBtn = document.getElementById("exportPdfBtn");

	// Fetch users with current state
	async function loadUsers() {
		const params = new URLSearchParams({
			page: state.page,
			limit: state.limit,
			q: state.q,
			role: state.role,
			sort: state.sort,
		});

		try {
			const res = await fetch(`${apiBase}/users?${params.toString()}`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to load users");
			const payload = await res.json();
			renderTable(payload.data);
			state.totalPages = payload.meta.totalPages || 1;
			renderPagination();
		} catch (err) {
			console.error(err);
			tbody.innerHTML = `<tr><td colspan="6">Error loading users</td></tr>`;
		}
	}

	function renderTable(users) {
		tbody.innerHTML = "";
		if (!users.length) {
			tbody.innerHTML = `<tr><td colspan="6">No users found</td></tr>`;
			return;
		}
		users.forEach((user) => {
			const tr = document.createElement("tr");
			tr.innerHTML = `
        <td>${user.id}</td>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${new Date(user.created_at).toLocaleString()}</td>
        <td class="actions">
          <a class="action-btn edit" href="edit-user.html?id=${
						user.id
					}">Edit</a>
          <button class="action-btn view" onclick="location.href='user-overview.html?id=${
						user.id
					}'">Overview</button>
          <button class="action-btn delete" onclick="deleteUser(${
						user.id
					})">Delete</button>
        </td>
      `;
			tbody.appendChild(tr);
		});
	}

	function renderPagination() {
		pagination.innerHTML = "";
		const tp = state.totalPages;
		const cp = state.page;

		// Prev
		const prev = document.createElement("button");
		prev.className = "page-btn";
		prev.textContent = "Prev";
		prev.disabled = cp <= 1;
		prev.onclick = () => {
			state.page = Math.max(1, cp - 1);
			loadUsers();
		};
		pagination.appendChild(prev);

		// Page buttons (show window)
		const start = Math.max(1, cp - 2);
		const end = Math.min(tp, cp + 2);
		for (let i = start; i <= end; i++) {
			const b = document.createElement("button");
			b.className = "page-btn" + (i === cp ? " active" : "");
			b.textContent = i;
			b.onclick = () => {
				state.page = i;
				loadUsers();
			};
			pagination.appendChild(b);
		}

		// Next
		const next = document.createElement("button");
		next.className = "page-btn";
		next.textContent = "Next";
		next.disabled = cp >= tp;
		next.onclick = () => {
			state.page = Math.min(tp, cp + 1);
			loadUsers();
		};
		pagination.appendChild(next);

		// Meta
		const meta = document.createElement("div");
		meta.style.marginLeft = "10px";
		meta.textContent = `Page ${cp} / ${tp}`;
		pagination.appendChild(meta);
	}

	// Delete
	window.deleteUser = async function (id) {
		const confirmed = await showConfirmation(
			"Are you sure you want to delete this user?",
			"Delete User",
			{
				confirmText: "Continue",
				cancelText: "Cancel",
				danger: true,
			}
		);

		if (!confirmed) {
			return;
		}
		try {
			const res = await fetch(`${apiBase}/users/${id}`, {
				method: "DELETE",
				credentials: "include",
				headers: {
					"x-csrf-token": window.getCsrfToken(),
				},
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Delete failed");
			// alert(data.message);
			showToast(data.message, "success");
			loadUsers();
		} catch (err) {
			showToast("Error deleting", "error");
			console.error(err);
		}
	};

	// Export CSV: trigger download from server export endpoint with current filters
	exportCsvBtn.addEventListener("click", () => {
		const params = new URLSearchParams({
			q: state.q,
			role: state.role,
			sort: state.sort,
		});
		const url = `${apiBase}/users/export?${params.toString()}`;
		// open in new window to trigger download (cookie credentials already present)
		window.open(url, "_blank");
	});

	// Export PDF (client-side using jsPDF)
	exportPdfBtn.addEventListener("click", async () => {
		try {
			// Ensure we have current page loaded
			const { jsPDF } = window.jspdf;
			const doc = new jsPDF("p", "pt", "a4");
			// simple title
			doc.setFontSize(14);
			doc.text("Users Export", 40, 40);
			// fetch full result set (server already has export endpoint; we'll fetch CSV and render text)
			const params = new URLSearchParams({
				q: state.q,
				role: state.role,
				sort: state.sort,
			});
			const res = await fetch(`${apiBase}/users/export?${params.toString()}`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch data for PDF");
			const csv = await res.text();
			// convert CSV to lines
			const lines = csv.split("\n").slice(1).filter(Boolean); // drop header
			const startY = 70;
			let y = startY;
			doc.setFontSize(10);
			const colWidths = [60, 140, 160, 60, 100]; // crude widths
			lines.forEach((line, idx) => {
				const cols = parseCsvLine(line);
				let x = 40;
				cols.slice(0, 5).forEach((c, i) => {
					doc.text(String(c).substring(0, 30), x, y); // truncate
					x += colWidths[i];
				});
				y += 14;
				if (y > 750) {
					doc.addPage();
					y = 40;
				}
			});
			doc.save(`users-${Date.now()}.pdf`);
		} catch (err) {
			console.error(err);
			showToast("Failed to export PDF", "error");
		}
	});

	// Helpers
	function escapeHtml(str) {
		if (!str && str !== 0) return "";
		return String(str).replace(
			/[&<>"']/g,
			(s) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				}[s])
		);
	}

	function parseCsvLine(line) {
		// Very simple CSV parser for our exported double-quoted CSV
		const rx = /"(.*?)"(?:,|$)/g;
		const out = [];
		let m;
		while ((m = rx.exec(line)) !== null) out.push(m[1].replace(/""/g, '"'));
		return out;
	}

	// initialize
	(function init() {
		// set UI defaults
		searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") searchBtn.click();
		});
		limitSelect.addEventListener("change", () => {
			state.limit = parseInt(limitSelect.value, 10);
			state.page = 1;
			loadUsers();
		});
		sortSelect.addEventListener("change", () => {
			state.sort = sortSelect.value;
			state.page = 1;
			loadUsers();
		});
		roleFilter.addEventListener("change", () => {
			state.role = roleFilter.value;
			state.page = 1;
			loadUsers();
		});
		loadUsers();
	})();
})();

document.getElementById("searchInput").addEventListener("input", function () {
	const filter = this.value.toLowerCase();
	const rows = document.querySelectorAll("#users-table-body tr");

	rows.forEach((row) => {
		const id = row.cells[0].textContent.toLowerCase();
		const name = row.cells[1].textContent.toLowerCase();
		const email = row.cells[2].textContent.toLowerCase();

		if (
			id.includes(filter) ||
			name.includes(filter) ||
			email.includes(filter)
		) {
			row.style.display = "";
		} else {
			row.style.display = "none";
		}
	});
});
