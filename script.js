// // 1. Mobile navigation menu
// const toggle = document.querySelector('.menu-toggle');
// const links = document.querySelector('.nav-links');

// if (toggle && links) {
//   toggle.addEventListener('click', () => {
//     const opened = links.classList.toggle('open');
//     toggle.setAttribute('aria-expanded', String(opened));
//   });
// }

// // 2. Automatically update the footer year
// document.querySelectorAll('[data-year]').forEach(el => {
//   el.textContent = new Date().getFullYear();
// });

// // 3. Contact form - Send email using EmailJS
// document.querySelectorAll('[data-contact-form]').forEach(form => {

//   form.addEventListener('submit', async (e) => {

//     e.preventDefault();

//     const data = new FormData(form);
//     const status = form.querySelector('[data-form-status]');
//     const button = form.querySelector('button[type="submit"]');

//     // Collect the information entered by the visitor
//     const templateParams = {
//       name: data.get('name'),
//       email: data.get('email'),
//       organisation: data.get('organisation') || 'Not provided',
//       topic: data.get('topic') || 'Physical-world automation',
//       message: data.get('message')
//     };

//     try {

//       // Show sending status
//       if (button) button.disabled = true;

//       if (status) {
//         status.textContent = 'Sending your enquiry...';
//       }

//       // Send the email through EmailJS
//       await emailjs.send(
//         'service_qserjji',
//         'template_m1y2fgr',
//         templateParams,
//         {
//           publicKey: 'j2knO97ZmvK7tzKmm'
//         }
//       );

//       // If email is sent successfully
//       if (status) {
//         status.textContent = 'Your enquiry has been sent successfully!';
//       }

//       // Clear the form after successful submission
//       form.reset();

//     } catch (error) {

//       // If email sending fails
//       console.error('Email sending failed:', error);

//       if (status) {
//         status.textContent =
//           'Unable to send your enquiry. Please try again later.';
//       }

//     } finally {

//       // Enable the button again
//       if (button) button.disabled = false;

//     }

//   });

// });


// ===============================
// Rovatics site script
// ===============================

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

// 3. Contact form: send directly with EmailJS (no Outlook / Gmail / mail app)
const EMAILJS_SERVICE_ID  = 'service_qserjji';
const EMAILJS_TEMPLATE_ID = 'template_m1y2fgr';
const EMAILJS_PUBLIC_KEY  = 'j2knO97ZmvK7tzKmm';

// Initialise EmailJS once (the SDK <script> tag must load before this file)
if (typeof emailjs !== 'undefined') {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

document.querySelectorAll('[data-contact-form]').forEach(form => {
  // Make sure the handler is attached only once per form
  if (form.dataset.emailBound === 'true') return;
  form.dataset.emailBound = 'true';

  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('button[type="submit"]');

  const setStatus = (text, color) => {
    if (!status) return;
    status.textContent = text;
    status.style.color = color || '';
  };

  form.addEventListener('submit', async (e) => {
    // Stop the browser from navigating or opening any mail application
    e.preventDefault();
    e.stopPropagation();

    // The EmailJS SDK must have loaded
    if (typeof emailjs === 'undefined') {
      console.error('EmailJS SDK not loaded. Check the <script> tag in contact.html.');
      setStatus('Email service could not load. Please refresh the page and try again.', '#ff6b6b');
      return;
    }

    // Collect all form details
    // (keys must match the {{variables}} in your EmailJS template)
    const data = new FormData(form);
    const templateParams = {
      name: data.get('name'),
      email: data.get('email'),
      organisation: data.get('organisation') || 'Not provided',
      topic: data.get('topic') || 'Physical-world automation',
      message: data.get('message')
    };

    try {
      if (button) button.disabled = true;
      setStatus('Sending your enquiry...', '');

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        { publicKey: EMAILJS_PUBLIC_KEY }
      );

      // Success: clear all fields and show a message
      form.reset();
      setStatus('Your enquiry has been sent successfully!', '#3ddc97');
    } catch (error) {
      console.error('EmailJS error:', error);
      setStatus('Unable to send your enquiry. Please try again later.', '#ff6b6b');
    } finally {
      if (button) button.disabled = false;
    }
  });
});