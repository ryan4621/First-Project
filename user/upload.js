const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadBtn = document.getElementById('uploadBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const currentPhoto = document.getElementById('currentPhoto');

let selectedFile = null;
let uploadInProgress = false;

console.log("JavaScript file loaded successfully!");

// Load current profile photo on page load
async function loadCurrentPhoto() {
    try {
        const response = await fetch('https://localhost:3000/me', { 
            credentials: 'include' 
        });
        const user = await response.json();
        
        if (user.profile_image) {
            updateCurrentPhoto(user.profile_image);
        }
    } catch (error) {
        console.error('Failed to load current photo:', error);
    }
}

// Click to upload
uploadArea.addEventListener('click', () => {
    if (!uploadInProgress) {
        fileInput.click();
    }
});

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (!uploadInProgress && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle file selection
function handleFileSelect(file) {
    hideMessages();

    // Validate file
    if (!validateFile(file)) {
        return;
    }

    selectedFile = file;
    uploadBtn.disabled = false;
    cancelBtn.style.display = 'inline-block';
}

// Validate file
function validateFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid image file (PNG, JPG, JPEG)');
        return false;
    }

    if (file.size > maxSize) {
        showError('File size must be less than 5MB');
        return false;
    }

    return true;
}

// Upload functionality
uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedFile && !uploadInProgress) {
        uploadFile();
    }
});

// Cancel functionality
cancelBtn.addEventListener('click', () => {
    resetUpload();
});

// Upload file using ImageKit
async function uploadFile() {
    if (!selectedFile) return;

    uploadInProgress = true;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    progressContainer.style.display = 'block';
    hideMessages();

    try {
        // Start progress animation
        simulateProgress();

        // Get ImageKit signature from backend
        const sigRes = await fetch("https://localhost:3000/api/upload-signature", {
            credentials: "include"
        });
        const sigData = await sigRes.json();

        // Upload to ImageKit
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("publicKey", "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=");
        formData.append("signature", sigData.signature);
        formData.append("expire", sigData.expire);
        formData.append("token", sigData.token);
        formData.append("fileName", `profile-${Date.now()}-${selectedFile.name}`);

        const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
            method: "POST",
            body: formData
        });

        const uploadData = await uploadRes.json();

        if (uploadData.url) {
            // Update user profile with new image URL
            const updateRes = await fetch("https://localhost:3000/api/update-profile-photo", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json", 
                    'x-csrf-token': window.getCsrfToken()
                },
                credentials: "include",
                body: JSON.stringify({ profile_image: uploadData.url })
            });

            if (updateRes.ok) {
                showSuccess('Profile photo uploaded successfully!');
                updateCurrentPhoto(uploadData.url);
                resetUpload();
            } else {
                const errorData = await updateRes.json();
                showError(errorData.message || 'Failed to update profile');
            }
        } else {
            showError('Image upload failed. Please try again.');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        uploadInProgress = false;
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Photo';
        progressContainer.style.display = 'none';
    }
}

// Simulate upload progress
function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) {
            progress = 100;
            clearInterval(interval);
        }
        progressFill.style.width = progress + '%';
        progressText.textContent = `Uploading... ${Math.round(progress)}%`;
    }, 200);
}

// Reset upload state
function resetUpload() {
    selectedFile = null;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Upload Photo';
    cancelBtn.style.display = 'none';
    progressContainer.style.display = 'none';
    progressFill.style.width = '0%';
    fileInput.value = '';
    hideMessages();
}

// Update current photo display
function updateCurrentPhoto(photoUrl) {
    currentPhoto.innerHTML = `<img src="${photoUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

// Show success message
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

// Hide messages
function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Load current photo when page loads
document.addEventListener('DOMContentLoaded', loadCurrentPhoto);