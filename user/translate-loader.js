// translate-loader.js
(function() {
    // Initialize Google Translate
    window.googleTranslateElementInit = function() {
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,es,fr,zh-CN,hi,ar,pt,bn,ru,ja,de,ko,it,tr,vi,pl,uk,ro,nl,th',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    };
  
    // Load Google Translate script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(script);
  
    // Add hidden translate element to body
    window.addEventListener('DOMContentLoaded', function() {
      if (!document.getElementById('google_translate_element')) {
        const div = document.createElement('div');
        div.id = 'google_translate_element';
        div.style.display = 'none';
        document.body.appendChild(div);
      }
    });
  })();