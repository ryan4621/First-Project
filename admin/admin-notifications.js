// admin-notifications.js
class NotificationManager {
  constructor() {
    this.currentPage = 1;
    this.limit = 20;
    this.notifications = [];
    this.stats = {};
    this.init();
  }

  init() {
    this.bindEventListeners();
    this.loadStats();
    this.loadNotifications();
  }

  bindEventListeners() {
    // Main action buttons
    document.getElementById('notification-create-btn').addEventListener('click', () => {
      this.showCreateForm();
    });

    document.getElementById('notification-refresh-btn').addEventListener('click', () => {
      this.refreshData();
    });

    document.getElementById('notification-templates-btn').addEventListener('click', () => {
      this.showTemplateManager();
    });

    // Form controls
    document.getElementById('notification-cancel-btn').addEventListener('click', () => {
      this.hideCreateForm();
    });

    document.getElementById('notification-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Target audience checkbox logic
    document.getElementById('notification-target-all').addEventListener('change', (e) => {
      const userRolesSelect = document.getElementById('notification-user-roles');
      userRolesSelect.disabled = e.target.checked;
      if (e.target.checked) {
        userRolesSelect.value = '';
      }
    });

    // Modal controls
    document.getElementById('notification-modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('notification-modal').addEventListener('click', (e) => {
      if (e.target.id === 'notification-modal') {
        this.closeModal();
      }
    });

    // Logout functionality
    this.setupLogoutModal();
  }

  setupLogoutModal() {
    const logoutBtn = document.getElementById('logoutBtn');
    const modal = document.getElementById('logoutModal');
    const closeModal = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelLogout');
    const confirmBtn = document.getElementById('confirmLogout');

    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => modal.style.display = 'none');
    cancelBtn.addEventListener('click', () => modal.style.display = 'none');

