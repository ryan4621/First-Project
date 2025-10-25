// admin-orders.js

class AdminOrdersManager {
    constructor() {
        this.orders = [];
        this.currentOrderNumber = null;
        this.currentPage = 0;
        this.limit = 20;
        this.totalOrders = 0;
        
        this.init();
    }

    async init() {
        await this.loadOrders();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter buttons
        document.getElementById('filter-btn').addEventListener('click', () => {
            this.currentPage = 0;
            this.loadOrders();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadOrders();
        });

        // Modal close buttons
        document.getElementById('order-close-modal').addEventListener('click', () => {
            this.closeOrderModal();
        });

        document.getElementById('status-close-modal').addEventListener('click', () => {
            this.closeStatusModal();
        });

        document.getElementById('status-cancel-btn').addEventListener('click', () => {
            this.closeStatusModal();
        });

        document.getElementById('delete-close-modal').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('delete-cancel-btn').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        // Form submissions
        document.getElementById('status-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateOrderStatus();
        });

        document.getElementById('delete-confirm-btn').addEventListener('click', () => {
            this.deleteOrder();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                this.loadOrders();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if ((this.currentPage + 1) * this.limit < this.totalOrders) {
                this.currentPage++;
                this.loadOrders();
            }
        });
    }

    async loadOrders() {
        const loadingEl = document.getElementById('orders-loading');
        const noOrdersEl = document.getElementById('no-orders');
        const ordersListEl = document.getElementById('orders-list');
        const paginationEl = document.getElementById('pagination');

        try {
            loadingEl.style.display = 'block';
            noOrdersEl.style.display = 'none';
            ordersListEl.innerHTML = '';
            paginationEl.style.display = 'none';

            const statusFilter = document.getElementById('status-filter').value;
            const paymentFilter = document.getElementById('payment-filter').value;
            
            let url = `${websiteUrl}/admin/orders?limit=${this.limit}&offset=${this.currentPage * this.limit}`;
            
            if (statusFilter) url += `&status=${statusFilter}`;
            if (paymentFilter) url += `&paymentStatus=${paymentFilter}`;

            const response = await fetch(url, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load orders');
            }

            const data = await response.json();
            this.orders = data.orders;
            this.totalOrders = data.total;

            loadingEl.style.display = 'none';

            if (this.orders.length === 0) {
                noOrdersEl.style.display = 'block';
            } else {
                this.renderOrders();
                this.updatePagination();
            }

        } catch (error) {
            console.error('Load orders error:', error);
            loadingEl.innerHTML = '<p style="color: #dc3545;">Failed to load orders. Please try again.</p>';
        }
    }

    renderOrders() {
        const ordersListEl = document.getElementById('orders-list');
        
        ordersListEl.innerHTML = this.orders.map(order => `
            <div class="admin-order-card" style="background: white; padding: 20px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
                    <div style="flex: 1; min-width: 250px;">
                        <h4 style="margin: 0 0 10px 0;">Order #${order.order_number}</h4>
                        <p style="margin: 5px 0;"><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${order.email}</p>
                        <p style="margin: 5px 0;"><strong>User ID:</strong> ${order.user_id || 'Guest'}</p>
                        <p style="margin: 5px 0;">
                            <strong>Status:</strong> 
                            <span class="admin-status-badge admin-status-${order.status}">${this.formatStatus(order.status)}</span>
                        </p>
                        <p style="margin: 5px 0;">
                            <strong>Payment:</strong> 
                            <span class="admin-status-badge admin-status-${order.payment_status}">${this.formatStatus(order.payment_status)}</span>
                        </p>
                        <p style="margin: 5px 0;"><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
                        <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
                            ${new Date(order.created_at).toLocaleString()}
                        </p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="admin-btn admin-btn-primary" onclick="adminOrdersManager.viewOrderDetails('${order.order_number}')">
                            View Details
                        </button>
                        <button class="admin-btn admin-btn-success" onclick="adminOrdersManager.openStatusModal('${order.order_number}')">
                            Change Status
                        </button>
                        <button class="admin-btn admin-btn-danger" onclick="adminOrdersManager.openDeleteModal('${order.order_number}')">
                            Delete Order
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updatePagination() {
        const paginationEl = document.getElementById('pagination');
        const pageInfoEl = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        paginationEl.style.display = 'block';
        
        const totalPages = Math.ceil(this.totalOrders / this.limit);
        const currentDisplayPage = this.currentPage + 1;
        
        pageInfoEl.textContent = `Page ${currentDisplayPage} of ${totalPages} (Total: ${this.totalOrders} orders)`;
        
        prevBtn.disabled = this.currentPage === 0;
        nextBtn.disabled = currentDisplayPage >= totalPages;
    }

    formatStatus(status) {
        return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }

    async viewOrderDetails(orderNumber) {
        try {
            const response = await fetch(`${websiteUrl}/admin/orders/${orderNumber}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load order details');
            }

            const data = await response.json();
            this.displayOrderDetails(data);

        } catch (error) {
            console.error('View order details error:', error);
            showToast('Failed to load order details.', 'error');
        }
    }

    displayOrderDetails(data) {
        const { order, items, payments, refunds } = data;
        
        const modalBody = document.getElementById('order-modal-body');
        
        modalBody.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4>Order Information</h4>
                <p><strong>Order Number:</strong> ${order.order_number}</p>
                <p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
                <p><strong>Customer Email:</strong> ${order.customer_email}</p>
                <p><strong>User ID:</strong> ${order.user_id}</p>
                <p><strong>Status:</strong> <span class="admin-status-badge admin-status-${order.status}">${this.formatStatus(order.status)}</span></p>
                <p><strong>Payment Status:</strong> <span class="admin-status-badge admin-status-${order.payment_status}">${this.formatStatus(order.payment_status)}</span></p>
                <p><strong>Payment Method:</strong> ${order.payment_method}</p>
                <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                ${order.shipped_at ? `<p><strong>Shipped:</strong> ${new Date(order.shipped_at).toLocaleString()}</p>` : ''}
                ${order.delivered_at ? `<p><strong>Delivered:</strong> ${new Date(order.delivered_at).toLocaleString()}</p>` : ''}
                ${order.notes ? `
                    <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-left: 3px solid #007bff; border-radius: 4px;">
                        <strong>Order Notes:</strong>
                        <p style="margin: 5px 0 0 0;">${order.notes}</p>
                    </div>
                ` : ''}
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Shipping Address</h4>
                <p>${order.shipping_name}</p>
                <p>${order.shipping_street}</p>
                <p>${order.shipping_city}${order.shipping_state ? ', ' + order.shipping_state : ''} ${order.shipping_postal_code}</p>
                <p>${order.shipping_country}</p>
                ${order.shipping_phone ? `<p>Phone: ${order.shipping_phone}</p>` : ''}
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Order Items</h4>
                ${items.map(item => `
                    <div style="display: flex; gap: 15px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <img src="${item.image_url || 'placeholder.jpg'}" alt="${item.product_name}" style="width: 80px; height: 100px; object-fit: cover; border-radius: 4px;">
                        <div>
                            <p style="font-weight: 600; margin: 0 0 5px 0;">${item.product_name}</p>
                            ${item.size ? `<p style="margin: 0 0 5px 0;">Size: ${item.size}</p>` : ''}
                            <p style="margin: 0 0 5px 0;">Quantity: ${item.quantity}</p>
                            <p style="margin: 0; font-weight: 600;">$${parseFloat(item.total_price).toFixed(2)}</p>
                        </div>
                    </div>
                `).join('')}
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

            ${payments && payments.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h4>Payment Information</h4>
                    ${payments.map(payment => `
                        <p><strong>Payment Intent ID:</strong> ${payment.stripe_payment_intent_id}</p>
                        <p><strong>Status:</strong> ${this.formatStatus(payment.status)}</p>
                        ${payment.receipt_url ? `<p><a href="${payment.receipt_url}" target="_blank">View Receipt</a></p>` : ''}
                    `).join('')}
                </div>
            ` : ''}

            ${refunds && refunds.length > 0 ? `
                <div style="padding: 15px; background-color: #fff3cd; border-radius: 4px;">
                    <h4 style="margin-top: 0;">Refund Information</h4>
                    ${refunds.map(refund => `
                        <p><strong>Status:</strong> ${this.formatStatus(refund.status)}</p>
                        <p><strong>Amount:</strong> $${parseFloat(refund.amount).toFixed(2)}</p>
                        <p><strong>Reason:</strong> ${this.formatStatus(refund.reason)}</p>
                        ${refund.reason_description ? `<p><strong>Details:</strong> ${refund.reason_description}</p>` : ''}
                        ${refund.stripe_refund_id ? `<p><strong>Stripe Refund ID:</strong> ${refund.stripe_refund_id}</p>` : ''}
                    `).join('<hr style="margin: 15px 0;">')}
                </div>
            ` : ''}
        `;

        document.getElementById('order-modal-overlay').style.display = 'flex';
    }

    openStatusModal(orderNumber) {
        this.currentOrderNumber = orderNumber;
        document.getElementById('status-modal-overlay').style.display = 'flex';
    }

    openDeleteModal(orderNumber) {
        this.currentOrderNumber = orderNumber;
        document.getElementById('delete-modal-overlay').style.display = 'flex';
    }

    closeOrderModal() {
        document.getElementById('order-modal-overlay').style.display = 'none';
    }

    closeStatusModal() {
        document.getElementById('status-modal-overlay').style.display = 'none';
        document.getElementById('status-form').reset();
        this.currentOrderNumber = null;
    }

    closeDeleteModal() {
        document.getElementById('delete-modal-overlay').style.display = 'none';
        this.currentOrderNumber = null;
    }

    async updateOrderStatus() {
        const newStatus = document.getElementById('new-status').value;

        try {
            const response = await fetch(`${websiteUrl}/admin/orders/${this.currentOrderNumber}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': window.getCsrfToken()
                },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update order status');
            }

            showToast('Order status updated successfully', 'success');
            this.closeStatusModal();
            await this.loadOrders();

        } catch (error) {
            console.error('Update status error:', error);
            showToast('Failed to update order status: ' + error.message, 'error');
        }
    }

    async deleteOrder() {
        try {
            const response = await fetch(`${websiteUrl}/admin/orders/${this.currentOrderNumber}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'x-csrf-token': window.getCsrfToken()
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete order');
            }

            showToast('Order deleted successfully', 'success');

            this.closeDeleteModal();
            await this.loadOrders();

        } catch (error) {
            console.error('Delete order error:', error);
            showToast('Failed to delete order: ' + error.message, 'error');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminOrdersManager = new AdminOrdersManager();
});