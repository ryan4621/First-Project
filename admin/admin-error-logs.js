// admin-error-logs.js

const API_BASE = 'https://localhost:3000/admin';

let currentPage = 1;
const errorsPerPage = 50;
let currentFilters = {
  severity: 'all',
  error_type: 'all',
  resolved: 'all',
  search: '',
  date_from: '',
  date_to: ''
};
let currentErrorId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
  loadErrorTypes();
  loadErrorLogs();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('error-logs-apply-filters').addEventListener('click', () => {
    currentPage = 1;
    applyFilters();
    loadErrorLogs();
  });

  document.getElementById('error-logs-reset-filters').addEventListener('click', resetFilters);
  document.getElementById('error-logs-export-btn').addEventListener('click', exportLogs);

  document.getElementById('error-logs-prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadErrorLogs();
    }
  });

  document.getElementById('error-logs-next-btn').addEventListener('click', () => {
    currentPage++;
    loadErrorLogs();
  });

  document.getElementById('error-logs-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      applyFilters();
      loadErrorLogs();
    }
  });

  // Detail modal
  const detailModal = document.getElementById('error-logs-detail-modal');
  detailModal.querySelector('.error-logs-modal-close').addEventListener('click', () => {
    detailModal.style.display = 'none';
  });

  // Resolve modal
  const resolveModal = document.getElementById('error-logs-resolve-modal');
  resolveModal.querySelector('.error-logs-resolve-close').addEventListener('click', () => {
    resolveModal.style.display = 'none';
  });
  document.getElementById('error-logs-cancel-resolve').addEventListener('click', () => {
    resolveModal.style.display = 'none';
  });
  document.getElementById('error-logs-confirm-resolve').addEventListener('click', confirmErrorResolve);

  window.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.style.display = 'none';
    if (e.target === resolveModal) resolveModal.style.display = 'none';
  });
}

