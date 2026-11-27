document.addEventListener("DOMContentLoaded", () => {

    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Scroll reveal animations
    if ("IntersectionObserver" in window) {

        const observer = new IntersectionObserver(
            (entries) => {

                entries.forEach((entry) => {

                    if (entry.isIntersecting) {

                        entry.target.classList.add("visible");

                        observer.unobserve(entry.target);
                    }

                });

            },
            {
                threshold: 0.08
            }
        );

        document.body.classList.add("reveal-ready");

        document.querySelectorAll(".reveal").forEach((section) => {
            observer.observe(section);
        });

    }

});