//farfetch.js

const women = document.querySelector('.women');
const searchInput = document.querySelector('.search-input');

function changePlaceHolder1(){
    document.querySelector('.search-input').setAttribute('placeholder', 'Search womenswear');
}
function changePlaceHolder2(){
    document.querySelector('.search-input').setAttribute('placeholder', 'Search menswear');
}
function changePlaceHolder3(){
    document.querySelector('.search-input').setAttribute('placeholder', 'Search kidswear');
}

const nav = document.querySelector('.nav');

window.addEventListener('scroll', () => {
    if (window.scrollY > 0) {
        nav.style.borderBottom = '1px solid #e2e2e2';
    } else {
        nav.style.borderBottom = 'none';
    }
});

const searchBar = document.querySelector('.search-bar');

function focusModalInput() {
    searchBar.click();

    setTimeout(function () {
        searchInput.focus();
        searchInput.style.outline = '2px solid #000';      
    }, 200);

}

searchInput.addEventListener('click', () => {
    searchInput.style.outline = '2px solid #000';
})

searchBar.addEventListener('click', () => {
    women.classList.add('focused');
})

women.addEventListener('click', () => {
    women.classList.add('focused');
    men.classList.remove('focused');
    kids.classList.remove('focused');
    searchInput.style.outline = 'none';
})

const men = document.querySelector('.men');
men.addEventListener('click', () => {
    men.classList.add('focused');
    women.classList.remove('focused');
    kids.classList.remove('focused');
    searchInput.style.outline = 'none';
})

const kids = document.querySelector('.kids');
kids.addEventListener('click', () => {
    kids.classList.add('focused');
    men.classList.remove('focused');
    women.classList.remove('focused');
    searchInput.style.outline = 'none';
})

const iconPerson = document.querySelector('.icon-person');
const headerLinks1 = document.querySelector('.header-links1');
const headerLinks2 = document.querySelector('.header-links2');
const modal2 = document.querySelector('.modal2');
const content2 = document.querySelector('.content2');

function iconPersonClicked(){
    iconPerson.addEventListener('click', () => {
        headerLinks1.classList.add("clicked");
        headerLinks2.classList.remove("clicked");
        form1.classList.add("open1");
    })
}

iconPersonClicked()

headerLinks1.addEventListener('click', () => {
    headerLinks1.classList.add("clicked");
    headerLinks2.classList.remove("clicked");
    form1.classList.add("open1");
    form2.classList.remove("open2");
    content2.style.minHeight = "675px";
    modal2.style.marginTop = "40px";
})

headerLinks2.addEventListener('click', () => {
    headerLinks1.classList.remove("clicked");
    headerLinks2.classList.add("clicked");
    form1.classList.remove("open1");
    content2.style.minHeight = "720px";
    modal2.style.marginTop = "20px";
})

const form1 = document.querySelector('.form1');
const form2 = document.querySelector('.form2');

headerLinks2.addEventListener('click', () => {
    form2.classList.add("open2");
    // headerLinks2.classList.remove("clicked");
})

const header1 = document.querySelector('.header1');

function clickButtonAfterLoad() {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    header1.dispatchEvent(event);
}

window.onload = clickButtonAfterLoad;

const closeButton = document.querySelector('.close');

if (closeButton) {
  closeButton.addEventListener('click', () => {
    headerLinks1.classList.add("clicked");
    headerLinks2.classList.remove("clicked");
    form1.classList.add("open1");
    form2.classList.remove("open2");
  });
}

function validateEmail(email) {
    return emailRegex.test(email);
}

let form1a = document.getElementsByClassName('form1a');
let span = document.createElement('span');
span.textContent = 'Please enter a valid email address';


const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const emailInput = document.querySelector('.email');

emailInput.addEventListener('focus', function() {
    emailInput.style.outline = '2px solid blue';
    // span.style.display ='none';
});

let span2 = document.createElement('span');
span2.textContent = 'Please enter your email address';

emailInput.addEventListener('input', () => {
    const emailToValidate = emailInput.value;
    const isValidEmail = validateEmail(emailToValidate);

    // Hide both error messages initially
    // span.style.display = 'none';
    // span2.style.display = 'none';

    if (!isValidEmail) {
        span.style.display = 'block';
    }

    // if (emailInput.value.trim() === "") {
    //     span2.style.display = 'block';
    //     span2.style.color = 'rgb(197, 8, 8)';
    // }
});

emailInput.addEventListener('blur', () => {
    const emailToValidate = emailInput.value;
    const isValidEmail = validateEmail(emailToValidate);

    if (isValidEmail) {
        emailInput.style.outline = '1px solid black';
    } else {
        form1a[0].appendChild(span);
        // span2.style.display ='none';
        span.style.color = 'rgb(197, 8, 8)';
        emailInput.style.outline = '1px solid rgb(197, 8, 8)';
    }

    if (emailInput.value.trim() === "") {
        span.style.display ='none';
        // emailInput.style.outline = '1px solid black';
        form1a[0].appendChild(span2);
        span2.style.color = 'rgb(197, 8, 8)';
        emailInput.style.outline = '1px solid rgb(197, 8, 8)';
    }
})

const signIn = document.querySelector('.signin');
const password = document.querySelector('.password');

password.addEventListener('focus', function() {
    password.style.outline = '2px solid blue';
});

