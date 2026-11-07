// 1. Mobile navigation menu
const toggle = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');

if (toggle && links) {
  toggle.addEventListener('click', () => {
    const opened = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(opened));
  });
}

// 2. Automatically update the footer year
document.querySelectorAll('[data-year]').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// 3. Contact form - Send email using EmailJS
document.querySelectorAll('[data-contact-form]').forEach(form => {

  form.addEventListener('submit', async (e) => {

    e.preventDefault();

    const data = new FormData(form);
    const status = form.querySelector('[data-form-status]');
    const button = form.querySelector('button[type="submit"]');

    // Collect the information entered by the visitor
    const templateParams = {
      name: data.get('name'),
      email: data.get('email'),
      organisation: data.get('organisation') || 'Not provided',
      topic: data.get('topic') || 'Physical-world automation',
      message: data.get('message')
    };

    try {

      // Show sending status
      if (button) button.disabled = true;

      if (status) {
        status.textContent = 'Sending your enquiry...';
      }

      // Send the email through EmailJS
      await emailjs.send(
        'service_qserjji',
        'template_m1y2fgr',
        templateParams,
        {
          publicKey: 'j2knO97ZmvK7tzKmm'
        }
      );

      // If email is sent successfully
      if (status) {
        status.textContent = 'Your enquiry has been sent successfully!';
      }

      // Clear the form after successful submission
      form.reset();

    } catch (error) {

      // If email sending fails
      console.error('Email sending failed:', error);

      if (status) {
        status.textContent =
          'Unable to send your enquiry. Please try again later.';
      }

    } finally {

      // Enable the button again
      if (button) button.disabled = false;

    }

  });

});