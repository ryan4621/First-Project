// confirmation-modal.js

let confirmationModal = null;
let confirmResolve = null;

// Add CSS styles
const styles = `
  .confirm-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .confirm-modal-overlay.show {
    opacity: 1;
  }

  .confirm-modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    transform: scale(0.9);
    transition: transform 0.3s ease;
  }

  .confirm-modal-overlay.show .confirm-modal {
    transform: scale(1);
  }

  .confirm-modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .confirm-modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: #212529;
  }

  .confirm-modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6c757d;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .confirm-modal-close:hover {
    background: #f8f9fa;
  }

  .confirm-modal-body {
    padding: 1.5rem;
    font-size: 1rem;
    color: #495057;
    line-height: 1.5;
  }

  .confirm-modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e9ecef;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .confirm-btn {
    padding: 0.5rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .confirm-btn-cancel {
    background: #6c757d;
    color: white;
  }

  .confirm-btn-cancel:hover {
    background: #5a6268;
  }

  .confirm-btn-confirm {
    background: #212529;
    color: white;
  }

  .confirm-btn-confirm:hover {
    background: #000;
  }

  .confirm-btn-danger {
    background: #dc3545;
    color: white;
  }

  .confirm-btn-danger:hover {
    background: #c82333;
  }

  .confirm-btn-primary {
    background: #007bff;
    color: white;
  }

  .confirm-btn-primary:hover {
    background: #0056b3;
  }
`;

// Inject styles
if (!document.getElementById('confirm-modal-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'confirm-modal-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

function createConfirmationModal() {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.id = 'confirmationModalOverlay';
  
  overlay.innerHTML = `
    <div class="confirm-modal" id="confirmationModalContent">
      <div class="confirm-modal-header">
        <h5 class="confirm-modal-title" id="confirmModalTitle">Confirm Action</h5>
        <button class="confirm-modal-close" id="confirmModalClose">&times;</button>
      </div>
      <div class="confirm-modal-body" id="confirmModalBody">
        Are you sure you want to proceed?
      </div>
      <div class="confirm-modal-footer">
        <button class="confirm-btn confirm-btn-cancel" id="confirmCancelBtn">Cancel</button>
        <button class="confirm-btn confirm-btn-confirm" id="confirmOkBtn">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Prevent clicks on modal content from closing
  document.getElementById('confirmationModalContent').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Close on overlay click
  overlay.addEventListener('click', () => {
    hideModal();
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
  });

  // Close button
  document.getElementById('confirmModalClose').addEventListener('click', () => {
    hideModal();
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
  });

  // Cancel button
  document.getElementById('confirmCancelBtn').addEventListener('click', () => {
    console.log('Cancel clicked'); // Debug
    hideModal();
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
  });

  // OK button
  document.getElementById('confirmOkBtn').addEventListener('click', () => {
    console.log('OK clicked'); // Debug
    hideModal();
    if (confirmResolve) {
      confirmResolve(true);
      confirmResolve = null;
    }
  });

  confirmationModal = overlay;
}

function showModal() {
  if (!confirmationModal) {
    createConfirmationModal();
  }
  
  confirmationModal.style.display = 'flex';
  // Trigger reflow
  confirmationModal.offsetHeight;
  confirmationModal.classList.add('show');
}

function hideModal() {
  if (confirmationModal) {
    confirmationModal.classList.remove('show');
    setTimeout(() => {
      confirmationModal.style.display = 'none';
    }, 300);
  }
}

/**
 * Show confirmation modal
 * @param {string} message - The message to display
 * @param {string} title - Optional title (default: "Confirm Action")
 * @param {object} options - Optional customization
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
async function showConfirmation(message, title = 'Confirm Action', options = {}) {
  if (!confirmationModal) {
    createConfirmationModal();
  }

  const {
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
    variant = 'dark'
  } = options;

  // Set content
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalBody').innerHTML = message;
  
  const confirmBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  
  confirmBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;
  
  // Remove all variant classes
  confirmBtn.className = 'confirm-btn';
  
  // Add appropriate class
  if (danger) {
    confirmBtn.classList.add('confirm-btn-danger');
  } else if (variant === 'primary') {
    confirmBtn.classList.add('confirm-btn-primary');
  } else {
    confirmBtn.classList.add('confirm-btn-confirm');
  }

  showModal();

  // Return promise
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

// Make it globally accessible
window.showConfirmation = showConfirmation;