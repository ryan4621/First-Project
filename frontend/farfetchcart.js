// farfetchcart.js

if (document.readyState == 'loading') {
  document.addEventListener('DOMContentLoaded', ready);
} else {
  ready()
}

// Helper function for API calls
async function apiCall(url, method = 'GET', data = null) {
  try {
    const options = {
      method: method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': getSessionId(),
        'x-csrf-token': window.getCsrfToken()
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${websiteUrl}${url}`, options);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('API call failed:', error);
    return null;
  }
}

// Generate session ID for guest users
function getSessionId() {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// Load cart from backend on page load
async function loadCartFromBackend() {
  const cartData = await apiCall('/api/cart');
  if (cartData && cartData.items && cartData.items.length > 0) {
    // Clear current cart UI
    var cartItems = document.getElementsByClassName('cart-items')[0];
    if (!cartItems) return;
    cartItems.innerHTML = '';
    
    // Rebuild cart from backend data
    cartCount = 0;
    cartData.items.forEach(item => {
      addItemToCartFromBackend(item);
      cartCount += item.quantity;
    });
    
    // Update UI
    var cartBadge = document.getElementsByClassName("cart-badge")[0];
    if (cartBadge && cartCount > 0) {
      cartBadge.style.display = 'block';
      cartBadge.textContent = cartCount;
    }
    
    updateCartTotal();
    showCartElements();
  }
}

// Load products from backend - FIXED: Call /api/products endpoint
async function loadProductsFromDatabase() {
  try {
    // FIX: Changed from /api/cart to /api/products
    const response = await fetch(`${websiteUrl}/api/products`, {
      credentials: 'include',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': getSessionId()
      }
    });
    
    if (!response.ok) {
      console.error('Failed to load products:', response.status);
      return;
    }
    
    const products = await response.json();
    console.log('Products received:', products);

    renderProducts(products);
    
    // Re-initialize event listeners for new products
    setTimeout(() => {
      initializeProductButtons();
    }, 100);
    
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

// Render products dynamically
function renderProducts(products) {
  const productContainer = document.querySelector('.rec-item');
  if (!productContainer) return;

  // Guard against non-array data
  if (!Array.isArray(products)) {
    console.error('Products is not an array:', products);
    return;
  }
  
  // Clear existing static products but keep navigation arrows
  const existingArrows = productContainer.querySelectorAll('.rec-item-icon');
  productContainer.innerHTML = '';
  
  // Re-add navigation arrows
  existingArrows.forEach(arrow => {
    productContainer.appendChild(arrow);
  });
  
  // Add dynamic products
  products.forEach(product => {
    const productBox = createProductElement(product);
    productContainer.appendChild(productBox);
  });
}

// Create individual product element
function createProductElement(product) {
  const productBox = document.createElement('div');
  productBox.classList.add('rec-item-box');
  
  // Better image handling with fallback
  const imageUrl = product.image_url || './images/default-product.jpg';
  
  // console.log('Creating product:', product.name, 'Image:', imageUrl, 'ID:', product.product_id);
  
  productBox.innerHTML = `
    <div class="heart">
      <img src="${imageUrl}" class="shop-item-image">
      <i class="fa-regular fa-heart"></i>
    </div>
    <div class="shop-item-details">
      <div class="rec-item-details">
        <span class="shop-item-tag" style="display: none;">Conscious</span>
        <p class="rec-item-details-name shop-item-title" style="font-weight: bold">${product.name}</p>
        <span class="cart-item-title">${product.description || product.name}</span>
        <p class="shop-item-id" style="display: none;">${product.product_id}</p>
        <p class="rec-item-details-price shop-item-price">$${product.price}</p>
      </div>
      <button class="btn btn-dark shop-item-button fw-bold" type="button" style="width: 100%;">Add To Bag</button>
    </div>
  `;
  
  return productBox;
}

// Extract brand from product name
// function extractBrand(productName) {
//   const brands = ['VEJA', 'Comme Des Garçons', 'Nike', 'Adidas', 'Gucci', 'Prada'];
  
//   for (const brand of brands) {
//     if (productName.toUpperCase().includes(brand.toUpperCase())) {
//       return brand;
//     }
//   }
  
//   return 'DESIGNER'; // Default brand
// }

// Initialize event listeners for product buttons
function initializeProductButtons() {
  var addToCartButtons = document.getElementsByClassName('shop-item-button');
  for (var i = 0; i < addToCartButtons.length; i++) {
    var button = addToCartButtons[i];
    // Remove existing listeners to avoid duplicates
    button.replaceWith(button.cloneNode(true));
  }
  
  // Add fresh event listeners
  addToCartButtons = document.getElementsByClassName('shop-item-button');
  for (var i = 0; i < addToCartButtons.length; i++) {
    var button = addToCartButtons[i];
    button.addEventListener('click', addToCartClicked);
    button.addEventListener('click', removeHeader);
    button.addEventListener('click', showTotal);
    button.addEventListener('click', addItemsToCart);
    button.addEventListener('click', bagFooter);
  }
}

let toastVisible = false;
function showToast(message, duration = 3000) {
  if(toastVisible) return;

  toastVisible = true;
  const toastContainer = document.querySelector('.toast-container');
  const toastEl = document.createElement('div');
  toastEl.className = 'custom-toast';
  toastEl.innerHTML = `
    <div class="toast-body-custom">${message}</div>`;
  
  // Add toast to container
  toastContainer.appendChild(toastEl);
  
  // Auto-remove after duration
  setTimeout(() => {
    toastEl.classList.add('hiding');
    setTimeout(() => {
      toastEl.remove();
      toastVisible = false;
    }, 300);
  }, duration);
}

// Override default alert() to use toast instead
// window.alert = function(message) {
//   showToast('FARFETCH', message);
// };


function ready() {
  var removeCartItemButtons = document.getElementsByClassName('btn-remove');
  for (var i = 0; i < removeCartItemButtons.length; i++) {
    var button = removeCartItemButtons[i]
    button.addEventListener('click', removeCartItem);
  }

  var quantityInputs = document.getElementsByClassName('cart-quantity-input');
  for (var i = 0; i < quantityInputs.length; i++) {
    var input = quantityInputs[i]
    input.addEventListener('change', quantityChanged)
  }

  // Initialize existing product buttons
  initializeProductButtons();

  if (document.getElementsByClassName('btn-purchase')[0]) {
    document.getElementsByClassName('btn-purchase')[0].addEventListener('click', purchaseClicked)
  }

  // Load products from backend first, then load cart
  loadProductsFromDatabase().then(() => {
    loadCartFromBackend();
  });
}

const drop = document.querySelector(".drop");
const drop2 = document.querySelector(".drop2");

if (drop) {
  drop.addEventListener('click', () => {
    
  })
}

const arrowDown = document.querySelector(".arrow-down");
const arrowUp = document.querySelector(".arrow-up");

if (arrowDown) {
  arrowDown.addEventListener('click', () => {
    drop.style.borderBottom = "none";
    drop.style.borderRadius = "5px 5px 0px 0px";
    drop2.style.borderTop = "none";
    drop2.style.borderRadius = "0px 0px 5px 5px";
    arrowUp.style.display = "block";
    arrowDown.style.display = "none";
    drop2.style.display = "block";
  })
}

if (arrowUp) {
  arrowUp.addEventListener('click', () => {
    arrowDown.style.display = "block";
    arrowUp.style.display = "none";
    drop2.style.display = "none";
    drop.style.borderBottom = "1px solid";
    drop.style.borderRadius = "5px";
  })
}

async function purchaseClicked() {
  // Check if user is logged in for checkout
  try {
    const response = await fetch('/auth/me', { credentials: 'include' });
    if (!response.ok) {
      showToast('Please log in to continue with checkout.');
      return;
    }
    
    // Redirect to checkout instead of clearing cart
    window.location.href = '/checkout.html';
    return;
  } catch (error) {
      console.error('Checkout error:', error);
      showToast('Please log in to continue with checkout.');
    return;
  }

  // Original functionality (kept as fallback)
  alert('Thank you for your purchase')

  // Clear backend cart
  await apiCall('/api/cart/clear', 'DELETE');

  var cartItems = document.getElementsByClassName('cart-items')[0]
  while (cartItems.hasChildNodes()) {
    cartItems.removeChild(cartItems.firstChild)
  }

  const item = document.getElementsByClassName('item');

  const wlheader = document.querySelector('.wlheader');
  wlheader.style.display = 'block';

  const cartTotal = document.querySelector('.cart-total');
  cartTotal.style.display = 'none';

  const bagFooter = document.querySelector('.bag-footer');
  bagFooter.style.display = 'none';

  var cartBadge = document.getElementsByClassName("cart-badge")[0];
  cartBadge.style.display = 'none';

  cartCount = 0;
  updateCartTotal()
}

var cartCount = 0;

async function removeCartItem(event) {
  var buttonClicked = event.target;
  var cartRow = buttonClicked.parentElement.parentElement.parentElement.parentElement.parentElement;

  // Get item ID for backend removal
  var itemId = cartRow.dataset.itemId;
  if (itemId) {
    await apiCall(`/api/cart/remove/${itemId}`, 'DELETE');
  }

  // Original functionality
  cartRow.remove();
  showToast('FARFETCH', 'Item removed from bag', 2000);

  const item = document.getElementsByClassName('item');
  if (item.length === 0) {
    const wlheader = document.querySelector('.wlheader');
    wlheader.style.display = 'block';
  }

  if (item.length === 0){
    const cartTotal = document.querySelector('.cart-total');
    cartTotal.style.display = 'none';
  }

  if (item.length === 0){
    const cartBadge = document.getElementsByClassName("cart-badge")[0];
    cartBadge.style.display = 'none';
  }

  if (item.length === 0){
    const bagFooter = document.querySelector('.bag-footer');
    bagFooter.style.display = 'none';
  }

  cartCount--;
  var cartBadge = document.getElementsByClassName("cart-badge")[0];
  cartBadge.textContent = cartCount;

  updateCartTotal()
}

async function quantityChanged(event) {
  var input = event.target;
  if (isNaN(input.value) || input.value <= 0) {
    input.value = 1
  }

  // Update backend
  var cartRow = input.closest('.cart-row');
  var itemId = cartRow?.dataset.itemId;
  if (itemId) {
    await apiCall(`/api/cart/update/${itemId}`, 'PUT', {
      quantity: parseInt(input.value)
    });
  }

  updateCartTotal()
}

function removeHeader(event) {
  const wlheader = document.querySelector('.wlheader');
  if (wlheader) wlheader.style.display = 'none';
  updateCartTotal()
}

function showTotal(event) {
  const cartTotal = document.querySelector('.cart-total');
  if (cartTotal) cartTotal.style.display = 'flex';
  updateCartTotal()
}

function bagFooter(event) {
  const bagFooter = document.querySelector('.bag-footer');
  if (bagFooter) bagFooter.style.display = 'flex';
  updateCartTotal()
}

function showCartElements() {
  const wlheader = document.querySelector('.wlheader');
  if (wlheader) wlheader.style.display = 'none';

  const cartTotal = document.querySelector('.cart-total');
  if (cartTotal) cartTotal.style.display = 'flex';

  const bagFooter = document.querySelector('.bag-footer');
  if (bagFooter) bagFooter.style.display = 'flex';
}

function addItemsToCart(event) {
  cartCount++;
  var cartBadge = document.getElementsByClassName("cart-badge")[0];
  if (cartBadge) {
    cartBadge.style.display = 'block';
    cartBadge.textContent = cartCount;
  }
  updateCartTotal()
}

// FIXED: Extract product ID correctly
async function addToCartClicked(event) {
  var button = event.target
  var shopItem = button.parentElement.parentElement
  var cartTag = shopItem.getElementsByClassName('shop-item-tag')[0]?.innerText || ''
  var name = shopItem.getElementsByClassName('shop-item-name')[0]?.innerText || 
             shopItem.getElementsByClassName('rec-item-details-name')[0]?.innerText || ''
  var title = shopItem.getElementsByClassName('shop-item-title')[0]?.innerText || ''
  var cartId = shopItem.getElementsByClassName('shop-item-id')[0]?.innerText || ''
  var price = shopItem.getElementsByClassName('shop-item-price')[0]?.innerText.replace('$', '') || '0'
  var imageSrc = shopItem.getElementsByClassName('shop-item-image')[0]?.src || ''

  console.log('Adding to cart:', { cartId, name, title, price, imageSrc });

  if (!cartId) {
    showToast('Product ID not found. Please refresh the page.');
    return;
  }

  // Add to backend first
  const backendResult = await apiCall('/api/cart/add', 'POST', {
    productId: cartId,
    quantity: 1,
    size: null
  });

  if (backendResult && backendResult.items) {
    // Backend success - proceed with UI update
    addItemToCart(cartTag, name, title, cartId, '$' + price, imageSrc, backendResult.items)
  } else {
    // Backend failed - show error message
    console.error('Backend result:', backendResult);
    showToast('Failed to add item to cart. Please try again.');
    return;
  }

  updateCartTotal()
}

function addItemToCart(cartTag, name, title, productId, price, imageSrc, backendItems = null) {
  var cartRow = document.createElement('div')
  cartRow.classList.add('cart-row')

  // Add item ID from backend if available
  if (backendItems) {
    const backendItem = backendItems.find(item => item.product_id === productId);
    if (backendItem) {
      cartRow.dataset.itemId = backendItem.id;
    }
  }

  var cartItems = document.getElementsByClassName('cart-items')[0]
  var cartItemNames = cartItems.getElementsByClassName('cart-item-title')
  for (var i = 0; i < cartItemNames.length; i++) {
    if (cartItemNames[i].innerText == title) {
      showToast('This item has already been added to your cart.');

      return;
    }
  }

  var cartRowContents = `
      <div class="cart-items-top item">
        <div style="margin-left: 15px;">
          <img src="./images/italy-flag.jpg" alt="italy-flag" style="height: 20px; width: 20px;">
          <span style = "margin-left: 10px;">Sending from <strong>Italy</strong></span>
        </div>
        <div class= "cart-items-top-left">
          <span class="top-span">You may have to pay import duties</span>
          <i class="bi bi-info-circle top-icon"></i>
        </div>
      </div>
      <div class="carting-box">
        <div class="carting-left item">
            <div class="cart-item">
                <img class="cart-item-image" src="${imageSrc}" width="110" height="150">
                <div class="cart-item-1">
                  <span class="cart-tag">${cartTag}</span>
                  <span class="cart-item-name">${name}</span>
                  <span class="cart-item-title">${title}</span>
                  <span class="cart-id">Farfetch ID: ${productId}</span>
                </div>
            </div>
            <div class="cart-item-2">
              <span class="cart-price">${price}</span>
            </div>
        </div>
        <div class="cart-quantity cart-column item">
          <div class="cart-column-1">
            <div class="cart-column-1a">
              <span>Size</span>
              <i class="bi bi-x btn-remove"></i>
            </div>
            <div class="cart-column-1b">
              <strong>37.5 EU</strong>
              <a href="#">Change</a>
            </div>   
          </div>
          <div class="cart-column-2">
              <span>Quantity</span>
              <div>
              <input class="cart-quantity-input" type="number" value="1">
              </div>
          </div>
          <div class="cart-column-3">
              <i class="bi bi-suit-heart"></i>
              <a href="#">Move to wishlist</a>
          </div>           
        </div>
      </div>
  `;

  cartRow.innerHTML = cartRowContents
  cartItems.append(cartRow)
  cartRow.getElementsByClassName('btn-remove')[0].addEventListener('click', removeCartItem)
  cartRow.getElementsByClassName('cart-quantity-input')[0].addEventListener('change', quantityChanged)
}

// Function to add item from backend data
function addItemToCartFromBackend(item) {
  var cartRow = document.createElement('div')
  cartRow.classList.add('cart-row')
  cartRow.dataset.itemId = item.id;

  var cartItems = document.getElementsByClassName('cart-items')[0]
  if (!cartItems) return;

  var cartRowContents = `
      <div class="cart-items-top item">
        <div style="margin-left: 15px;">
          <img src="./images/italy-flag.jpg" alt="italy-flag" style="height: 20px; width: 20px;">
          <span style = "margin-left: 10px;">Sending from <strong>Italy</strong></span>
        </div>
        <div class= "cart-items-top-left">
          <span class="top-span">You may have to pay import duties</span>
          <i class="bi bi-info-circle top-icon"></i>
        </div>
      </div>
      <div class="carting-box">
        <div class="carting-left item">
            <div class="cart-item">
                <img class="cart-item-image" src="${item.image_url}" width="110" height="150">
                <div class="cart-item-1">
                  <span class="cart-item-name">${item.name}</span>
                  <span class="cart-item-title">${item.description || item.name}</span>
                  <span class="cart-id">Farfetch ID: ${item.product_id}</span>
                </div>
            </div>
            <div class="cart-item-2">
              <span class="cart-price">$${item.price}</span>
            </div>
        </div>
        <div class="cart-quantity cart-column item">
          <div class="cart-column-1">
            <div class="cart-column-1a">
              <span>Size</span>
              <i class="bi bi-x btn-remove"></i>
            </div>
            <div class="cart-column-1b">
              <strong>${item.size || '37.5 EU'}</strong>
              <a href="#">Change</a>
            </div>   
          </div>
          <div class="cart-column-2">
              <span>Quantity</span>
              <div>
              <input class="cart-quantity-input" type="number" value="${item.quantity}">
              </div>
          </div>
          <div class="cart-column-3">
              <i class="bi bi-suit-heart"></i>
              <a href="#">Move to wishlist</a>
          </div>           
        </div>
      </div>
  `;

  cartRow.innerHTML = cartRowContents
  cartItems.append(cartRow)
  cartRow.getElementsByClassName('btn-remove')[0].addEventListener('click', removeCartItem)
  cartRow.getElementsByClassName('cart-quantity-input')[0].addEventListener('change', quantityChanged)
}

function updateCartTotal() {
  var cartItemContainer = document.getElementsByClassName('cart-items')[0];
  if (!cartItemContainer) return;

  var cartRows = cartItemContainer.getElementsByClassName('cart-row');
  total = 0
  for (var i = 0; i < cartRows.length; i++) {
    var cartRow = cartRows[i]
    var priceElement = cartRow.getElementsByClassName('cart-price')[0];
    var quantityElement = cartRow.getElementsByClassName('cart-quantity-input')[0];
    if (priceElement && quantityElement) {
      var price = parseFloat(priceElement.innerText.replace('$', ''))
      var quantity = quantityElement.value
      total = total + (price * quantity)
    }
  }
  total = Math.round(total * 100) / 100

  var subtotalElement = document.getElementsByClassName('cart-sub-total-price')[0];
  var totalElement = document.getElementsByClassName('cart-total-price')[0];

  if (subtotalElement) {
    subtotalElement.innerText = '$' + total + '.00'
  }

  totalValue = Math.round(total + 24)
  if (totalElement) {
    totalElement.innerText = 'USD ' + '$' + totalValue + '.00'
  }
}