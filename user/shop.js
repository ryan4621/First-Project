//shop.js

let cart = [];
let cartCount = 0;
let cartTotal = 0;

// Check authentication on page load
async function checkAuth() {
    try {
        const response = await fetch(`${websiteUrl}/auth/me`, { credentials: 'include' });
        if (!response.ok) {
            // window.location.href = '../frontend/farfetch.html';
            return;
        }
        const user = await response.json();
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = `Hello, ${user.name || 'User'}`;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // window.location.href = '../frontend/farfetch.html';
    }
}

// API helper
async function apiCall(url, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': window.getCsrfToken()
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${websiteUrl}${url}`, options);
        
        // IMPROVED: Better error handling with response body
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        return null;
    }
}

// Load products
async function loadProducts() {
    const products = await apiCall('/api/products');
    if (!products) {
        console.error('Failed to load products');
        return;
    }

    const loadingElement = document.getElementById('loading-state');
    const gridElement = document.getElementById('products-grid');
    
    if (loadingElement) loadingElement.style.display = 'none';
    if (gridElement) gridElement.style.display = 'grid';

    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        // CRITICAL FIX: Use product.product_id instead of product.id
        // This must match your database column name
        const productId = product.product_id || product.id;
        
        productCard.innerHTML = `
            <img src="${product.image_url || 'https://via.placeholder.com/280x300'}" 
                 alt="${product.name}" class="product-image">
            <div class="product-details">
                <div class="product-name">${product.name}</div>
                <span class="cart-item-title">${product.description}</span>
                <div class="product-price">$${product.price}</div>
                <button class="add-to-cart-btn" onclick="addToCart('${productId}', '${product.name.replace(/'/g, "\\'")}', '${product.description}', '${product.price}', '${product.image_url || ''}')">
                    Add to Cart
                </button>
            </div>
        `;
        
        grid.appendChild(productCard);
    });
}

// FIXED: Add to cart with better error handling and logging
async function addToCart(productId, productName, productDescription, productPrice, productImage) {
    console.log('Adding to cart:', { productId, productName }); // Debug log
    
    // Check if item already exists in cart using product_id
    const existingItem = cart.find(item => item.product_id === productId);
    if (existingItem) {
        showToast('Item is already in your cart', 'warning');
        return;
    }

    // FIXED: Correct endpoint and payload structure
    const result = await apiCall('/api/cart/add', 'POST', {
        productId: productId,  // Backend expects 'productId'
        quantity: 1,
        size: null
    });

    console.log('Add to cart result:', result); // Debug log

    if (result && result.items) {
        // Find the added item to get its cart item ID
        const addedItem = result.items.find(item => item.product_id === productId);
        
        // FIXED: Use product_id consistently
        cart.push({
            product_id: productId,
            id: productId, // Keep for backward compatibility
            cartItemId: addedItem ? addedItem.id : null,
            name: productName,
            price: parseFloat(productPrice),
            image: productImage,
            description: productDescription,
            quantity: 1
        });
        
        updateCartDisplay();
        // showToast('Item added to cart!', 'success');
    } else {
        console.error('Failed to add item. Result:', result);
        showToast('Failed to add item to cart. Please try again.', 'error');
    }
}

// Load cart data
async function loadCart() {
    const cartData = await apiCall('/api/cart');
    if (cartData && cartData.items) {
        // FIXED: Map using product_id consistently
        cart = cartData.items.map(item => ({
            product_id: item.product_id,
            id: item.product_id, // Keep for backward compatibility
            cartItemId: item.id,
            name: item.name,
            price: parseFloat(item.price),
            image: item.image_url || '',
            description: item.description,
            quantity: item.quantity
        }));
        updateCartDisplay();
    }
}

// Update cart display
function updateCartDisplay() {
    cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Update badge - only count unique items, not quantities
    const badge = document.getElementById('cart-badge');
    if (badge) {
        const uniqueItemCount = cart.length;
        if (uniqueItemCount > 0) {
            badge.style.display = 'block';
            badge.textContent = uniqueItemCount;
        } else {
            badge.style.display = 'none';
        }
    }
    
    // Update modal content
    updateCartModal();
}

// Update cart modal
function updateCartModal() {
    const cartBody = document.getElementById('cart-body');
    const cartFooter = document.getElementById('cart-footer');
    const cartEmpty = document.getElementById('cart-empty');
    
    // Check if elements exist
    if (!cartBody || !cartFooter) {
        console.error('Cart modal elements not found');
        return;
    }
    
    if (cart.length === 0) {
        // Clear the body completely and show empty state
        cartBody.innerHTML = `
            <div class="cart-empty" style="text-align: center; padding: 2rem;">
                <div class="cart-empty-icon" style="font-size: 3rem; margin-bottom: 1rem;">🛒</div>
                <h4>Your cart is empty</h4>
                <p>Add some products to get started!</p>
            </div>
        `;
        cartFooter.style.display = 'none';
        return;
    }
    
    cartFooter.style.display = 'block';
    
    cartBody.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
            <button class="clear-cart-btn support-btn-secondary" onclick="clearCart()">
                Clear Cart
            </button>
        </div>
        ${cart.map(item => `
        <div class="cart-item">
            <img src="${item.image || 'https://via.placeholder.com/80x80'}" 
                 alt="${item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-description">${item.description}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="updateQuantity('${item.product_id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${item.product_id}', 1)">+</button>
                    <button class="quantity-btn" onclick="removeFromCart('${item.product_id}')" 
                            style="background: #e74c3c; color: white; margin-left: 0.5rem;" title="Remove item">
                        ×
                    </button>
                </div>
            </div>
        </div>
    `).join('')}`;
    
    const totalElement = document.getElementById('cart-total');
    if (totalElement) {
        totalElement.textContent = `$${cartTotal.toFixed(2)}`;
    }
}

