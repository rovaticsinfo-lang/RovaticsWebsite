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

const carousel = document.querySelector('[data-hero-carousel]');
if (carousel) {
  const track = carousel.querySelector('.hero-carousel-track');
  const slides = Array.from(carousel.querySelectorAll('.hero-slide'));
  const dots = Array.from(carousel.querySelectorAll('.carousel-dot'));
  const prevButton = carousel.querySelector('[data-carousel-prev]');
  const nextButton = carousel.querySelector('[data-carousel-next]');
  let currentIndex = 0;
  let autoAdvance;

  const updateCarousel = (nextIndex) => {
    currentIndex = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    slides.forEach((slide, index) => {
      const isActive = index === currentIndex;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.inert = !isActive;
      if (!isActive) slide.querySelector('video')?.pause();
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
      dot.setAttribute('aria-selected', String(index === currentIndex));
    });
  };

  const startAutoAdvance = () => {
    clearInterval(autoAdvance);
    autoAdvance = setInterval(() => {
      updateCarousel(currentIndex + 1);
    }, 4000);
  };

  prevButton?.addEventListener('click', () => {
    updateCarousel(currentIndex - 1);
    startAutoAdvance();
  });

  nextButton?.addEventListener('click', () => {
    updateCarousel(currentIndex + 1);
    startAutoAdvance();
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      updateCarousel(Number(dot.dataset.slideIndex));
      startAutoAdvance();
    });
  });

  carousel.addEventListener('mouseenter', () => clearInterval(autoAdvance));
  carousel.addEventListener('mouseleave', startAutoAdvance);
  updateCarousel(0);
  startAutoAdvance();
}

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