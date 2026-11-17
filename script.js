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

const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const status = contactForm.querySelector('[data-form-status]');
  const sendButton = contactForm.querySelector('button[type="submit"]');

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#ff8d8d' : '#b5e9ff';
  };

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  contactForm.addEventListener('submit', (event) => {
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

    const organisation = (formData.get('organisation') || '').toString().trim() || 'Not provided';
    const topic = (formData.get('topic') || '').toString().trim() || 'General inquiry';
    const subject = encodeURIComponent('Project enquiry from ' + name);
    const body = encodeURIComponent(
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'Organisation: ' + organisation + '\n' +
      'Project type: ' + topic + '\n\n' +
      'Project details:\n' + message
    );

    if (sendButton) sendButton.disabled = true;
    setStatus('Opening your mail client to send the enquiry...');

    window.location.href = 'mailto:rovatics.care@gmail.com?cc=rovatics.from.query@gmail.com&subject=' + subject + '&body=' + body;

    setTimeout(() => {
      contactForm.reset();
      if (sendButton) sendButton.disabled = false;
      setStatus('Your enquiry is ready to send. Please confirm the mail app opened successfully.');
    }, 800);
  });
}