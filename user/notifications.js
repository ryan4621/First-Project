// notifications.js
class UserNotifications {
    constructor() {
      this.currentPage = 1;
      this.limit = 10;
      this.filters = {
        status: 'all',
        category: 'all'
      };
      this.notifications = [];
      this.selectedNotifications = new Set();
      this.init();
    }
  
    init() {
      this.bindEventListeners();
      this.loadNotifications();
    }
  
    bindEventListeners() {
      // Filter event listeners
      document.getElementById('notifications-status-filter').addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.currentPage = 1;
        this.loadNotifications();
      });
  
      document.getElementById('notifications-category-filter').addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.currentPage = 1;
        this.loadNotifications();
      });
  
      // Action buttons
      document.getElementById('notifications-refresh-btn').addEventListener('click', () => {
        this.refreshNotifications();
      });
  
      document.getElementById('notifications-mark-all-read-btn').addEventListener('click', () => {
        this.markAllAsRead();
      });
  
      // Bulk actions
      document.getElementById('notifications-select-all').addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });
  
      document.getElementById('notifications-bulk-mark-read').addEventListener('click', () => {
        this.bulkMarkAsRead();
      });
  
      document.getElementById('notifications-bulk-delete').addEventListener('click', () => {
        this.bulkDelete();
      });
  
      // Pagination
      document.getElementById('notifications-prev-btn').addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.loadNotifications();
        }
      });
  
      document.getElementById('notifications-next-btn').addEventListener('click', () => {
        this.currentPage++;
        this.loadNotifications();
      });
  
      // Auto-refresh every 30 seconds
      setInterval(() => {
        this.loadNotifications(true); // Silent refresh
      }, 30000);
    }
  
    async loadNotifications(silent = false) {
      if (!silent) {
        this.showLoadingState();
      }
  
      try {
        const params = new URLSearchParams({
          status: this.filters.status,
          category: this.filters.category,
          limit: this.limit,
          offset: (this.currentPage - 1) * this.limit,
          sortBy: 'created_at',
          sortOrder: 'DESC'
        });
  
        const response = await fetch(`https://localhost:3000/api/notifications?${params}`, {
          credentials: 'include'
        });
  
        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '../frontend/farfetch.html';
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }
  
        const data = await response.json();
        this.notifications = data.data.notifications;
        this.pagination = data.data.pagination;
        this.stats = data.data.stats;
  
        this.renderNotifications();
        this.updateStats();
        this.updatePagination();
        
      } catch (error) {
        console.error('Failed to load notifications:', error);
        if (!silent) {
          this.showErrorState('Failed to load notifications');
        }
      }
    }
  
    showLoadingState() {
      document.getElementById('notifications-loading-state').style.display = 'block';
      document.getElementById('notifications-empty-state').style.display = 'none';
      document.getElementById('notifications-container').style.display = 'none';
      document.getElementById('notifications-pagination').style.display = 'none';
    }
  
    showErrorState(message) {
      document.getElementById('notifications-loading-state').style.display = 'none';
      document.getElementById('notifications-empty-state').style.display = 'block';
      document.getElementById('notifications-container').style.display = 'none';
      document.getElementById('notifications-pagination').style.display = 'none';
      
      const emptyState = document.getElementById('notifications-empty-state');
      emptyState.innerHTML = `
        <div class="notifications-empty-icon">⚠️</div>
        <h3>Error Loading Notifications</h3>
        <p>${message}</p>
        <button class="notifications-btn notifications-btn-primary" onclick="userNotifications.refreshNotifications()">
          Try Again
        </button>
      `;
    }
  
    renderNotifications() {
      const container = document.getElementById('notifications-container');
      
      if (this.notifications.length === 0) {
        document.getElementById('notifications-loading-state').style.display = 'none';
        document.getElementById('notifications-empty-state').style.display = 'block';
        document.getElementById('notifications-container').style.display = 'none';
        document.getElementById('notifications-pagination').style.display = 'none';
        return;
      }
  
      document.getElementById('notifications-loading-state').style.display = 'none';
      document.getElementById('notifications-empty-state').style.display = 'none';
      document.getElementById('notifications-container').style.display = 'block';
      document.getElementById('notifications-pagination').style.display = 'flex';
  
      container.innerHTML = this.notifications.map(notification => 
        this.renderNotificationItem(notification)
      ).join('');
  
      // Show bulk actions if there are notifications
      if (this.notifications.length > 0) {
        document.getElementById('notifications-bulk-actions').style.display = 'flex';
      }
  
      // Update displayed count
      document.getElementById('notifications-displayed-count').textContent = 
        `${this.notifications.length} notifications`;
  
      // Reset selection
      this.selectedNotifications.clear();
      document.getElementById('notifications-select-all').checked = false;
    }
  
    renderNotificationItem(notification) {
      const isUnread = !notification.is_read;
      const createdDate = this.formatDate(notification.created_at);
      const category = this.formatCategory(notification.category);
  
      return `
        <div class="notifications-item ${isUnread ? 'unread' : ''}" data-id="${notification.id}">
          <div class="notifications-item-content">
            <div class="notifications-item-header">
              <h4 class="notifications-item-title">${notification.title}</h4>
              <div class="notifications-item-meta">
                <span class="notifications-category-badge notifications-category-${notification.category.replace('_', '-')}">
                  ${category}
                </span>
                <span class="notifications-item-date">${createdDate}</span>
              </div>
            </div>
            
            <div class="notifications-item-message">
              ${notification.message.replace(/\n/g, '<br>')}
            </div>
  
            <div class="notifications-item-actions">
              <label class="notifications-bulk-checkbox" style="margin-right: 1rem;">
                <input type="checkbox" onchange="userNotifications.toggleNotificationSelection(${notification.id}, this.checked)">
                <span>Select</span>
              </label>
              
              ${isUnread ? `
                <button class="notifications-action-btn notifications-action-mark-read" 
                        onclick="userNotifications.markAsRead(${notification.id})">
                  Mark as Read
                </button>
              ` : ''}
              
              <button class="notifications-action-btn notifications-action-delete" 
                      onclick="userNotifications.deleteNotification(${notification.id})">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }
  
    formatDate(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);
  
      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
      } else if (diffInHours < 168) { // 7 days
        return `${Math.floor(diffInHours / 24)}d ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
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
  
    updateStats() {
      if (this.stats) {
        document.getElementById('notifications-total-count').textContent = 
          `${this.stats.total || 0} notifications`;
        document.getElementById('notifications-unread-count').textContent = 
          `${this.stats.unread || 0} unread`;
      }
    }
  
    updatePagination() {
      if (!this.pagination) return;
  
      const { total, hasMore } = this.pagination;
      const totalPages = Math.ceil(total / this.limit);
      
      document.getElementById('notifications-prev-btn').disabled = this.currentPage === 1;
      document.getElementById('notifications-next-btn').disabled = !hasMore;
      
      document.getElementById('notifications-pagination-info').textContent = 
        `Page ${this.currentPage} of ${totalPages}`;
  
      // Generate page numbers
      this.generatePageNumbers(totalPages);
    }
  
    generatePageNumbers(totalPages) {
      const container = document.getElementById('notifications-page-numbers');
      container.innerHTML = '';
      
      const maxVisiblePages = 5;
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let page = startPage; page <= endPage; page++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `notifications-pagination-btn ${page === this.currentPage ? 'active' : ''}`;
        pageBtn.textContent = page;
        pageBtn.addEventListener('click', () => {
          this.currentPage = page;
          this.loadNotifications();
        });
        container.appendChild(pageBtn);
      }
    }
  
    async markAsRead(notificationId) {
      try {
        const response = await fetch(`https://localhost:3000/api/notifications/${notificationId}/read`, {
          method: 'POST',
          credentials: 'include',
          headers:  {
            'x-csrf-token': window.getCsrfToken()
          }
        });
  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
        // Update UI
        const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationElement) {
          notificationElement.classList.remove('unread');
          // Remove the mark as read button
          const markReadBtn = notificationElement.querySelector('.notifications-action-mark-read');
          if (markReadBtn) {
            markReadBtn.remove();
          }
        }
  
        // Update stats
        this.loadNotifications(true);
        this.showToast('Notification marked as read', 'success');
  
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        this.showToast('Failed to mark as read', 'error');
      }
    }
  
    async deleteNotification(notificationId) {

      const confirmed = await showConfirmation(
        'Are you sure you want to delete this notification?',  
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
        const response = await fetch(`https://localhost:3000/api/notifications/${notificationId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'x-csrf-token': window.getCsrfToken()
          }
        });
  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
        // Remove from UI
        const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationElement) {
          notificationElement.remove();
        }
  
        // Remove from selection
        this.selectedNotifications.delete(notificationId);
  
        // Reload if needed
        if (document.querySelectorAll('.notifications-item').length === 0) {
          this.loadNotifications();
        } else {
          this.loadNotifications(true); // Update stats
        }
  
        this.showToast('Notification deleted', 'success');
  
      } catch (error) {
        console.error('Failed to delete notification:', error);
        this.showToast('Failed to delete notification', 'error');
      }
    }
  
    async markAllAsRead() {

      const confirmed = await showConfirmation(
        'Are you sure you want to mark all notifications as read?',  
        'Mark all notifications as read',
        {
          confirmText: 'Continue',
          cancelText: 'Cancel',
        }
      );

      if (!confirmed) {
        return;
      }
  
      try {
        const response = await fetch('https://localhost:3000/api/notifications/mark-all-read', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'x-csrf-token': window.getCsrfToken()
          }
        });
  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
        this.loadNotifications();
        this.showToast('All notifications marked as read', 'success');
  
      } catch (error) {
        console.error('Failed to mark all as read:', error);
        this.showToast('Failed to mark all as read', 'error');
      }
    }
  
    toggleNotificationSelection(notificationId, isSelected) {
      if (isSelected) {
        this.selectedNotifications.add(notificationId);
      } else {
        this.selectedNotifications.delete(notificationId);
      }
  
      // Update select all checkbox
      const totalNotifications = this.notifications.length;
      const selectedCount = this.selectedNotifications.size;
      const selectAllCheckbox = document.getElementById('notifications-select-all');
      
      selectAllCheckbox.checked = selectedCount === totalNotifications && totalNotifications > 0;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalNotifications;
    }
  
    toggleSelectAll(selectAll) {
      this.selectedNotifications.clear();
      
      const checkboxes = document.querySelectorAll('.notifications-item input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
        if (selectAll) {
          const notificationId = parseInt(checkbox.closest('.notifications-item').dataset.id);
          this.selectedNotifications.add(notificationId);
        }
      });
    }
  
    async bulkMarkAsRead() {
      if (this.selectedNotifications.size === 0) {
        this.showToast('Please select notifications first', 'error');
        return;
      }
  
      try {
        const response = await fetch('https://localhost:3000/api/notifications/bulk-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': window.getCsrfToken()
          },
          credentials: 'include',
          body: JSON.stringify({
            notificationIds: Array.from(this.selectedNotifications)
          })
        });
  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
        this.loadNotifications();
        this.showToast(`${this.selectedNotifications.size} notifications marked as read`, 'success');
  
      } catch (error) {
        console.error('Failed to bulk mark as read:', error);
        this.showToast('Failed to mark notifications as read', 'error');
      }
    }
  
    async bulkDelete() {
      if (this.selectedNotifications.size === 0) {
        this.showToast('Please select notifications first', 'error');
        return;
      }

      const confirmed = await showConfirmation(
        `Delete ${this.selectedNotifications.size} selected notifications?`,  
        'Delete selected notifications',
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
        const response = await fetch('https://localhost:3000/api/notifications/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': window.getCsrfToken()
          },
          credentials: 'include',
          body: JSON.stringify({
            notificationIds: Array.from(this.selectedNotifications)
          })
        });
  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
        this.loadNotifications();
        this.showToast(`${this.selectedNotifications.size} notifications deleted`, 'success');
  
      } catch (error) {
        console.error('Failed to bulk delete:', error);
        this.showToast('Failed to delete notifications', 'error');
      }
    }
  
    refreshNotifications() {
      this.loadNotifications();
      this.showToast('Notifications refreshed', 'success');
    }
  
    showToast(message, type = 'success') {
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
  
// Initialize user notifications when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.userNotifications = new UserNotifications();
});