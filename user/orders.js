// orders.js

class OrdersManager {
	constructor() {
		this.orders = [];
		this.currentOrderNumber = null;
		this.currentPage = 0;
		this.limit = 10;
		this.totalOrders = 0;

		this.init();
	}

	async init() {
		await this.loadOrders();
		this.setupEventListeners();
	}

	setupEventListeners() {
		// Filter button
		document.getElementById("filter-btn").addEventListener("click", () => {
			this.currentPage = 0; // Reset to first page when filtering
			this.loadOrders();
		});

		// Close modals
		document
			.getElementById("order-close-modal")
			.addEventListener("click", () => {
				this.closeOrderModal();
			});

		document
			.getElementById("cancel-close-modal")
			.addEventListener("click", () => {
				this.closeCancelModal();
			});

		document
			.getElementById("cancel-cancel-btn")
			.addEventListener("click", () => {
				this.closeCancelModal();
			});

		// Cancel form submission
		document.getElementById("cancel-form").addEventListener("submit", (e) => {
			e.preventDefault();
			this.submitCancellation();
		});

		// Pagination
		document.getElementById("prev-page").addEventListener("click", () => {
			if (this.currentPage > 0) {
				this.currentPage--;
				this.loadOrders();
			}
		});

		document.getElementById("next-page").addEventListener("click", () => {
			if ((this.currentPage + 1) * this.limit < this.totalOrders) {
				this.currentPage++;
				this.loadOrders();
			}
		});
	}

