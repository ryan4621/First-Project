//checkout.js

class CheckoutManager {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.cart = null;
        this.paymentIntent = null;
        this.userProfile = null;
        this.userAddresses = [];
        this.selectedAddress = null; 
        this.init();
    }

    async init() {
        await this.loadCart();
        await this.loadUserData();
        this.setupStripe();
        this.setupEventListeners();
        this.renderOrderSummary();
    }

    async loadCart() {
        try {
            const response = await fetch(`${websiteUrl}/api/cart`, { 
                credentials: 'include' 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.cart = await response.json();
            console.log('Cart loaded:', this.cart);
            
            if (!this.cart.items || this.cart.items.length === 0) {
                redirectWithToast('Your cart is empty. Redirecting to shop.', 'info', 'shop.html')
                return;
            }
        } catch (error) {
            console.error('Load cart error:', error);
            this.displayError('Failed to load cart. Please try again.');
        }
    }

    async loadUserData() {
        try {
            // Load user profile data
            const profileResponse = await fetch(`${websiteUrl}/api/profile`, { 
                credentials: 'include' 
            });
            if (profileResponse.ok) {
                const data = await profileResponse.json();
                this.userProfile = data.user;
            }

            // Load user addresses
            await this.loadAddresses();
        } catch (error) {
            console.error('Load user data error:', error);
            this.showNoAddresses();
        }
    }

    async loadAddresses() {
        try {
            const response = await fetch(`${websiteUrl}/api/checkout/addresses`, { 
                credentials: 'include' 
            });

            if (response.ok) {
                const data = await response.json();
                this.userAddresses = data.addresses;
                this.renderAddressSelection(data.addresses);
            } else {
                this.showNoAddresses();
            }
        } catch (error) {
            console.error('Load addresses error:', error);
            this.showNoAddresses();
        } finally {
            document.getElementById('addresses-loading').style.display = 'none';
        }
    }

    renderAddressSelection(addresses) {
        const addressSelection = document.getElementById('address-selection');
        const noAddressesMessage = document.getElementById('no-addresses-message');
        const addressSelect = document.getElementById('selected-address');

        if (addresses.length === 0) {
            this.showNoAddresses();
            return;
        }

        // Hide loading and no-addresses message
        noAddressesMessage.style.display = 'none';
        addressSelection.style.display = 'block';

        // Populate address dropdown
        addressSelect.innerHTML = '<option value="">Select an address</option>';
        
        addresses.forEach(address => {
            const option = document.createElement('option');
            option.value = address.id;
            option.textContent = `${address.full_name} - ${address.street}, ${address.city}, ${address.country}${address.is_default ? ' (Default)' : ''}`;
            if (address.is_default) {
                option.selected = true;
            }
            addressSelect.appendChild(option);
        });

        // Set up address selection listener
        addressSelect.addEventListener('change', (e) => {
            this.handleAddressSelection(e.target.value);
        });

        // Pre-select default address if exists
        const defaultAddress = addresses.find(addr => addr.is_default);
        if (defaultAddress) {
            this.handleAddressSelection(defaultAddress.id);
        }
    }

    handleAddressSelection(addressId) {
        const addressPreview = document.getElementById('address-preview');
        const previewContent = document.getElementById('preview-content');

        if (!addressId) {
            addressPreview.style.display = 'none';
            this.selectedAddress = null;
            return;
        }

        const selectedAddress = this.userAddresses.find(addr => addr.id == addressId);
        if (!selectedAddress) return;

        this.selectedAddress = selectedAddress;

        // Show address preview
        previewContent.innerHTML = `
            <div><strong>${selectedAddress.full_name}</strong></div>
            ${selectedAddress.phone ? `<div>${selectedAddress.phone}</div>` : ''}
            <div>${selectedAddress.street}</div>
            <div>${selectedAddress.city}${selectedAddress.state ? ', ' + selectedAddress.state : ''} ${selectedAddress.postal_code}</div>
            <div>${selectedAddress.country}</div>
        `;
        addressPreview.style.display = 'block';

        // Populate hidden form fields
        this.populateHiddenFields(selectedAddress);
    }

    populateHiddenFields(address) {
        document.getElementById('shipping-name').value = address.full_name;
        document.getElementById('shipping-email').value = this.userProfile?.email || '';
        document.getElementById('shipping-phone').value = address.phone || '';
        document.getElementById('shipping-street').value = address.street;
        document.getElementById('shipping-city').value = address.city;
        document.getElementById('shipping-state').value = address.state || '';
        document.getElementById('shipping-postal').value = address.postal_code;
        document.getElementById('shipping-country').value = address.country;
    }

    showNoAddresses() {
        document.getElementById('addresses-loading').style.display = 'none';
        document.getElementById('address-selection').style.display = 'none';
        document.getElementById('no-addresses-message').style.display = 'block';
        document.getElementById('address-preview').style.display = 'none';
    }

    async setupStripe() {
        // Load saved payment methods
        await this.loadSavedPaymentMethods();
        
        // No need to initialize Stripe Elements since we're not collecting new cards
        this.renderPaymentMethodSelection();
    }

    async loadSavedPaymentMethods() {
        try {
            const response = await fetch(`${websiteUrl}/api/checkout/payment-methods`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.savedPaymentMethods = data.paymentMethods;
            } else {
                this.savedPaymentMethods = [];
            }
        } catch (error) {
            console.error('Failed to load saved payment methods:', error);
            this.savedPaymentMethods = [];
        } finally {
            document.getElementById('payment-methods-loading').style.display = 'none';
        }
    }

    renderPaymentMethodSelection() {
        const paymentSelection = document.getElementById('payment-method-selection');
        const noPaymentMessage = document.getElementById('no-payment-methods-message');
        const paymentSelect = document.getElementById('selected-payment-method');

        if (this.savedPaymentMethods.length === 0) {
            this.showNoPaymentMethods();
            return;
        }

        // Hide loading and no-payment message
        noPaymentMessage.style.display = 'none';
        paymentSelection.style.display = 'block';

        // Populate payment method dropdown
        paymentSelect.innerHTML = '<option value="">Select a payment method</option>';
        
        this.savedPaymentMethods.forEach(pm => {
            const option = document.createElement('option');
            option.value = pm.id;
            option.textContent = `${pm.card_brand.charAt(0).toUpperCase() + pm.card_brand.slice(1)} •••• ${pm.card_last4} - Exp ${pm.card_exp_month}/${pm.card_exp_year}${pm.is_default ? ' (Default)' : ''}`;
            if (pm.is_default) {
                option.selected = true;
            }
            paymentSelect.appendChild(option);
        });

        // Set up payment method selection listener
        paymentSelect.addEventListener('change', (e) => {
            this.handlePaymentMethodSelection(e.target.value);
        });

        // Pre-select default payment method if exists
        const defaultPayment = this.savedPaymentMethods.find(pm => pm.is_default);
        if (defaultPayment) {
            this.handlePaymentMethodSelection(defaultPayment.id);
        }
    }

    handlePaymentMethodSelection(paymentMethodId) {
        const paymentPreview = document.getElementById('payment-method-preview');
        const previewContent = document.getElementById('payment-preview-content');

        if (!paymentMethodId) {
            paymentPreview.style.display = 'none';
            this.selectedPaymentMethod = null;
            return;
        }

        const selectedPayment = this.savedPaymentMethods.find(pm => pm.id == paymentMethodId);
        if (!selectedPayment) return;

        this.selectedPaymentMethod = selectedPayment;

        // Show payment method preview
        previewContent.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 24px;">💳</div>
                <div>
                    <div style="font-weight: 600;">${selectedPayment.card_brand.charAt(0).toUpperCase() + selectedPayment.card_brand.slice(1)} •••• ${selectedPayment.card_last4}</div>
                    <div style="color: #666; font-size: 14px;">Expires ${selectedPayment.card_exp_month}/${selectedPayment.card_exp_year}</div>
                </div>
            </div>
        `;
        paymentPreview.style.display = 'block';

        // Populate hidden form field
        document.getElementById('payment-method-id').value = paymentMethodId;
    }

    showNoPaymentMethods() {
        document.getElementById('payment-methods-loading').style.display = 'none';
        document.getElementById('payment-method-selection').style.display = 'none';
        document.getElementById('no-payment-methods-message').style.display = 'block';
        document.getElementById('payment-method-preview').style.display = 'none';
    }

    setupEventListeners() {
        document.getElementById('submit-payment').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    renderOrderSummary() {
        if (!this.cart || !this.cart.items) {
            return;
        }

        const orderItemsContainer = document.getElementById('order-items');
        orderItemsContainer.innerHTML = '';

        this.cart.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'order-item';
            itemElement.innerHTML = `
                <img src="${item.image_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgODAgMTAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4MCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4='}" alt="${item.name}">
                <div class="order-item-details">
                    <h4>${item.name}</h4>
                    <p>Quantity: ${item.quantity}</p>
                    <p><strong>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</strong></p>
                </div>
            `;
            orderItemsContainer.appendChild(itemElement);
        });

        // Update totals using cart summary data
        const subtotal = this.cart.summary.subtotal || 0;
        const shipping = this.cart.summary.shipping || 0;
        const tax = subtotal * 0.08; // 8% tax
        const total = subtotal + shipping + tax;

        document.getElementById('subtotal-amount').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('shipping-amount').textContent = `$${shipping.toFixed(2)}`;
        document.getElementById('tax-amount').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('total-amount').textContent = `$${total.toFixed(2)}`;
    }

    async handleSubmit() {
        this.setLoading(true);

        try {
            // Validate that an address is selected
            if (!this.selectedAddress) {
                this.displayError('Please select a shipping address');
                this.setLoading(false);
                return;
            }

            // Validate that a payment method is selected
            if (!this.selectedPaymentMethod) {
                this.displayError('Please select a payment method');
                this.setLoading(false);
                return;
            }

            // Validate form
            const form = document.getElementById('checkout-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                this.setLoading(false);
                return;
            }

            // Prepare shipping address data
            const shippingAddress = {
                name: this.selectedAddress.full_name,
                email: this.userProfile?.email || '',
                phone: this.selectedAddress.phone || null,
                street: this.selectedAddress.street,
                city: this.selectedAddress.city,
                state: this.selectedAddress.state || null,
                postalCode: this.selectedAddress.postal_code,
                country: this.selectedAddress.country
            };

            const orderNotes = document.getElementById('order-notes').value;
            
            // Create payment intent with selected payment method
            const paymentIntentData = {
                shippingAddress,
                paymentMethodId: this.selectedPaymentMethod.id,
                saveAddress: false, // Not needed since we're using existing addresses
                orderNotes: orderNotes
            };

            const paymentResponse = await fetch(`${websiteUrl}/api/checkout/create-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': window.getCsrfToken()
                },
                credentials: 'include',
                body: JSON.stringify(paymentIntentData)
            });

            if (!paymentResponse.ok) {
                const error = await paymentResponse.json();
                throw new Error(error.message || 'Failed to create payment');
            }

            const paymentData = await paymentResponse.json();

            // Initialize Stripe with the correct publishable key
            if (!this.stripe) {
                this.stripe = Stripe(paymentData.publishableKey);
            }

            // Check if payment already succeeded on backend
            const paymentIntent = await this.stripe.retrievePaymentIntent(paymentData.clientSecret);

            if (paymentIntent.paymentIntent.status === 'succeeded') {
                // Payment already completed, confirm with backend
                const confirmResponse = await fetch(`${websiteUrl}/api/checkout/confirm`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': window.getCsrfToken()
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        paymentIntentId: paymentIntent.paymentIntent.id
                    })
                });

                if (!confirmResponse.ok) {
                    const error = await confirmResponse.json();
                    throw new Error(error.message || 'Failed to confirm payment');
                }

                const confirmData = await confirmResponse.json();
                
                this.displaySuccess('Payment successful! Redirecting...');
                setTimeout(() => {
                    window.location.href = `order-success.html?order=${confirmData.orderNumber}`;
                }, 2000);

            } else if (paymentIntent.paymentIntent.status === 'requires_confirmation') {
                // Need to confirm the payment
                const { error: confirmError, paymentIntent: confirmedPayment } = await this.stripe.confirmCardPayment(
                    paymentData.clientSecret
                );

                if (confirmError) {
                    throw new Error(confirmError.message);
                }

                if (confirmedPayment.status === 'succeeded') {
                    // Now confirm with backend
                    const confirmResponse = await fetch(`${websiteUrl}/api/checkout/confirm`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-csrf-token': window.getCsrfToken()
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            paymentIntentId: confirmedPayment.id
                        })
                    });

                    if (!confirmResponse.ok) {
                        const error = await confirmResponse.json();
                        throw new Error(error.message || 'Failed to confirm payment');
                    }

                    const confirmData = await confirmResponse.json();
                    
                    this.displaySuccess('Payment successful! Redirecting...');
                    setTimeout(() => {
                        window.location.href = `order-success.html?order=${confirmData.orderNumber}`;
                    }, 2000);
                }

            } else if (paymentIntent.paymentIntent.status === 'requires_action') {
                // Needs 3D Secure or additional authentication
                const { error: confirmError } = await this.stripe.confirmCardPayment(
                    paymentData.clientSecret,
                    {
                        return_url: window.location.origin + '/order-success.html'
                    }
                );

                if (confirmError) {
                    throw new Error(confirmError.message);
                }
            } else {
                throw new Error('Unexpected payment status: ' + paymentIntent.paymentIntent.status);
            }

        } catch (error) {
            console.error('Payment error:', error);
            this.displayError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        const submitButton = document.getElementById('submit-payment');
        const buttonText = document.getElementById('button-text');
        const spinner = document.getElementById('spinner');

        if (loading) {
            submitButton.disabled = true;
            buttonText.style.display = 'none';
            spinner.style.display = 'block';
            document.querySelector('.checkout-form').classList.add('loading');
        } else {
            submitButton.disabled = false;
            buttonText.style.display = 'block';
            spinner.style.display = 'none';
            document.querySelector('.checkout-form').classList.remove('loading');
        }
    }

    displayError(message) {
        const errorElement = document.getElementById('payment-errors');
        const cardErrors = document.getElementById('card-errors');
        
        if (message) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            if (cardErrors) cardErrors.textContent = ''; // Clear card-specific errors
        } else {
            errorElement.style.display = 'none';
        }
    }

    displaySuccess(message) {
        const successElement = document.getElementById('payment-success');
        successElement.textContent = message;
        successElement.style.display = 'block';
        
        // Clear any errors
        document.getElementById('payment-errors').style.display = 'none';
    }
}

// Initialize checkout when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CheckoutManager();
});