// Load statistics
async function loadStatistics() {
  try {
    const response = await fetch(`${API_BASE}/error-logs/statistics`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch statistics');

    const result = await response.json();
    const stats = result.data.overall;

    document.getElementById('error-logs-critical-count').textContent = stats.critical_errors.toLocaleString();
    document.getElementById('error-logs-high-count').textContent = stats.high_errors.toLocaleString();
    document.getElementById('error-logs-unresolved-count').textContent = stats.unresolved_errors.toLocaleString();
    document.getElementById('error-logs-today-count').textContent = stats.errors_today.toLocaleString();

  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

// Load error types for filter
async function loadErrorTypes() {
  try {
    const response = await fetch(`${API_BASE}/error-logs/filters/error-types`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const result = await response.json();
    const typeSelect = document.getElementById('error-logs-type-filter');
    
    result.data.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeSelect.appendChild(option);
    });

  } catch (error) {
    console.error('Error loading error types:', error);
  }
}

// Apply filters
function applyFilters() {
  currentFilters = {
    severity: document.getElementById('error-logs-severity-filter').value,
    error_type: document.getElementById('error-logs-type-filter').value,
    resolved: document.getElementById('error-logs-resolved-filter').value,
    search: document.getElementById('error-logs-search').value.trim(),
    date_from: document.getElementById('error-logs-date-from').value,
    date_to: document.getElementById('error-logs-date-to').value
  };
}

// Reset filters
function resetFilters() {
  currentPage = 1;
  currentFilters = {
    severity: 'all',
    error_type: 'all',
    resolved: 'all',
    search: '',
    date_from: '',
    date_to: ''
  };

  document.getElementById('error-logs-severity-filter').value = 'all';
  document.getElementById('error-logs-type-filter').value = 'all';
  document.getElementById('error-logs-resolved-filter').value = 'all';
  document.getElementById('error-logs-search').value = '';
  document.getElementById('error-logs-date-from').value = '';
  document.getElementById('error-logs-date-to').value = '';

  loadErrorLogs();
}

// Load error logs
async function loadErrorLogs() {
  const tableBody = document.getElementById('error-logs-table-body');
  tableBody.innerHTML = '<tr><td colspan="8" class="error-logs-loading">Loading error logs...</td></tr>';

  try {
    const offset = (currentPage - 1) * errorsPerPage;
    const queryParams = new URLSearchParams({
      ...currentFilters,
      limit: errorsPerPage,
      offset: offset,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });

    const response = await fetch(`${API_BASE}/error-logs?${queryParams}`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch errors');

    const result = await response.json();
    const errors = result.data.errors;
    const pagination = result.data.pagination;

    if (errors.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="error-logs-empty">
            <div class="error-logs-empty-icon">🔍</div>
            <div>No error logs found</div>
          </td>
        </tr>
      `;
      updatePagination(pagination);
      return;
    }

    tableBody.innerHTML = errors.map(error => `
      <tr>
        <td class="error-logs-timestamp">
          ${formatTimestamp(error.created_at)}
        </td>
        <td>
          <span class="error-logs-severity-badge error-logs-severity-${error.severity}">
            ${error.severity}
          </span>
        </td>
        <td>
          <strong>${escapeHtml(error.error_type)}</strong>
        </td>
        <td>
          <div class="error-logs-message" title="${escapeHtml(error.error_message)}">
            ${escapeHtml(error.error_message)}
          </div>
        </td>
        <td style="font-size: 0.8125rem; color: #6b7280;">
          ${error.request_path ? escapeHtml(error.request_path) : '-'}
        </td>
        <td>
          ${error.user_email ? `<div><strong>${escapeHtml(error.user_name || 'Unknown')}</strong><br><small style="color: #6b7280;">${escapeHtml(error.user_email)}</small></div>` : '-'}
        </td>
        <td>
          <span class="error-logs-status-badge error-logs-status-${error.resolved ? 'resolved' : 'unresolved'}">
            ${error.resolved ? 'Resolved' : 'Unresolved'}
          </span>
        </td>
        <td>
          <div class="error-logs-action-btns">
            <button class="error-logs-btn error-logs-btn-primary" onclick="viewErrorDetails(${error.id})">
              View
            </button>
            ${!error.resolved ? `
              <button class="error-logs-btn error-logs-btn-success" onclick="openResolveModal(${error.id})">
                Resolve
              </button>
            ` : `
              <button class="error-logs-btn error-logs-btn-secondary" onclick="unresolveError(${error.id})">
                Unresolve
              </button>
            `}
          </div>
        </td>
      </tr>
    `).join('');

    updatePagination(pagination);

  } catch (error) {
    console.error('Error loading error logs:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="error-logs-empty" style="color: #ef4444;">
          Error loading error logs. Please try again.
        </td>
      </tr>
    `;
  }
}

// Update pagination
function updatePagination(pagination) {
  const start = pagination.offset + 1;
  const end = Math.min(pagination.offset + pagination.limit, pagination.total);
  const total = pagination.total;

  document.getElementById('error-logs-page-info').textContent = 
    `Showing ${start} - ${end} of ${total} errors`;

  document.getElementById('error-logs-prev-btn').disabled = currentPage === 1;
  document.getElementById('error-logs-next-btn').disabled = !pagination.hasMore;
}

// View error details
async function viewErrorDetails(errorId) {
  const modal = document.getElementById('error-logs-detail-modal');
  const modalBody = document.getElementById('error-logs-modal-body');

  modalBody.innerHTML = '<p style="text-align: center; padding: 20px;">Loading details...</p>';
  modal.style.display = 'block';

  try {
    const response = await fetch(`${API_BASE}/error-logs/${errorId}`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch error details');

    const result = await response.json();
    const error = result.data;

    modalBody.innerHTML = `
      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Error ID</div>
        <div class="error-logs-detail-value">#${error.id}</div>
      </div>

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Severity</div>
        <div class="error-logs-detail-value">
          <span class="error-logs-severity-badge error-logs-severity-${error.severity}">
            ${error.severity.toUpperCase()}
          </span>
        </div>
      </div>

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Error Type</div>
        <div class="error-logs-detail-value"><strong>${escapeHtml(error.error_type)}</strong></div>
      </div>

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Error Message</div>
        <div class="error-logs-detail-value">${escapeHtml(error.error_message)}</div>
      </div>

      ${error.stack_trace ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">Stack Trace</div>
          <div class="error-logs-detail-code">${escapeHtml(error.stack_trace)}</div>
        </div>
      ` : ''}

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Request Method</div>
        <div class="error-logs-detail-value">${error.request_method || '-'}</div>
      </div>

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Request Path</div>
        <div class="error-logs-detail-value">${escapeHtml(error.request_path || '-')}</div>
      </div>

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Status Code</div>
        <div class="error-logs-detail-value">${error.status_code || '-'}</div>
      </div>

      ${error.user_email ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">User</div>
          <div class="error-logs-detail-value">
            <strong>${escapeHtml(error.user_name || 'Unknown')}</strong><br>
            ${escapeHtml(error.user_email)}<br>
            <small>Role: ${error.user_role || '-'}</small>
          </div>
        </div>
      ` : ''}

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">IP Address</div>
        <div class="error-logs-detail-value">${error.ip_address || '-'}</div>
      </div>

      ${error.user_agent ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">User Agent</div>
          <div class="error-logs-detail-value" style="word-break: break-all;">
            ${escapeHtml(error.user_agent)}
          </div>
        </div>
      ` : ''}

      ${error.request_body ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">Request Body</div>
          <div class="error-logs-detail-code">${escapeHtml(formatJSON(error.request_body))}</div>
        </div>
      ` : ''}

      ${error.request_query ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">Query Params</div>
          <div class="error-logs-detail-code">${escapeHtml(formatJSON(error.request_query))}</div>
        </div>
      ` : ''}

      ${error.additional_data ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">Additional Data</div>
          <div class="error-logs-detail-code">${escapeHtml(formatJSON(error.additional_data))}</div>
        </div>
      ` : ''}

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Status</div>
        <div class="error-logs-detail-value">
          <span class="error-logs-status-badge error-logs-status-${error.resolved ? 'resolved' : 'unresolved'}">
            ${error.resolved ? 'Resolved' : 'Unresolved'}
          </span>
        </div>
      </div>

      ${error.resolved ? `
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">Resolved At</div>
          <div class="error-logs-detail-value">${formatTimestamp(error.resolved_at)}</div>
        </div>
        <div class="error-logs-detail-row">
          <div class="error-logs-detail-label">Resolved By</div>
          <div class="error-logs-detail-value">${escapeHtml(error.resolved_by_name || 'Unknown')}</div>
        </div>
        ${error.resolution_notes ? `
          <div class="error-logs-detail-row">
            <div class="error-logs-detail-label">Resolution Notes</div>
            <div class="error-logs-detail-value">${escapeHtml(error.resolution_notes)}</div>
          </div>
        ` : ''}
      ` : ''}

      <div class="error-logs-detail-row">
        <div class="error-logs-detail-label">Timestamp</div>
        <div class="error-logs-detail-value">${formatTimestamp(error.created_at)}</div>
      </div>
    `;

  } catch (error) {
    console.error('Error loading error details:', error);
    modalBody.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Failed to load error details</p>';
  }
}

// Open resolve modal
function openResolveModal(errorId) {
  currentErrorId = errorId;
  document.getElementById('error-logs-resolution-notes').value = '';
  document.getElementById('error-logs-resolve-modal').style.display = 'block';
}

// Confirm resolve
async function confirmErrorResolve() {
  const notes = document.getElementById('error-logs-resolution-notes').value.trim();

  try {
    const response = await fetch(`${API_BASE}/error-logs/${currentErrorId}/resolve`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.getCsrfToken()
      },
      body: JSON.stringify({ resolution_notes: notes })
    });

    if (!response.ok) throw new Error('Failed to resolve error');

    document.getElementById('error-logs-resolve-modal').style.display = 'none';
    loadErrorLogs();
    loadStatistics();

  } catch (error) {
    console.error('Error resolving error:', error);
    showToast('Failed to resolve error. Please try again.', 'error');

  }
}

// Unresolve error
async function unresolveError(errorId) {

  const confirmed = await showConfirmation(
    'Mark this error as unresolved?',  
    'Unresolve error',
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
    const response = await fetch(`${API_BASE}/error-logs/${errorId}/unresolve`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'x-csrf-token': window.getCsrfToken()
      }
    });

    if (!response.ok) throw new Error('Failed to unresolve error');

    loadErrorLogs();
    loadStatistics();

  } catch (error) {
    console.error('Error unresolving error:', error);
    showToast('Failed to unresolve error. Please try again.', 'error');
  }
}

// Export logs
function exportLogs() {
  const queryParams = new URLSearchParams(currentFilters);
  window.location.href = `${API_BASE}/error-logs/export?${queryParams}`;
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

function formatJSON(jsonString) {
  try {
    const obj = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return jsonString;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions available globally
window.viewErrorDetails = viewErrorDetails;
window.openResolveModal = openResolveModal;
window.unresolveError = unresolveError;