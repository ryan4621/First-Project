fetch(`/admin/stats`, { credentials: "include" })
	.then((res) => res.json())
	.then((data) => {
		document.getElementById("total-users").textContent = data.total_users;
		document.getElementById("total-purchases").textContent =
			data.total_purchases;
		document.getElementById("total-orders").textContent = data.total_orders;
		document.getElementById("total-products").textContent = data.total_products;
	})
	.catch((err) => console.error("Error fetching stats:", err));