	async loadOrders() {
		const loadingEl = document.getElementById("orders-loading");
		const noOrdersEl = document.getElementById("no-orders");
		const ordersListEl = document.getElementById("orders-list");
		const paginationEl = document.getElementById("pagination");

		try {
			loadingEl.style.display = "block";
			noOrdersEl.style.display = "none";
			ordersListEl.innerHTML = "";
			paginationEl.style.display = "none";

			const statusFilter = document.getElementById("status-filter").value;
			let url = `/api/orders?limit=${this.limit}&offset=${
				this.currentPage * this.limit
			}`;

			if (statusFilter) {
				url += `&status=${statusFilter}`;
			}

			const response = await fetch(url, {
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Failed to load orders");
			}

			const data = await response.json();
			this.orders = data.orders;
			this.totalOrders = data.total;

			loadingEl.style.display = "none";

			if (this.orders.length === 0) {
				noOrdersEl.style.display = "block";
			} else {
				this.renderOrders();
				this.updatePagination();
			}
		} catch (error) {
			console.error("Load orders error:", error);
			loadingEl.innerHTML =
				'<p style="color: #dc3545;">Failed to load orders. Please try again.</p>';
		}
	}

	updatePagination() {
		const paginationEl = document.getElementById("pagination");
		const pageInfoEl = document.getElementById("page-info");
		const prevBtn = document.getElementById("prev-page");
		const nextBtn = document.getElementById("next-page");

		paginationEl.style.display = "block";

		const totalPages = Math.ceil(this.totalOrders / this.limit);
		const currentDisplayPage = this.currentPage + 1;

		pageInfoEl.textContent = `Page ${currentDisplayPage} of ${totalPages} (${this.totalOrders} total orders)`;

		prevBtn.disabled = this.currentPage === 0;
		nextBtn.disabled = currentDisplayPage >= totalPages;

		// Add visual feedback for disabled buttons
		prevBtn.style.opacity = this.currentPage === 0 ? "0.5" : "1";
		prevBtn.style.cursor = this.currentPage === 0 ? "not-allowed" : "pointer";
		nextBtn.style.opacity = currentDisplayPage >= totalPages ? "0.5" : "1";
		nextBtn.style.cursor =
			currentDisplayPage >= totalPages ? "not-allowed" : "pointer";
	}

	renderOrders() {
		const ordersListEl = document.getElementById("orders-list");

		ordersListEl.innerHTML = this.orders
			.map(
				(order) => `
            <div class="card" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0;">Order #${
													order.order_number
												}</h4>
                        <p style="margin: 5px 0;">
                            <strong>Status:</strong> 
                            <span class="status-badge status-${
															order.status
														}">${this.formatStatus(order.status)}</span>
                        </p>
                        <p style="margin: 5px 0;">
                            <strong>Payment:</strong> 
                            <span class="status-badge status-${
															order.payment_status
														}">${this.formatStatus(order.payment_status)}</span>
                        </p>
                        <p style="margin: 5px 0;"><strong>Total:</strong> $${parseFloat(
													order.total
												).toFixed(2)}</p>
                        <p style="margin: 5px 0; color: #666;">
                            ${new Date(order.created_at).toLocaleDateString(
															"en-US",
															{
																year: "numeric",
																month: "long",
																day: "numeric",
															}
														)}
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-small profile-btn-primary" onclick="ordersManager.viewOrderDetails('${
													order.order_number
												}')">
                            View Details
                        </button>
                        ${
													this.canCancel(order)
														? `
                            <button class="btn btn-small profile-btn-danger" onclick="ordersManager.openCancelModal('${order.order_number}')">
                                Cancel Order
                            </button>
                        `
														: ""
												}
                    </div>
                </div>
            </div>
        `
			)
			.join("");
	}

	formatStatus(status) {
		return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
	}

	canCancel(order) {
		return (
			["pending", "processing"].includes(order.status) &&
			order.payment_status === "paid"
		);
	}

	async viewOrderDetails(orderNumber) {
		try {
			const response = await fetch(`/api/orders/${orderNumber}`, {
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Failed to load order details");
			}

			const data = await response.json();
			this.displayOrderDetails(data);
		} catch (error) {
			console.error("View order details error:", error);
			showToast("Failed to load order details", "error");
		}
	}

	displayOrderDetails(data) {
		const { order, items, payment, refund } = data;

		const modalBody = document.getElementById("order-modal-body");

		modalBody.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4>Order Information</h4>
                <p><strong>Order Number:</strong> ${order.order_number}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${
									order.status
								}">${this.formatStatus(order.status)}</span></p>
                <p><strong>Payment Status:</strong> <span class="status-badge status-${
									order.payment_status
								}">${this.formatStatus(order.payment_status)}</span></p>
                <p><strong>Order Date:</strong> ${new Date(
									order.created_at
								).toLocaleString()}</p>
                ${
									order.shipped_at
										? `<p><strong>Shipped:</strong> ${new Date(
												order.shipped_at
										  ).toLocaleString()}</p>`
										: ""
								}
                ${
									order.delivered_at
										? `<p><strong>Delivered:</strong> ${new Date(
												order.delivered_at
										  ).toLocaleString()}</p>`
										: ""
								}
                ${
									order.notes
										? `
                    <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-left: 3px solid #007bff; border-radius: 4px;">
                        <strong>Order Notes:</strong>
                        <p style="margin: 5px 0 0 0;">${order.notes}</p>
                    </div>
                `
										: ""
								}
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Shipping Address</h4>
                <p>${order.shipping_name}</p>
                <p>${order.shipping_street}</p>
                <p>${order.shipping_city}${
			order.shipping_state ? ", " + order.shipping_state : ""
		} ${order.shipping_postal_code}</p>
                <p>${order.shipping_country}</p>
                ${
									order.shipping_phone
										? `<p>Phone: ${order.shipping_phone}</p>`
										: ""
								}
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Order Items</h4>
                ${items
									.map(
										(item) => `
                    <div style="display: flex; gap: 15px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <img src="${
													item.image_url || "placeholder.jpg"
												}" alt="${
											item.product_name
										}" style="width: 80px; height: 100px; object-fit: cover; border-radius: 4px;">
                        <div>
                            <p style="font-weight: 600; margin: 0 0 5px 0;">${
															item.product_name
														}</p>
                            ${
															item.size
																? `<p style="margin: 0 0 5px 0;">Size: ${item.size}</p>`
																: ""
														}
                            <p style="margin: 0 0 5px 0;">Quantity: ${
															item.quantity
														}</p>
                            <p style="margin: 0; font-weight: 600;">$${parseFloat(
															item.total_price
														).toFixed(2)}</p>
                        </div>
                    </div>
                `
									)
									.join("")}
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Order Summary</h4>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Subtotal:</span>
                    <span>$${parseFloat(order.subtotal).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Shipping:</span>
                    <span>$${parseFloat(order.shipping_cost).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Tax:</span>
                    <span>$${parseFloat(order.tax_amount).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; font-weight: 600; font-size: 1.2em;">
                    <span>Total:</span>
                    <span>$${parseFloat(order.total).toFixed(2)}</span>
                </div>
            </div>

            ${
							refund
								? `
                <div style="padding: 15px; background-color: #fff3cd; border-radius: 4px;">
                    <h4 style="margin-top: 0;">Refund Information</h4>
                    <p><strong>Status:</strong> ${this.formatStatus(
											refund.status
										)}</p>
                    <p><strong>Amount:</strong> $${parseFloat(
											refund.amount
										).toFixed(2)}</p>
                    <p><strong>Reason:</strong> ${this.formatStatus(
											refund.reason
										)}</p>
                    ${
											refund.reason_description
												? `<p><strong>Details:</strong> ${refund.reason_description}</p>`
												: ""
										}
                </div>
            `
								: ""
						}

            ${
							payment && payment.receipt_url
								? `
                <div style="margin-top: 20px;">
                    <a href="${payment.receipt_url}" target="_blank" class="btn profile-btn-primary">View Receipt</a>
                </div>
            `
								: ""
						}
        `;

		document.getElementById("order-modal-overlay").style.display = "flex";
	}

	openCancelModal(orderNumber) {
		this.currentOrderNumber = orderNumber;
		document.getElementById("cancel-modal-overlay").style.display = "flex";
	}

	closeOrderModal() {
		document.getElementById("order-modal-overlay").style.display = "none";
	}

	closeCancelModal() {
		document.getElementById("cancel-modal-overlay").style.display = "none";
		document.getElementById("cancel-form").reset();
		this.currentOrderNumber = null;
	}

	async submitCancellation() {
		const reason = document.getElementById("cancel-reason").value;
		const description = document.getElementById("cancel-description").value;

		try {
			const response = await fetch(
				`/api/orders/${this.currentOrderNumber}/cancel`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-csrf-token": window.getCsrfToken(),
					},
					credentials: "include",
					body: JSON.stringify({
						reason,
						reasonDescription: description,
					}),
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to cancel order");
			}

			showToast(
				"Order cancellation requested successfully. Your refund will be processed within 5-7 business days.",
				"success"
			);
			this.closeCancelModal();
			await this.loadOrders();
		} catch (error) {
			console.error("Cancel order error:", error);
			showToast("Failed to cancel order: " + error.message, "error");
		}
	}
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	window.ordersManager = new OrdersManager();
});
