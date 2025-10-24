// Auth check
document.addEventListener("DOMContentLoaded", () => {

    function redirectWithToast(message, type, targetUrl, delay = 3000) {
        showToast(message, type);
        setTimeout(() => {
            window.location.href = targetUrl;
        }, delay);
    }


    fetch("https://localhost:3000/auth/me", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
        if (!data ) {
            showToast('Request failed', "error");
        }else if(data.role !== "admin" && data.role !== "super_admin"){
            redirectWithToast('Not authorized. Redirecting to login.', 'error', '../frontend/farfetch.html')
        }
    })
    .catch(() => {
        window.location.href = "../frontend/farfetch.html";
    });

    // Image upload functionality
    const imageInput = document.getElementById('productImage');
    const imageUrlInput = document.getElementById('imageUrl');
    const uploadStatus = document.getElementById('uploadStatus');
    const submitBtn = document.getElementById('submitBtn');

    // File upload handler
    imageInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        await uploadImage(file);
    });

    async function uploadImage(file) {
        if (!file.type.startsWith('image/')) {
            showUploadStatus('Please select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showUploadStatus('File size must be less than 5MB', 'error');
            return;
        }
        
        showUploadStatus('Preparing upload...', 'loading');
        submitBtn.disabled = true;
        
        try {
            // Get signature from backend
            const sigRes = await fetch("https://localhost:3000/api/upload-signature", {
                credentials: "include"
            });
            const { signature, expire, token } = await sigRes.json();
        
            // Prepare form data for ImageKit
            const formData = new FormData();
            formData.append("file", file);
            formData.append("publicKey", "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=");
            formData.append("signature", signature);
            formData.append("expire", expire);
            formData.append("token", token);
            formData.append("fileName", `product-${Date.now()}-${file.name}`);
        
            // Upload directly to ImageKit
            const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
                method: "POST",
                body: formData
            });

            console.log({ signature, expire, token });
        
            const result = await response.json();
        
            if (result.url) {
                imageUrlInput.value = result.url;
                showUploadStatus(`Image uploaded successfully! URL: ${result.url}`, 'success');
            } else {
                showUploadStatus(result.message || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showUploadStatus('Upload failed. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    };

    function showUploadStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.className = `upload-status ${type}`;
        uploadStatus.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
            uploadStatus.style.display = 'none';
            }, 8000);
        }
    }

    // Form submission
    const form = document.getElementById('addProductForm');
    form.addEventListener('submit', async (e) => {

        e.preventDefault();
        
        const formData = new FormData(form);
        const productData = Object.fromEntries(formData.entries());
        
        delete productData.productImage; // Not needed
        
        if (!productData.name || !productData.price) {
            showToast("Please fill in all required fields", "info");
            return;
        }

        
        if (!productData.image_url) {

            const confirmed = await showConfirmation('No image provided. Do you want to create the product without an image?',  'Create Product',
                {
                    confirmText: 'Continue',
                    cancelText: 'Cancel'
                }
            );
            
            if (!confirmed) {
                return;
            }
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding Product...';
        
        try {
            const response = await fetch('https://localhost:3000/admin/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': window.getCsrfToken()
                },
                credentials: 'include',
                body: JSON.stringify(productData)
            });
        
            const result = await response.json();
            showToast(result.message, "success");

        
            if (response.ok) {
                form.reset();
                uploadStatus.style.display = 'none';
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to add product', "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Product';
        }
    });

    // Back button
    document.getElementById('backToDashboard').addEventListener('click', () => {
        window.location.href = 'admin-products.html';
    });
})