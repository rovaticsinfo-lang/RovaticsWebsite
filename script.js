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
  const slides = Array.from(carousel.querySelectorAll('.hero-slide'));
  const dots = Array.from(carousel.querySelectorAll('.carousel-dot'));
  const prevButton = carousel.querySelector('[data-carousel-prev]');
  const nextButton = carousel.querySelector('[data-carousel-next]');
  let currentIndex = 0;
  let autoAdvance;

  const updateCarousel = (nextIndex) => {
    currentIndex = (nextIndex + slides.length) % slides.length;

    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === currentIndex);
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

const EMAILJS_SERVICE_ID = 'service_gbvadn3';
const EMAILJS_TEMPLATE_ID = 'template_n7deo1b';
const EMAILJS_PUBLIC_KEY = 'Tf-JoCePuVdlbJZRH';
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