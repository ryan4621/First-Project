// admin-session-logs.js

const API_BASE = `${websiteUrl}/admin`;

let currentPage = 1;
const logsPerPage = 50;
let currentFilters = {
  admin_id: 'all',
  action: 'all',
  entity_type: 'all',
  search: '',
  date_from: '',
  date_to: ''
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
  loadAdminList();
  loadActivityLogs();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Apply filters button
  document.getElementById('admin-session-logs-apply-filters').addEventListener('click', () => {
    currentPage = 1;
    applyFilters();
    loadActivityLogs();
  });

  // Reset filters button
  document.getElementById('admin-session-logs-reset-filters').addEventListener('click', () => {
    resetFilters();
  });

  // Export button
  document.getElementById('admin-session-logs-export-btn').addEventListener('click', () => {
    exportLogs();
  });

  // Pagination buttons
  document.getElementById('admin-session-logs-prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadActivityLogs();
    }
  });

  document.getElementById('admin-session-logs-next-btn').addEventListener('click', () => {
    currentPage++;
    loadActivityLogs();
  });

  // Enter key on search
  document.getElementById('admin-session-logs-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      applyFilters();
      loadActivityLogs();
    }
  });

  // Modal close
  const modal = document.getElementById('admin-session-logs-detail-modal');
  const closeBtn = modal.querySelector('.admin-session-logs-modal-close');
  
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Load statistics
async function loadStatistics() {
  try {
    const response = await fetch(`${API_BASE}/activity-logs/statistics`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch statistics');

    const result = await response.json();
    const stats = result.data.overall;

    document.getElementById('admin-session-logs-total-actions').textContent = 
      stats.total_actions.toLocaleString();
    document.getElementById('admin-session-logs-active-admins').textContent = 
      stats.active_admins.toLocaleString();
    document.getElementById('admin-session-logs-actions-today').textContent = 
      stats.actions_today.toLocaleString();
    document.getElementById('admin-session-logs-actions-week').textContent = 
      stats.actions_week.toLocaleString();

  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

// Load admin list for filter dropdown
async function loadAdminList() {
  try {
    const response = await fetch(`${API_BASE}/activity-logs/filters/admins`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const result = await response.json();
    const adminSelect = document.getElementById('admin-session-logs-admin-filter');
    
    result.data.forEach(admin => {
      const option = document.createElement('option');
      option.value = admin.id;
      option.textContent = `${admin.name} (${admin.email})`;
      adminSelect.appendChild(option);
    });

  } catch (error) {
    console.error('Error loading admin list:', error);
  }
}

// Apply filters from UI
function applyFilters() {
  currentFilters = {
    admin_id: document.getElementById('admin-session-logs-admin-filter').value,
    action: document.getElementById('admin-session-logs-action-filter').value,
    entity_type: document.getElementById('admin-session-logs-entity-filter').value,
    search: document.getElementById('admin-session-logs-search').value.trim(),
    date_from: document.getElementById('admin-session-logs-date-from').value,
    date_to: document.getElementById('admin-session-logs-date-to').value
  };
}

// Reset filters
function resetFilters() {
  currentPage = 1;
  currentFilters = {
    admin_id: 'all',
    action: 'all',
    entity_type: 'all',
    search: '',
    date_from: '',
    date_to: ''
  };

  document.getElementById('admin-session-logs-admin-filter').value = 'all';
  document.getElementById('admin-session-logs-action-filter').value = 'all';
  document.getElementById('admin-session-logs-entity-filter').value = 'all';
  document.getElementById('admin-session-logs-search').value = '';
  document.getElementById('admin-session-logs-date-from').value = '';
  document.getElementById('admin-session-logs-date-to').value = '';

  loadActivityLogs();
}

// Load activity logs
async function loadActivityLogs() {
  const tableBody = document.getElementById('admin-session-logs-table-body');
  tableBody.innerHTML = '<tr><td colspan="7" class="admin-session-logs-loading">Loading activity logs...</td></tr>';

  try {
    const offset = (currentPage - 1) * logsPerPage;
    const queryParams = new URLSearchParams({
      ...currentFilters,
      limit: logsPerPage,
      offset: offset,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });

    const response = await fetch(`${API_BASE}/activity-logs?${queryParams}`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch logs');

    const result = await response.json();
    const logs = result.data.logs;
    const pagination = result.data.pagination;

    if (logs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="admin-session-logs-empty">
            <div class="admin-session-logs-empty-icon">📋</div>
            <div>No activity logs found</div>
          </td>
        </tr>
      `;
      updatePagination(pagination);
      return;
    }

    // Populate table
    tableBody.innerHTML = logs.map(log => `
      <tr>
        <td class="admin-session-logs-timestamp">
          ${formatTimestamp(log.created_at)}
        </td>
        <td>
          <strong>${escapeHtml(log.admin_name || 'Unknown')}</strong><br>
          <small style="color: #6b7280;">${escapeHtml(log.admin_email || '')}</small>
        </td>
        <td class="admin-session-logs-action">
          ${formatAction(log.action)}
        </td>
        <td>
          ${log.entity_type ? `<span class="admin-session-logs-badge admin-session-logs-badge-${log.entity_type.replace('_', '')}">${formatEntityType(log.entity_type)}</span>` : '-'}
        </td>
        <td>
          ${log.entity_id ? escapeHtml(log.entity_id) : '-'}
        </td>
        <td style="color: #6b7280; font-size: 13px;">
          ${log.ip_address || '-'}
        </td>
        <td>
          <button class="admin-session-logs-view-btn" onclick="viewLogDetails(${log.id})">
            View Details
          </button>
        </td>
      </tr>
    `).join('');

    updatePagination(pagination);

  } catch (error) {
    console.error('Error loading activity logs:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-session-logs-empty" style="color: #ef4444;">
          Error loading activity logs. Please try again.
        </td>
      </tr>
    `;
  }
}

// Update pagination controls
function updatePagination(pagination) {
  const start = pagination.offset + 1;
  const end = Math.min(pagination.offset + pagination.limit, pagination.total);
  const total = pagination.total;

  document.getElementById('admin-session-logs-page-info').textContent = 
    `Showing ${start} - ${end} of ${total} logs`;

  const prevBtn = document.getElementById('admin-session-logs-prev-btn');
  const nextBtn = document.getElementById('admin-session-logs-next-btn');

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = !pagination.hasMore;
}

// View log details in modal
async function viewLogDetails(logId) {
  const modal = document.getElementById('admin-session-logs-detail-modal');
  const modalBody = document.getElementById('admin-session-logs-modal-body');

  modalBody.innerHTML = '<p style="text-align: center; padding: 20px;">Loading details...</p>';
  modal.style.display = 'block';

  try {
    const response = await fetch(`${API_BASE}/activity-logs/${logId}`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch log details');

    const result = await response.json();
    const log = result.data;

    modalBody.innerHTML = `
      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Log ID</div>
        <div class="admin-session-logs-detail-value">${log.id}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Admin</div>
        <div class="admin-session-logs-detail-value">
          <strong>${escapeHtml(log.admin_name || 'Unknown')}</strong><br>
          ${escapeHtml(log.admin_email || '')}
        </div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Action</div>
        <div class="admin-session-logs-detail-value">${formatAction(log.action)}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Entity Type</div>
        <div class="admin-session-logs-detail-value">${log.entity_type ? formatEntityType(log.entity_type) : '-'}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Entity ID</div>
        <div class="admin-session-logs-detail-value">${log.entity_id || '-'}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Request Method</div>
        <div class="admin-session-logs-detail-value">${log.request_method || '-'}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Request Path</div>
        <div class="admin-session-logs-detail-value">${escapeHtml(log.request_path || '-')}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Status Code</div>
        <div class="admin-session-logs-detail-value">${log.status_code || '-'}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">IP Address</div>
        <div class="admin-session-logs-detail-value">${log.ip_address || '-'}</div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">User Agent</div>
        <div class="admin-session-logs-detail-value" style="word-break: break-all;">
          ${escapeHtml(log.user_agent || '-')}
        </div>
      </div>

      <div class="admin-session-logs-detail-row">
        <div class="admin-session-logs-detail-label">Timestamp</div>
        <div class="admin-session-logs-detail-value">${formatTimestamp(log.created_at)}</div>
      </div>

      ${log.new_value ? `
        <div class="admin-session-logs-detail-row">
          <div class="admin-session-logs-detail-label">Additional Data</div>
          <div class="admin-session-logs-detail-code">${escapeHtml(formatJSON(log.new_value))}</div>
        </div>
      ` : ''}
    `;

  } catch (error) {
    console.error('Error loading log details:', error);
    modalBody.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Failed to load log details</p>';
  }
}

// Export logs as CSV
function exportLogs() {
  const queryParams = new URLSearchParams({
    ...currentFilters
  });

  window.location.href = `${API_BASE}/activity-logs/export?${queryParams}`;
}

// Helper functions
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatAction(action) {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatEntityType(entityType) {
  const typeMap = {
    'user': 'User',
    'product': 'Product',
    'support_ticket': 'Support Ticket',
    'notification': 'Notification'
  };
  return typeMap[entityType] || entityType;
}

function formatJSON(jsonString) {
  try {
    const obj = JSON.parse(jsonString);
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return jsonString;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make viewLogDetails available globally
window.viewLogDetails = viewLogDetails;