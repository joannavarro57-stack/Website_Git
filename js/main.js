document.querySelectorAll("#year").forEach(function (el) {
  el.textContent = new Date().getFullYear();
});

const revealElements = document.querySelectorAll(
  'main > section, main > .section, .card, .artwork-item, .event, .project-item'
);
const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;

      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 })
  : null;

revealElements.forEach(function (element) {
  element.classList.add('reveal');
  if (revealObserver) {
    revealObserver.observe(element);
  } else {
    element.classList.add('is-visible');
  }
});

const menuButtons = document.querySelectorAll('.menu-toggle');

menuButtons.forEach(function (button) {
  const nav = button.parentElement.querySelector('.nav');

  if (!nav) return;

  button.addEventListener('click', function () {
    const isOpen = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('menu-open', isOpen);
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    });
  });

  document.addEventListener('click', function (event) {
    if (!nav.classList.contains('is-open') || button.parentElement.contains(event.target)) return;

    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !nav.classList.contains('is-open')) return;

    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    button.focus();
  });
});

const lightbox = document.getElementById('art-lightbox');

if (lightbox) {
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxPrice = document.getElementById('lightbox-price');
  const closeButton = lightbox.querySelector('.lightbox-close');
  const backButton = lightbox.querySelector('.lightbox-back');
  const backdrop = lightbox.querySelector('.lightbox-backdrop');

  const closeLightbox = function () {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  };

  document.querySelectorAll('.artwork-item').forEach(function (item) {
    item.addEventListener('click', function () {
      const img = item.querySelector('img');
      const title = item.dataset.title || item.querySelector('h3')?.textContent || 'Artwork';
      const price = item.dataset.price || item.querySelector('.price')?.textContent || '$10';

      if (!img) return;

      lightboxImage.src = img.src;
      lightboxImage.alt = img.alt;
      lightboxTitle.textContent = title;
      lightboxPrice.textContent = price;
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
    });
  });

  closeButton.addEventListener('click', closeLightbox);
  backButton.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
}

const projectItems = document.querySelectorAll('.project-item');

projectItems.forEach(function (item) {
  const toggle = item.querySelector('.project-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', function () {
    const isOpen = item.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
});

const projectJumpButtons = document.querySelectorAll('.project-jump');

projectJumpButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    const targetId = button.dataset.target;
    const target = document.getElementById(targetId);

    if (!target) return;

    projectJumpButtons.forEach(function (item) {
      item.classList.toggle('is-active', item === button);
    });

    projectItems.forEach(function (item) {
      const toggle = item.querySelector('.project-toggle');
      const shouldOpen = item === target;
      item.classList.toggle('is-open', shouldOpen);
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(shouldOpen));
      }
    });

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const videoGroups = document.querySelectorAll('.hero, .contact-layout');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const prefersReducedData = navigator.connection && navigator.connection.saveData;

videoGroups.forEach(function (group) {
  const forwardVideo = group.querySelector('.hero-background-video:not(.hero-reverse-video)');
  const reverseVideo = group.querySelector('.hero-reverse-video');

  if (!forwardVideo || !reverseVideo) return;

  forwardVideo.loop = false;
  reverseVideo.loop = false;

  if (prefersReducedMotion || prefersReducedData) {
    forwardVideo.pause();
    reverseVideo.pause();
    return;
  }

  forwardVideo.addEventListener('loadedmetadata', function () {
    forwardVideo.play().catch(function () {});
  });

  forwardVideo.addEventListener('ended', function () {
    forwardVideo.pause();
    reverseVideo.currentTime = 0;
    reverseVideo.classList.add('is-active');
    reverseVideo.play().catch(function () {});
  });

  reverseVideo.addEventListener('ended', function () {
    reverseVideo.pause();
    reverseVideo.classList.remove('is-active');
    forwardVideo.currentTime = 0;
    forwardVideo.play().catch(function () {});
  });

  reverseVideo.addEventListener('loadeddata', function () {
    reverseVideo.currentTime = 0;
  });
});

const contactForm = document.getElementById('contact-form');
const mailingListForms = document.querySelectorAll('.mailing-list-form');

mailingListForms.forEach(function (mailingListForm) {
  const submitButton = mailingListForm.querySelector('button[type="submit"]');
  const statusMessage = mailingListForm.querySelector('.form-status');
  const emailInput = mailingListForm.querySelector('input[type="email"]');
  const originalLabel = submitButton ? submitButton.textContent : 'Submit';

  const resetMailingListUi = function () {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
    if (statusMessage) {
      statusMessage.classList.remove('is-error');
      statusMessage.style.opacity = '0';
      statusMessage.textContent = '';
    }
  };

  resetMailingListUi();

  window.addEventListener('pageshow', function () {
    resetMailingListUi();
  });

  if (emailInput) {
    emailInput.addEventListener('input', function () {
      resetMailingListUi();
    });
  }

  mailingListForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }

    try {
      const response = await fetch(mailingListForm.action, {
        method: 'POST',
        body: new FormData(mailingListForm),
        headers: { Accept: 'application/json' }
      });

      const result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(result.error || 'Mailing list signup failed');
      }

      mailingListForm.reset();
      if (emailInput) {
        emailInput.value = '';
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
      if (statusMessage) {
        statusMessage.classList.remove('is-error');
        statusMessage.style.opacity = '1';
        statusMessage.textContent = 'Thanks, you are on the list.';
      }
      window.setTimeout(function () {
        if (statusMessage) {
          statusMessage.style.opacity = '0';
        }
        window.setTimeout(function () {
          resetMailingListUi();
          if (emailInput) {
            emailInput.value = '';
          }
        }, 600);
      }, 2200);
    } catch (error) {
      console.error(error);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
      if (statusMessage) {
        statusMessage.classList.add('is-error');
        statusMessage.style.opacity = '1';
        statusMessage.textContent = error.message || 'We could not add you right now. Please try again.';
      }
    }
  });
});

if (contactForm) {
  contactForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const action = contactForm.getAttribute('action');
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const statusMessage = contactForm.querySelector('#contact-status');

    if (!action) {
      if (statusMessage) statusMessage.textContent = 'Please email info@reecemusic.com directly.';
      return;
    }

    const originalLabel = submitButton ? submitButton.textContent : 'Sending...';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }

    try {
      const response = await fetch(action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Form submission failed');
      }

      contactForm.reset();

      if (submitButton) {
        submitButton.textContent = 'Sent';
        window.setTimeout(function () {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }, 2200);
      }

      if (statusMessage) {
        statusMessage.classList.remove('is-error');
        statusMessage.textContent = 'Your message has been sent.';
      }
    } catch (error) {
      console.error(error);

      if (submitButton) {
        submitButton.textContent = originalLabel;
        submitButton.disabled = false;
      }

      if (statusMessage) {
        statusMessage.classList.add('is-error');
        statusMessage.textContent = 'Your message could not be sent. Please try again.';
      }
    }
  });
}
