const urlParams = new URLSearchParams(window.location.search);
        const orderNumber = urlParams.get('order');
        if (orderNumber) {
            document.getElementById('order-number').textContent = orderNumber;
        }