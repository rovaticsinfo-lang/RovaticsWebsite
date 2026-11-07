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



// ============================================
// 1. Mobile navigation menu
// ============================================

const toggle = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');

if (toggle && links) {

    toggle.addEventListener('click', () => {

        const opened = links.classList.toggle('open');

        toggle.setAttribute('aria-expanded', String(opened));

    });

}


// ============================================
// 2. Automatically update the footer year
// ============================================

document.querySelectorAll('[data-year]').forEach(el => {

    el.textContent = new Date().getFullYear();

});


// ============================================
// 3. Initialize EmailJS
// ============================================

const emailJS = window.emailjs;

if (emailJS) {

    emailJS.init({
        publicKey: 'j2knO97ZmvK7tzKmm'
    });

} else {

    console.error('EmailJS SDK failed to load.');

}


// ============================================
// 4. Contact form - Direct email sending
// ============================================

document.querySelectorAll('[data-contact-form]').forEach(form => {

    // Prevent duplicate event listeners
    if (form.dataset.emailjsBound === 'true') {
        return;
    }

    form.dataset.emailjsBound = 'true';

    // Capture the submit event before other form handlers
    form.addEventListener('submit', async (e) => {

        // Prevent page redirect or default form submission
        e.preventDefault();

        // Stop other submit handlers from running
        e.stopImmediatePropagation();

        const data = new FormData(form);

        const status = form.querySelector('[data-form-status]');
        const button = form.querySelector('button[type="submit"]');

        // Collect visitor information
        const templateParams = {

            name: data.get('name'),

            email: data.get('email'),

            organisation:
                data.get('organisation') || 'Not provided',

            topic:
                data.get('topic') || 'Physical-world automation',

            message: data.get('message')

        };

        // Store original button text
        const originalButtonText = button
            ? button.textContent
            : 'Send the problem ↗';

        try {

            // Check EmailJS availability
            if (!emailJS) {

                throw new Error('EmailJS SDK is not loaded.');

            }

            // Disable button while sending
            if (button) {

                button.disabled = true;
                button.textContent = 'Sending...';

            }

            // Display sending message
            if (status) {

                status.textContent = 'Sending your enquiry...';

            }

            // Send email directly through EmailJS
            // No Outlook, Gmail or mailto redirection

            await emailJS.send(

                'service_qserjji',

                'template_m1y2fgr',

                templateParams

            );


            // Email sent successfully
            if (status) {

                status.textContent =
                    'Your enquiry has been sent successfully!';

            }


            // Clear all form fields after successful sending
            form.reset();


        } catch (error) {

            // Display error in browser console
            console.error('Email sending failed:', error);

            // Display failure message
            if (status) {

                status.textContent =
                    'Unable to send your enquiry. Please try again later.';

            }

            // Keep visitor information so they can retry


        } finally {

            // Enable button again
            if (button) {

                button.disabled = false;

                button.textContent = originalButtonText;

            }

        }

    }, true);

});
