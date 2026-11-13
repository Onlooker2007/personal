// The first interaction starts a persistent reveal wave from that card's position.
document.querySelectorAll('.school-organization-cards').forEach(deck => {
  const cards = [...deck.querySelectorAll('.organization-card')];
  // Decode before revealing so the opening surface already contains its photograph.
  const photosReady = Promise.all(cards.map(card => {
    const image = card.querySelector('.organization-photo');
    return image.decode().catch(() => {});
  }));
  let started = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const attention = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .5)) return;
    attention.disconnect();
    if (!started && !reducedMotion.matches) deck.classList.add('is-inviting');
  }, { threshold: .5 });
  cards.forEach(card => attention.observe(card.querySelector('.organization-emblem')));
  reducedMotion.addEventListener('change', event => {
    if (event.matches) deck.classList.remove('is-inviting');
  });

  function reveal(card) {
    card.classList.add('is-expanded');
    card.querySelector('.organization-emblem').setAttribute('aria-expanded', 'true');
    card.querySelector('.organization-info').setAttribute('aria-hidden', 'false');
  }

  function cascade(origin) {
    if (started) return;
    started = true;
    attention.disconnect();
    deck.classList.remove('is-inviting');
    photosReady.then(() => {
      requestAnimationFrame(() => cards.forEach((card, index) => {
        const distance = Math.abs(index - origin);
        if (distance === 0) reveal(card);
        else setTimeout(() => reveal(card), distance * 300);
      }));
    });
  }

  cards.forEach((card, index) => {
    const button = card.querySelector('.organization-emblem');
    button.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') cascade(index);
    });
    button.addEventListener('focus', () => cascade(index));
    button.addEventListener('click', () => cascade(index));
  });
});
