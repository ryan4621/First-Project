document.addEventListener('DOMContentLoaded', function() {
    // Initialize Tawk.to widget
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    
    // Configure Tawk.to settings
    window.Tawk_API.onLoad = function(){
        console.log('Tawk.to chat widget loaded successfully');
        
        // Optional: Set visitor information if user is logged in
        setUserInfoForChat();
    };
    
    window.Tawk_API.onChatStarted = function(){
        console.log('Chat conversation started');
    };
    
    window.Tawk_API.onChatEnded = function(){
        console.log('Chat conversation ended');
    };

    // Function to set user information for chat
    async function setUserInfoForChat() {
        try {
            // Get user info from your existing authentication
            const response = await fetch(`${websiteUrl}/auth/me`, { credentials: 'include' });
            if (response.ok) {
                const userData = await response.json();
                
                // Update welcome message
                const welcomeMsg = document.getElementById('welcome-message');
                if (welcomeMsg && userData.name) {
                    welcomeMsg.textContent = `Welcome, ${userData.name}`;
                }
                // console.log(userData.name)
                // console.log(welcomeMsg)
                
                // Set visitor attributes in Tawk.to
                if (userData.name) {
                    window.Tawk_API.setAttributes({
                        'name': userData.name,
                        'email': userData.email || '',
                        'userId': userData.id || '',
                        'userType': 'Registered User'
                        }, function(error){
                        if (error) {
                            console.log('Error setting Tawk.to attributes:', error);
                        }
                    });
                }
            }
        } catch (error) {
            console.log('User not authenticated, using guest chat');
            // For guest users, you can still set some attributes
            window.Tawk_API.setAttributes({
                'userType': 'Guest User',
                'page': 'Dashboard'
            });
        }
    };

    // setUserInfoForChat();

    // Load Tawk.to script
    (function(){
        var s1 = document.createElement("script"),
            s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = 'https://embed.tawk.to/68d5a3acafde891950e94e24/1j618engj';
        s1.charset = 'UTF-8';
        s1.setAttribute('crossorigin','*');
        s0.parentNode.insertBefore(s1,s0);
    })();
}); 