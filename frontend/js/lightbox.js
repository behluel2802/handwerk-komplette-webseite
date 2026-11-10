// Lightbox für Galerien (data-gallery + dialog data-lightbox). Wird von main.js nur auf Seiten mit Galerie geladen.

// Ohne JS (oder ohne <dialog>-Support) öffnen die Links einfach das große Bild.
export function init() {
  const gallery = document.querySelector('[data-gallery]');
  const dialog = document.querySelector('[data-lightbox]');
  if (!gallery || !dialog || typeof dialog.showModal !== 'function') return;

  const links = [...gallery.querySelectorAll('a[data-full]')];
  const img = dialog.querySelector('[data-lightbox-img]');
  const caption = dialog.querySelector('[data-lightbox-caption]');
  const counter = dialog.querySelector('[data-lightbox-counter]');
  let index = 0;

  const preload = (i) => {
    new Image().src = links[(i + links.length) % links.length].dataset.full;
  };

  const show = (i) => {
    index = (i + links.length) % links.length;
    const link = links[index];
    const thumb = link.querySelector('img');
    img.src = link.dataset.full;
    img.width = Number(link.dataset.width);
    img.height = Number(link.dataset.height);
    img.alt = thumb ? thumb.alt : '';
    // Bildunterschrift aus der Kachel übernehmen: „Titel · Ort“
    const parts = [...(link.closest('li')?.querySelectorAll('.gallery__caption > *') ?? [])];
    caption.textContent = parts.map((el) => el.textContent.trim()).join(' · ');
    counter.textContent = `${index + 1} / ${links.length}`;
    preload(index + 1);
    preload(index - 1);
  };

  links.forEach((link, i) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      show(i);
      dialog.showModal();
    });
  });

  dialog.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lightbox-next]').addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());

  // Klick auf den dunklen Hintergrund schließt
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  // Pfeiltasten (Escape schließt der <dialog> von selbst)
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });

  // Wischen auf Touch-Geräten
  let startX = null;
  let startY = null;
  dialog.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    },
    { passive: true },
  );

  dialog.addEventListener('touchend', (event) => {
    if (startX === null) return;
    const dx = event.changedTouches[0].clientX - startX;
    const dy = event.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
  });

  // Fokus zurück auf die Kachel des zuletzt gezeigten Bildes
  dialog.addEventListener('close', () => links[index].focus());
}
