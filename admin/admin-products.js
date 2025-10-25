fetch(`${websiteUrl}/admin/products`, { credentials: "include" })
  .then(res => res.json())
  .then(data => {
    // Sort by created_at ascending (oldest first)
    data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const tbody = document.getElementById("products-table-body");
    tbody.innerHTML = ""; // Clear table before rendering

    data.forEach(product => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${product.id}</td>
        <td>${product.name}</td>
        <td>${product.description}</td>
        <td>${product.stock}</td>
        <td>$${product.price}</td>
        <td>${new Date(product.created_at).toLocaleString()}</td>
        <td>
          <a href="edit-product.html?id=${product.id}">Edit</a>
          <button onclick="deleteProduct(${product.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  })
  .catch(err => console.error("Error loading products:", err));

function redirectWithToast(message, type, delay = 3000) {
  showToast(message, type);
  setTimeout(() => {
    location.reload();
  }, delay);
}

async function deleteProduct(id) {

  const confirmed = await showConfirmation(
    'Are you sure you want to delete this product?',  
    'Delete Product',
    {
      confirmText: 'Continue',
      cancelText: 'Cancel',
      danger: true
    }
  );

  if (!confirmed) {
    return;
  }

  fetch(`${websiteUrl}/admin/products/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      'x-csrf-token': window.getCsrfToken()
    }
  })
    .then(res => res.json())
    .then(data => {
      redirectWithToast(data.message, 'success')
    })
    .catch(err => console.error("Error deleting product:", err));
}