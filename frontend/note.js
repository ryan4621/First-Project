// SDK initialization

var imagekit = new ImageKit({
    publicKey : "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=",
    urlEndpoint : "https://ik.imagekit.io/hd48hro8z",
    authenticationEndpoint : "http://www.yourserver.com/auth",
});

// URL generation
var imageURL = imagekit.url({
    path : "/default-image.jpg",
    transformation : [{
        "height" : "300",
        "width" : "400"
    }]
});

// Upload function internally uses the ImageKit.io javascript SDK
function upload(data) {
    var file = document.getElementById("file1");
    imagekit.upload({
        file : file.files[0],
        fileName : "abc1.jpg",
        tags : ["tag1"]
    }, function(err, result) {
        console.log(arguments);
        console.log(imagekit.url({
            src: result.url,
            transformation : [{ height: 300, width: 400}]
        }));
    })
}





// Initialize ImageKit SDK (add at top of your file, outside functions)
const imagekit = new ImageKit({
    publicKey: "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=",
    urlEndpoint: "https://ik.imagekit.io/hd48hro8z",
    authenticationEndpoint: "https://localhost:3000/api/upload-signature"
});

// Upload file using ImageKit
async function uploadProfileFile() {
    if (!profileSelectedFile) return;

    profileUploadInProgress = true;
    profileUploadBtn.disabled = true;
    profileUploadBtn.textContent = 'Uploading...';
    profileProgressContainer.style.display = 'block';
    hideProfileMessages();

    try {
        // Start progress animation
        simulateProfileProgress();

        // ✅ Use ImageKit SDK - handles everything automatically
        imagekit.upload({
            file: profileSelectedFile,
            fileName: `profile-${Date.now()}-${profileSelectedFile.name}`,
            useUniqueFileName: true
        }, async function(err, result) {
            if (err) {
                console.error('Upload error:', err);
                showProfileError(err.message || 'Upload failed. Please try again.');
                profileUploadInProgress = false;
                profileUploadBtn.disabled = false;
                profileUploadBtn.textContent = 'Upload Photo';
                profileProgressContainer.style.display = 'none';
                return;
            }

            if (result.url) {
                // Update user profile with new image URL
                const updateRes = await fetch("https://localhost:3000/api/update-profile-photo", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        'x-csrf-token': window.getCsrfToken()
                    },
                    credentials: "include",
                    body: JSON.stringify({ profile_image: result.url })
                });

                if (updateRes.ok) {
                    showProfileSuccess('Profile photo uploaded successfully!');
                    updateCurrentProfilePhoto(result.url);
                    
                    // Hide everything except the profile photo circle after successful upload
                    setTimeout(() => {
                        resetProfileUpload();
                    }, 2000);
                } else {
                    const errorData = await updateRes.json();
                    showProfileError(errorData.message || 'Failed to update profile');
                }
            }

            profileUploadInProgress = false;
            profileUploadBtn.disabled = false;
            profileUploadBtn.textContent = 'Upload Photo';
            profileProgressContainer.style.display = 'none';
        });
    } catch (error) {
        console.error('Upload error:', error);
        showProfileError('Network error. Please check your connection and try again.');
        profileUploadInProgress = false;
        profileUploadBtn.disabled = false;
        profileUploadBtn.textContent = 'Upload Photo';
        profileProgressContainer.style.display = 'none';
    }
}







 async function uploadProfileFile() {
        if (!profileSelectedFile) return;

        profileUploadInProgress = true;
        profileUploadBtn.disabled = true;
        profileUploadBtn.textContent = 'Uploading...';
        profileProgressContainer.style.display = 'block';
        hideProfileMessages();

        try {
            // Start progress animation
            simulateProfileProgress();

            // Get ImageKit signature from backend
            const sigRes = await fetch("https://localhost:3000/api/upload-signature", {
                credentials: "include"
            });

            if (!sigRes.ok) {
                throw new Error('Failed to get upload token');
            }

            const sigData = await sigRes.json();

            // ✅ VERIFY we have all required fields
            if (!sigData.signature || !sigData.expire || !sigData.token) {
                throw new Error('Invalid signature data received');
            }
        
            console.log("Signature data received:", sigData);
            console.log("Token type:", typeof sigData.token);
            console.log("Token value:", sigData.token);

            // Upload to ImageKit
            const formData = new FormData();
            formData.append("file", profileSelectedFile);
            formData.append("publicKey", "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=");
            formData.append("signature", sigData.signature);
            formData.append("expire", sigData.expire);
            formData.append("token", sigData.token);
            formData.append("useUniqueFileName", "true");
            formData.append("fileName", `profile-${Date.now()}-${profileSelectedFile.name}`);

            const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
                method: "POST",
                body: formData
            });

            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) {
                throw new Error(uploadData.message || 'Upload failed');
            }

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
                    showProfileSuccess('Profile photo uploaded successfully!');
                    updateCurrentProfilePhoto(uploadData.url);
                    
                    // Hide everything except the profile photo circle after successful upload
                    setTimeout(() => {
                        resetProfileUpload();
                    }, 2000);
                } else {
                    const errorData = await updateRes.json();
                    showProfileError(errorData.message || 'Failed to update profile');
                }
            } else {
                showProfileError('Image upload failed. Please try again.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showProfileError('Network error. Please check your connection and try again.');
        } finally {
            profileUploadInProgress = false;
            profileUploadBtn.disabled = false;
            profileUploadBtn.textContent = 'Upload Photo';
            profileProgressContainer.style.display = 'none';
        }
    }