// // auth-check.js

// async function checkAuthStatus() {
//   try {
//     const response = await fetch('https://localhost:3000/api/check-auth', {
//       method: 'GET',
//       credentials: 'include'
//     });

//     const data = await response.json();
//     return { 
//       isAuthenticated: data.isAuthenticated === true,
//       role: data.role || null
//     };
//   } catch {
//     return { isAuthenticated: false, role: null };
//   }
// }


// // Block logged-in users from accessing login/signup pages
// function blockAuthPagesForLoggedInUsers() {
//   checkAuthStatus().then(({ isAuthenticated, role }) => {
//     if (isAuthenticated) {
//       if (role === 'admin') {
//         window.location.replace('../admin/admin.html');
//       } else {
//         window.location.replace('../user/dashboard.html');
//       }
//     }
//   });

//   window.history.pushState(null, null, window.location.href);
//   window.addEventListener('popstate', async function () {
//     const { isAuthenticated, role } = await checkAuthStatus();
//     if (isAuthenticated) {
//       window.location.replace(
//         role === 'admin'
//           ? '../admin/admin.html'
//           : '../user/dashboard.html'
//       );
//     }
//   });
// }

// // Block logged-out users from protected pages
// function blockProtectedPagesForLoggedOutUsers() {
//   setTimeout(async () => {
//     const { isAuthenticated } = await checkAuthStatus();
//     if (!isAuthenticated) {
//       window.location.replace('../frontend/farfetch.html');
//     }
//   }, 100);

//   window.history.pushState(null, null, window.location.href);
//   window.addEventListener('popstate', async function () {
//     const { isAuthenticated } = await checkAuthStatus();
//     if (!isAuthenticated) {
//       window.location.replace('../frontend/farfetch.html');
//     }
//   });
// }