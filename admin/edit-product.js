const productId = new URLSearchParams(window.location.search).get("id");
const currentImage = document.getElementById("currentImage");

async function loadProduct() {
  try {
    const res = await fetch(`https://localhost:3000/admin/products/${productId}`, {
      credentials: 'include'
    });
    const product = await res.json();

    document.getElementById("product_id").value = product.product_id;
    document.getElementById("name").value = product.name;
    document.getElementById("description").value = product.description;
    document.getElementById("price").value = product.price;
    document.getElementById("stock").value = product.stock;

    if (product.image_url) {
      currentImage.src = product.image_url;
      currentImage.style.display = "block";
      document.getElementById("imageUrl").value = product.image_url;
    }
  } catch (err) {
    showToast("Failed to load product details", 'error')      
    console.error(err);
  }
}
  
loadProduct();
  
document.getElementById("editProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const description = document.getElementById("description").value;
  const price = document.getElementById("price").value;
  const stock = document.getElementById("stock").value;
  let image_url = document.getElementById("imageUrl").value;
  const submitBtn = document.getElementById("update-product-btn")

  // Store original button text
  const originalText = submitBtn.textContent;
  
  // Disable button and show loading state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating Product...';

  const imageFile = document.getElementById("productImage").files[0];
  console.log("Selected file:", document.getElementById("productImage").files[0]);
  console.log("Hidden field value:", document.getElementById("imageUrl").value);

  if (imageFile) {
    console.log("Uploading new image:", imageFile.name);
    
    try {
      submitBtn.textContent = 'Uploading Image...';

      // Get ImageKit signature from your backend
      const sigRes = await fetch("https://localhost:3000/api/upload-signature", {
        credentials: "include"
      });
      const sigData = await sigRes.json();

      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("publicKey", "public_dXrYyuRIBWgHZeg7s3EoL1xNlZQ=");
      formData.append("signature", sigData.signature);
      formData.append("expire", sigData.expire);
      formData.append("token", sigData.token);
      formData.append("fileName", `product-${Date.now()}-${imageFile.name}`);

      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData
      });

      const uploadData = await uploadRes.json();
      console.log("ImageKit upload response:", uploadData);
      if (uploadData.url) {
        image_url = uploadData.url;
      } else {
        console.error("Image upload failed:", uploadData);
        showToast("Image upload failed. Check console.", 'error')
        return;
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Image upload failed. Please try again.", 'error')
      return;
    }
  }

  submitBtn.textContent = 'Updating Product...';

  const productData = { name, description, price, stock, image_url };
  console.log("Sending updated product data:", productData);

  try {
    const res = await fetch(`https://localhost:3000/admin/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        'x-csrf-token': window.getCsrfToken()
      },
      credentials: "include",
      body: JSON.stringify(productData)
    });

    if (res.ok) {
      submitBtn.textContent = 'Product updated!';
      redirectWithToast("Product updated successfully!", 'success', 'admin-products.html')
    } else {
      const err = await res.json();
      showToast("Error updating product", 'error')
    }
  } catch (err) {
    console.error("Update flow error:", err);
    showToast("Failed to update product.", 'error')
    console.error(err);
  }
});