// Update quantity
async function updateQuantity(productId, change) {
    // FIXED: Find by product_id
    const item = cart.find(item => item.product_id === productId);
    if (!item || !item.cartItemId) return;
    
    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    try {
        const response = await fetch(`${websiteUrl}/api/cart/update/${item.cartItemId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': window.getCsrfToken()
            },
            body: JSON.stringify({ quantity: newQuantity })
        });
        
        if (response.ok) {
            const result = await response.json();
            item.quantity = newQuantity;
            updateCartDisplay();
            // showToast('Cart updated', 'success');
        } else {
            const errorData = await response.json();
            if (errorData.message && errorData.message.includes('stock')) {
                showToast('No more items available in stock', 'warning');
            } else {
                showToast('Failed to update quantity', 'error');
            }
        }
    } catch (error) {
        console.error('Update quantity error:', error);
        showToast('Failed to update quantity', 'error');
    }
}

// Remove individual item from cart
async function removeFromCart(productId) {
    // FIXED: Find by product_id
    const item = cart.find(item => item.product_id === productId);
    if (!item || !item.cartItemId) return;
    
    // Use correct endpoint
    const result = await apiCall(`/api/cart/remove/${item.cartItemId}`, 'DELETE');
    
    if (result) {
        cart = cart.filter(item => item.product_id !== productId);
        updateCartDisplay();
        showToast('Item removed from cart', 'success');
    } else {
        showToast('Failed to remove item', 'error');
    }
}

// Clear entire cart
async function clearCart() {

    const confirmed = await showConfirmation(
        'Are you sure you want to clear your entire cart?',  
        'Clear cart',
        {
          confirmText: 'Continue',
          cancelText: 'Cancel',
          danger: true
        }
      );

      if (!confirmed) {
        return;
      }
    
    const result = await apiCall('/api/cart/clear', 'DELETE');
    
    if (result) {
        cart = [];
        updateCartDisplay();
        showToast('Cart cleared', 'success');
    } else {
        showToast('Failed to clear cart', 'error');
    }
}

// Cart modal controls
const cartToggle = document.getElementById('cart-toggle');
const cartClose = document.getElementById('cart-close');
const cartOverlay = document.getElementById('cart-overlay');

if (cartToggle) {
    cartToggle.addEventListener('click', () => {
        const modal = document.getElementById('cart-modal');
        const overlay = document.getElementById('cart-overlay');
        if (modal) modal.classList.add('show');
        if (overlay) overlay.classList.add('show');
    });
}

if (cartClose) cartClose.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

function closeCart() {
    const modal = document.getElementById('cart-modal');
    const overlay = document.getElementById('cart-overlay');
    if (modal) modal.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

// Checkout
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            showToast('Your cart is empty', 'error');
            return;
        }
        window.location.href = 'checkout.html';
    });
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    let backgroundColor = '#27ae60'; // success - green
    
    if (type === 'error') {
        backgroundColor = '#e74c3c'; // error - red
    } else if (type === 'warning') {
        backgroundColor = '#f39c12'; // warning - orange
    }
    
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
        background: ${backgroundColor};
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadProducts();
    await loadCart();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCart();
    }
});