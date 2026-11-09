const toggle = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) toggle.addEventListener('click', () => {
  const opened = links.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(opened));
});
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
document.querySelectorAll('[data-contact-form]').forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const subject = encodeURIComponent('Rovatics physical-world automation enquiry: ' + (data.get('topic') || 'Physical-world automation'));
    const body = encodeURIComponent(
      'Name: ' + data.get('name') + '\\n' +
      'Email: ' + data.get('email') + '\\n' +
      'Organisation: ' + (data.get('organisation') || 'Not provided') + '\\n' +
      'Topic: ' + (data.get('topic') || 'Physical-world automation') + '\\n\\n' +
      data.get('message')
    );
    // Replace this address with the company's monitored email before launch.
    window.location.href = 'mailto:info@rovatics.com?subject=' + subject + '&body=' + body;
    const status = form.querySelector('[data-form-status]');
    if (status) status.textContent = 'Your email app should open with the message prepared. If it does not, email info@rovatics.com directly.';
  });
});
