const toggle = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');

if (toggle && links) {
  toggle.addEventListener('click', () => {
    const opened = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(opened));
  });
}

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

 
const EMAILJS_SERVICE_ID = 'service_fzums1h';
const EMAILJS_TEMPLATE_ID = 'template_1io9v3t';
const EMAILJS_PUBLIC_KEY = 'scFTZcS0Z2a7gVn5V';
const CONTACT_RECIPIENT = 'rovatics.care@gmail.com';

const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const status = contactForm.querySelector('[data-form-status]');
  const sendButton = contactForm.querySelector('button[type="submit"]');
  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.style.color = isError ? '#ff8d8d' : '#b5e9ff';
  };
  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const name = (formData.get('name') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const message = (formData.get('message') || '').toString().trim();

    if (!name || !email || !message) {
      setStatus('Please complete all required fields.', true);
      return;
    }

    if (!validateEmail(email)) {
      setStatus('Please enter a valid email address.', true);
      return;
    }

    if (message.length < 20) {
      setStatus('Your project description should include a few more details.', true);
      return;
    }

    if (typeof emailjs === 'undefined') {
      setStatus('Email service could not load. Please try again later.', true);
      return;
    }

    const templateParams = {
      to_email: CONTACT_RECIPIENT,
      reply_to: email,
      name,
      email,
      organisation: (formData.get('organisation') || '').toString().trim() || 'Not provided',
      topic: (formData.get('topic') || '').toString().trim(),
      message
    };

    sendButton.disabled = true;
    setStatus('Sending your enquiry...');

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      contactForm.reset();
      setStatus('Your enquiry has been sent successfully.');
    } catch (error) {
      console.error('EmailJS error:', error);
      setStatus('Unable to send your enquiry. Please try again later.', true);
    } finally {
      sendButton.disabled = false;
    }
  });
}