password.addEventListener('blur', function() {
    password.style.outline = '1px solid black';
});

let form2a = document.getElementsByClassName('form2a');
let span3 = document.createElement('span');
span3.textContent = 'Please enter your password';

signIn.addEventListener('click', (e) => {
    e.preventDefault()

    emailInput.addEventListener('focus', function() {
        emailInput.style.outline = '2px solid blue';
    });

    if (emailInput.value === "") {
        form1a[0].appendChild(span2);
        span2.style.color = 'rgb(197, 8, 8)';      
        emailInput.style.outline = '1px solid rgb(197, 8, 8)';
    }else {
        span2.style.display ='none';
    }

    if (password.value.trim() === "") {
        form2a[0].appendChild(span3);
        span3.style.color = 'rgb(197, 8, 8)';
        password.style.outline = '1px solid rgb(197, 8, 8)';
    }else {
        span3.style.display = 'none';
    }
});


password.addEventListener('input', () => {
    span3.style.display ='none';
})

// Hamburger Menu Functionality
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileOverlay = document.querySelector('.mobile-overlay');

if (hamburger && mobileMenu && mobileOverlay) {
    hamburger.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        
        // Change hamburger icon to X when menu is open
        const icon = hamburger.querySelector('i');
        if (mobileMenu.classList.contains('active')) {
            icon.classList.remove('bi-list');
            icon.classList.add('bi-x');
        } else {
            icon.classList.remove('bi-x');
            icon.classList.add('bi-list');
        }
    });
    
    // Close menu when overlay is clicked
    mobileOverlay.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        mobileOverlay.classList.remove('active');
        const icon = hamburger.querySelector('i');
        icon.classList.remove('bi-x');
        icon.classList.add('bi-list');
    });
    
    // Close menu when a link is clicked
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            mobileOverlay.classList.remove('active');
            const icon = hamburger.querySelector('i');
            icon.classList.remove('bi-x');
            icon.classList.add('bi-list');
        });
    });
}

// Handle mobile menu sign-in button
const mobileSignInButton = document.querySelector('.mobile-menu-button');
if (mobileSignInButton) {
    mobileSignInButton.addEventListener('click', () => {
        // Ensure sign-in form is visible and register form is hidden
        setTimeout(() => {
            headerLinks1.classList.add("clicked");
            headerLinks2.classList.remove("clicked");
            form1.classList.add("open1");
            form2.classList.remove("open2");
            content2.style.minHeight = "675px";
            modal2.style.marginTop = "40px";
        }, 100);
        
        // Close mobile menu
        mobileMenu.classList.remove('active');
        mobileOverlay.classList.remove('active');
        const icon = hamburger.querySelector('i');
        icon.classList.remove('bi-x');
        icon.classList.add('bi-list');
    });
}

// Also handle desktop person icon click
if (iconPerson) {
    iconPerson.addEventListener('click', () => {
        setTimeout(() => {
            headerLinks1.classList.add("clicked");
            headerLinks2.classList.remove("clicked");
            form1.classList.add("open1");
            form2.classList.remove("open2");
            content2.style.minHeight = "675px";
            modal2.style.marginTop = "40px";
        }, 100);
    });
}

// Mobile search icon functionality
const mobileSearchIcon = document.querySelector('.mobile-search-icon');
if (mobileSearchIcon) {
    mobileSearchIcon.addEventListener('click', () => {
        // Trigger the search modal
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) {
            searchInput.click();
        }
    });
}

// Check if user just verified their email
function checkEmailVerification() {
  const urlParams = new URLSearchParams(window.location.search);
  const verified = urlParams.get('verified');
  
  if (verified === 'true') {
    // Remove the parameter from URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Show verification success modal
    showVerificationSuccessModal();
  }
}

// Show verification success modal
function showVerificationSuccessModal() {
  // Create modal HTML
  const modalHTML = `
    <div class="modal fade show" id="verificationSuccessModal" style="display: block;" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content m-auto fw-light fs-6 border-0" style="width: 400px;">
          <div class="modal-header border-0">
            <h4 class="fw-light fs-5">Email Verified!</h4>
          </div>
          <div class="modal-body text-center">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
            <h3 class="mt-3">Success!</h3>
            <p class="mt-3">Your email has been verified. You can now log in to your account.</p>
            <button type="button" class="btn btn-dark w-100 mt-3" id="loginAfterVerification">
              Log In to Account
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show"></div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Handle login button click
  document.getElementById('loginAfterVerification').addEventListener('click', () => {
    // Remove verification modal
    const verificationModal = document.getElementById('verificationSuccessModal');
    const backdrop = document.querySelector('.modal-backdrop');
    if (verificationModal) verificationModal.remove();
    if (backdrop) backdrop.remove();
    
    // Show login modal (modal2)
    const loginModal = new bootstrap.Modal(document.querySelector('.modal2'));
    loginModal.show();
    
    // Ensure login form is displayed
    setTimeout(() => {
      headerLinks1.classList.add("clicked");
      headerLinks2.classList.remove("clicked");
      form1.classList.add("open1");
      form2.classList.remove("open2");
      content2.style.minHeight = "675px";
      modal2.style.marginTop = "40px";
    }, 100);
  });
}

// Run on page load
window.addEventListener('DOMContentLoaded', checkEmailVerification);