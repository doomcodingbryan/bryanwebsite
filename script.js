// Wait for fonts to load before positioning the indicator
// This prevents the glitch where the indicator is positioned based on
// fallback font metrics, then jumps when the custom font loads.
document.fonts.ready.then(() => {
    const box = document.querySelector('.nav-tabs-box');
    const activeLink = document.querySelector('.nav-link.active');

    if (!box || !activeLink) return;

    // Create indicator dynamically
    const indicator = document.createElement('div');
    indicator.classList.add('nav-indicator');
    box.appendChild(indicator);

    // Position indicator over a tab
    function positionIndicator(target) {
        const boxRect = box.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const borderLeft = parseFloat(getComputedStyle(box).borderLeftWidth) || 0;

        indicator.style.left = (targetRect.left - boxRect.left - borderLeft) + 'px';
        indicator.style.width = targetRect.width + 'px';
    }

    // Position on active tab (no animation)
    positionIndicator(activeLink);

    // Reveal with transitions enabled after positioning
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            indicator.classList.add('ready');
        });
    });

    // Handle tab clicks — slide then navigate
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.classList.contains('active')) {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            const href = link.getAttribute('href');

            // Slide indicator to clicked tab
            positionIndicator(link);

            // Navigate after slide completes
            setTimeout(() => {
                window.location.href = href;
            }, 380);
        });
    });
});
