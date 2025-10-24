const params = new URLSearchParams(window.location.search);
const userId = params.get("id");

// Load user data
fetch(`https://localhost:3000/admin/users/${userId}`, { credentials: "include" })
  .then(res => res.json())
  .then(user => {
    document.getElementById("email").value = user.email;
    document.getElementById("name").value = user.name;
    document.getElementById("role").value = user.role;
  })
  .catch(err => console.error("Error loading user:", err));

// Handle form submit
document.getElementById("editUserForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const updatedUser = {
    email: document.getElementById("email").value,
    name: document.getElementById("name").value,
    role: document.getElementById("role").value
  };

  fetch(`https://localhost:3000/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      'x-csrf-token': window.getCsrfToken()
    },
    credentials: "include",
    body: JSON.stringify(updatedUser)
  })
    .then(res => res.json())
    .then(data => {
      redirectWithToast(data.message, 'success', 'admin-users.html')
    })
    .catch(err => console.error("Error updating user:", err));
});

document.getElementById('back').addEventListener('click', () => {
  window.location.href = 'admin-users.html';
});