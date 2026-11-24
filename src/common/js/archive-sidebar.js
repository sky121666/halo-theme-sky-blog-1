export function mountArchiveSidebar(root, signal) {
  root.querySelectorAll('.archive-toggle-btn').forEach(btn => {
      if (btn.dataset.initialized) return;
      btn.dataset.initialized = 'true';

      const setExpandedState = (btn, isExpanded) => {
          btn.setAttribute('data-expanded', isExpanded);
          btn.setAttribute('aria-expanded', isExpanded);

          if (isExpanded) {
              btn.classList.add('text-primary', 'bg-base-content/5');
              const icon = btn.querySelector('.archive-year-icon');
              if (icon) icon.classList.replace('opacity-40', 'text-primary');
              if (icon) icon.classList.remove('opacity-40');
          } else {
              btn.classList.remove('text-primary', 'bg-base-content/5');
              const icon = btn.querySelector('.archive-year-icon');
              if (icon) icon.classList.add('opacity-40');
              if (icon) icon.classList.remove('text-primary');
          }

          const chevron = btn.querySelector('.archive-chevron');
          if (isExpanded) {
              chevron.classList.add('rotate-180');
          } else {
              chevron.classList.remove('rotate-180');
          }

          const wrapper = btn.nextElementSibling;
          if (isExpanded) {
              wrapper.classList.remove('grid-rows-[0fr]');
              wrapper.classList.add('grid-rows-[1fr]');
          } else {
              wrapper.classList.remove('grid-rows-[1fr]');
              wrapper.classList.add('grid-rows-[0fr]');
          }
      };

      // Handle initial active state from DOM attributes
      if (btn.getAttribute('data-expanded') === 'true') {
          setExpandedState(btn, true);
      }

      btn.addEventListener('click', () => {
          const isExpanded = btn.getAttribute('data-expanded') === 'true';
          setExpandedState(btn, !isExpanded);
      }, { signal });

      // Expose setter for external active routing logic
      btn._setExpandedState = setExpandedState;
  });

  // Highlight active route logic
  const currentPath = window.location.pathname;
  const archiveBase = root.dataset.archivesBase?.replace(/\/$/, '') || '/archives';
  if (currentPath.startsWith(archiveBase + '/')) {
      const activeYear = currentPath.slice(archiveBase.length + 1).split('/')[0];
      if (/^\d{4}$/.test(activeYear)) {

          // Find matching year group button
          const activeBtn = root.querySelector(`.archive-toggle-btn[data-year="${activeYear}"]`);
          if (activeBtn) {
              // Collapse all first
              root.querySelectorAll('.archive-toggle-btn').forEach(btn => {
                  if (btn._setExpandedState) btn._setExpandedState(btn, false);
              });
              // Expand active
              if (activeBtn._setExpandedState) activeBtn._setExpandedState(activeBtn, true);
          }

          // Highlight exact month link
          root.querySelectorAll('.archive-month-link').forEach(link => {
              // check relative URLs matching path
              const linkPath = new URL(link.href).pathname;
              if (linkPath === currentPath) {
                  link.classList.remove('text-base-content/60', 'border-transparent');
                  link.classList.add('text-primary', 'bg-primary/5', 'font-bold', 'border-primary');
              } else {
                  link.classList.add('text-base-content/60', 'border-transparent');
                  link.classList.remove('text-primary', 'bg-primary/5', 'font-bold', 'border-primary');
              }
          });
      }
  }
}
