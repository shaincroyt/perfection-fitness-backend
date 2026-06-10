(function () {
    async function cargarTemaEmpresa() {
        try {
            const response = await fetch('/api/empresa/tema', {
                credentials: 'include'
            });

            if (!response.ok) return;

            const tema = await response.json();
            const root = document.documentElement;

            if (tema.color_primario) {
                root.style.setProperty('--color-primario', tema.color_primario);
            }

            if (tema.color_secundario) {
                root.style.setProperty('--color-secundario', tema.color_secundario);
            }

            if (tema.color_acento) {
                root.style.setProperty('--color-acento', tema.color_acento);
            }

            document.querySelectorAll('[data-company-name]').forEach(el => {
                el.textContent = tema.nombre || el.textContent;
            });

            document.querySelectorAll('[data-company-logo]').forEach(img => {
                if (tema.logo_url) {
                    img.src = tema.logo_url;
                    img.style.display = '';
                }
            });

        } catch (error) {
            console.warn('Tema de empresa no disponible');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarTemaEmpresa);
    } else {
        cargarTemaEmpresa();
    }
})();