    confirmBtn.addEventListener('click', async () => {
      try {
        await fetch('https://localhost:3000/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'x-csrf-token': window.getCsrfToken()
          },
        });
        sessionStorage.clear();
        window.location.href = '../frontend/farfetch.html';
      } catch (err) {
        console.error('Logout failed:', err);
      }
    });

    window.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  async loadStats() {
    try {
      const response = await fetch('https://localhost:3000/admin/notifications/statistics', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.stats = data.data;
      this.updateStatsDisplay();
    } catch (error) {
      console.error('Failed to load notification statistics:', error);
      this.showErrorMessage('Failed to load statistics');
    }
  }

  updateStatsDisplay() {
    const { overall, engagement } = this.stats;
    
    if (!overall) return;

    document.getElementById('sent-notifications-count').textContent = overall.sent_notifications || 0;
    document.getElementById('draft-notifications-count').textContent = overall.draft_notifications || 0;
    document.getElementById('total-recipients-count').textContent = overall.total_recipients_reached || 0;
    
    // Calculate read rate percentage
    const readRate = engagement && engagement.total_user_notifications > 0 
      ? Math.round((engagement.read_notifications / engagement.total_user_notifications) * 100)
      : 0;
    document.getElementById('read-rate-percentage').textContent = `${readRate}%`;
  }

  async loadNotifications() {
    this.showLoadingState();

    try {
      const params = new URLSearchParams({
        limit: this.limit,
        offset: (this.currentPage - 1) * this.limit,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });

      const response = await fetch(`https://localhost:3000/admin/notifications?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.notifications = data.data.notifications;
      this.pagination = data.data.pagination;

      this.renderNotifications();
      
    } catch (error) {
      console.error('Failed to load notifications:', error);
      this.showErrorState('Failed to load notifications');
    }
  }

  showLoadingState() {
    document.getElementById('notification-loading-state').style.display = 'block';
    document.getElementById('notification-empty-state').style.display = 'none';
    document.getElementById('notification-table').style.display = 'none';
  }

  showErrorState(message) {
    document.getElementById('notification-loading-state').style.display = 'none';
    document.getElementById('notification-empty-state').style.display = 'block';
    document.getElementById('notification-table').style.display = 'none';
    
    const emptyState = document.getElementById('notification-empty-state');
    emptyState.innerHTML = `
      <div class="notification-empty-icon">⚠️</div>
      <h3>Error Loading Notifications</h3>
      <p>${message}</p>
      <button class="notification-btn notification-btn-primary" onclick="notificationManager.refreshData()">
        Try Again
      </button>
    `;
  }

  renderNotifications() {
    const tbody = document.getElementById('notification-table-body');
    
    if (this.notifications.length === 0) {
      document.getElementById('notification-loading-state').style.display = 'none';
      document.getElementById('notification-empty-state').style.display = 'block';
      document.getElementById('notification-table').style.display = 'none';
      return;
    }

    document.getElementById('notification-loading-state').style.display = 'none';
    document.getElementById('notification-empty-state').style.display = 'none';
    document.getElementById('notification-table').style.display = 'table';

    tbody.innerHTML = this.notifications.map(notification => this.renderNotificationRow(notification)).join('');
    
    // Update notification count
    document.getElementById('notification-list-count').textContent = 
      `${this.notifications.length} notifications`;
  }

  renderNotificationRow(notification) {
    const createdDate = new Date(notification.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <tr>
        <td>
          <div>
            <strong>${notification.title}</strong><br>
            <small style="color: #7f8c8d;">${this.truncateText(notification.message, 60)}</small>
          </div>
        </td>
        <td>
          <span class="notification-category-badge notification-category-${notification.category.replace('_', '-')}">
            ${this.formatCategory(notification.category)}
          </span>
        </td>
        <td>
          <span class="notification-status-badge notification-status-${notification.status}">
            ${notification.status}
          </span>
        </td>
        <td>${notification.total_recipients || 0}</td>
        <td>${createdDate}</td>
        <td>
          <div class="notification-actions-cell">
            <button class="notification-action-btn notification-action-view" 
                    onclick="notificationManager.viewNotification(${notification.id})" 
                    title="View Details">
              👁️
            </button>
            ${notification.status === 'draft' ? `
              <button class="notification-action-btn notification-action-edit" 
                      onclick="notificationManager.editNotification(${notification.id})" 
                      title="Edit">
                ✏️
              </button>
              <button class="notification-action-btn notification-action-send" 
                      onclick="notificationManager.sendNotification(${notification.id})" 
                      title="Send Now">
                📤
              </button>
            ` : ''}
            <button class="notification-action-btn notification-action-delete" 
                    onclick="notificationManager.deleteNotification(${notification.id})" 
                    title="Delete">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  formatCategory(category) {
    const categories = {
      'marketing_emails': 'Marketing',
      'order_updates': 'Orders',
      'promotional_offers': 'Promotions',
      'general': 'General'
    };
    return categories[category] || category;
  }

  truncateText(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  showCreateForm() {
    document.getElementById('notification-create-form').classList.add('show');
    document.getElementById('notification-title').focus();
  }

  hideCreateForm() {
    document.getElementById('notification-create-form').classList.remove('show');
    document.getElementById('notification-form').reset();
    
    // Reset form state
    document.getElementById('notification-user-roles').disabled = true;
  }

  async handleFormSubmit() {
    try {
      const formData = this.collectFormData();
      
      if (!this.validateFormData(formData)) {
        return;
      }

      this.setFormLoadingState(true);

      const response = await fetch('https://localhost:3000/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': window.getCsrfToken()
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create notification');
      }

      this.showSuccessMessage('Notification created and sent successfully!');
      this.hideCreateForm();
      this.refreshData(false);

    } catch (error) {
      console.error('Failed to create notification:', error);
      this.showErrorMessage(error.message || 'Failed to create notification');
    } finally {
      this.setFormLoadingState(false);
    }
  }

  collectFormData() {
    const targetAll = document.getElementById('notification-target-all').checked;
    const userRolesSelect = document.getElementById('notification-user-roles');
    
    // Get selected roles properly
    const userRoles = targetAll ? null : Array.from(userRolesSelect.selectedOptions)
      .map(option => option.value)
      .filter(value => value); // Remove empty values

    const formData = {
      title: document.getElementById('notification-title').value.trim(),
      message: document.getElementById('notification-message').value.trim(),
      category: document.getElementById('notification-category').value,
      target_all_users: targetAll,
      send_email: document.getElementById('notification-send-email').checked,
      send_push: document.getElementById('notification-send-push').checked
    };

    // Only add target_user_roles if not targeting all users
    if (!targetAll && userRoles && userRoles.length > 0) {
      formData.target_user_roles = userRoles;
    }

    return formData;
  }

  validateFormData(data) {
    if (!data.title) {
      this.showErrorMessage('Title is required');
      return false;
    }

    if (!data.message) {
      this.showErrorMessage('Message is required');
      return false;
    }

    if (!data.category) {
      this.showErrorMessage('Category is required');
      return false;
    }

    if (!data.send_email && !data.send_push) {
      this.showErrorMessage('At least one delivery channel must be selected');
      return false;
    }

    return true;
  }

  setFormLoadingState(isLoading) {
    const submitBtn = document.querySelector('#notification-form button[type="submit"]');
    const cancelBtn = document.getElementById('notification-cancel-btn');
    
    submitBtn.disabled = isLoading;
    cancelBtn.disabled = isLoading;
    
    if (isLoading) {
      submitBtn.textContent = 'Sending...';
    } else {
      submitBtn.textContent = 'Send Notification';
    }
  }

  async viewNotification(notificationId) {
    this.showModal();
    this.showModalLoading();
    
    try {
      const response = await fetch(`https://localhost:3000/admin/notifications/${notificationId}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const notification = await response.json();
      this.renderNotificationDetails(notification);
    } catch (error) {
      console.error('Failed to load notification details:', error);
      this.showModalError('Failed to load notification details');
    }
  }

  renderNotificationDetails(notification) {
    document.getElementById('notification-modal-title').textContent = `Notification #${notification.id} - Details`;
    
    const createdDate = new Date(notification.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const sentDate = notification.sent_at ? 
      new Date(notification.sent_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Not sent';

    document.getElementById('notification-modal-body').innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Notification Information</h4>
            <p><strong>Title:</strong> ${notification.title}</p>
            <p><strong>Category:</strong> 
              <span class="notification-category-badge notification-category-${notification.category.replace('_', '-')}">
                ${this.formatCategory(notification.category)}
              </span>
            </p>
            <p><strong>Status:</strong> 
              <span class="notification-status-badge notification-status-${notification.status}">
                ${notification.status}
              </span>
            </p>
          </div>
          <div>
            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Delivery Information</h4>
            <p><strong>Total Recipients:</strong> ${notification.total_recipients || 0}</p>
            <p><strong>Email Sent:</strong> ${notification.email_sent_count || 0}</p>
            <p><strong>Push Sent:</strong> ${notification.push_sent_count || 0}</p>
          </div>
        </div>
        
        <div>
          <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">Message</h4>
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #3498db;">
            ${notification.message.replace(/\n/g, '<br>')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem; color: #7f8c8d;">
          <p><strong>Created:</strong> ${createdDate}</p>
          <p><strong>Sent:</strong> ${sentDate}</p>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
          <button class="notification-btn notification-btn-secondary" onclick="notificationManager.closeModal()">
            Close
          </button>
        </div>
      </div>
    `;
  }

  async sendNotification(notificationId) {

    // const confirmed = await showConfirmation(
    // 'Are you sure you want to send this notification? This action cannot be undone.',  
    // 'Send notification',
    //   {
    //     confirmText: 'Continue',
    //     cancelText: 'Cancel'
    //   }
    // );

    // if (!confirmed) {
    //   return;
    // }

    try {
      const response = await fetch(`https://localhost:3000/admin/notifications/${notificationId}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-csrf-token': window.getCsrfToken()
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send notification');
      }

      this.showSuccessMessage('Notification sent successfully!');
      this.refreshData(false);
    } catch (error) {
      console.error('Failed to send notification:', error);
      this.showErrorMessage(error.message || 'Failed to send notification');
    }
  }

  async deleteNotification(notificationId) {

    const confirmed = await showConfirmation(
    'Are you sure you want to delete this notification? This action cannot be undone.',  
    'Delete Notification',
      {
        confirmText: 'Continue',
        cancelText: 'Cancel',
        danger: true
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`https://localhost:3000/admin/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'x-csrf-token': window.getCsrfToken()
        }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to delete notification');
      }

      this.showSuccessMessage('Notification deleted successfully!');
      this.refreshData(false);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      this.showErrorMessage(error.message || 'Failed to delete notification');
    }
  }

  showModal() {
    document.getElementById('notification-modal').style.display = 'block';
  }

  closeModal() {
    document.getElementById('notification-modal').style.display = 'none';
  }

  showModalLoading() {
    document.getElementById('notification-modal-body').innerHTML = `
      <div class="notification-loading">
        <div class="notification-loading-spinner"></div>
        <p>Loading notification details...</p>
      </div>
    `;
  }

  showModalError(message) {
    document.getElementById('notification-modal-body').innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h3>Error</h3>
        <p>${message}</p>
        <button class="notification-btn notification-btn-primary" onclick="notificationManager.closeModal()">
          Close
        </button>
      </div>
    `;
  }

  showTemplateManager() {
    this.showToast('Template manager coming soon!', 'info');
  }

  refreshData(showMessage = true) {
    this.loadStats();
    this.loadNotifications();
    if (showMessage) {
      this.showSuccessMessage('Data refreshed successfully');
    }
  }

  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  showErrorMessage(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type) {
    const toast = document.createElement('div');
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
      ${type === 'success' ? 'background: #27ae60;' : 
        type === 'error' ? 'background: #e74c3c;' : 
        'background: #3498db;'}
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

/// Check super admin status immediately on page load
(function() {
  // Check if we already know the user is super admin
  const isSuperAdmin = sessionStorage.getItem('isSuperAdmin');
  
  if (isSuperAdmin === 'true') {
    // Immediately show the link without waiting for fetch
    document.body.classList.add('super-admin');
  }
  
  // Verify role in background (in case it changed)
  fetch('https://localhost:3000/auth/me', { credentials: 'include' })
  .then(res => res.json())
  .then(user => {
    console.log('User role:', user.role);
    if (user.role === 'super_admin') {
      sessionStorage.setItem('isSuperAdmin', 'true');
      document.body.classList.add('super-admin');
    } else {
      sessionStorage.setItem('isSuperAdmin', 'false');
      document.body.classList.remove('super-admin');
    }
  })
  .catch(err => {
    console.error('Failed to check user role:', err);
  });
})(); 
// Initialize notification manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.notificationManager = new NotificationManager();
});