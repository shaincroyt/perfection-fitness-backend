(function () {
    async function cargarTemaEmpresa() {
        try {
            const response = await fetch('/api/empresa/tema', {
                credentials: 'include'
            });

            if (response.status === 401) return;
            if (!response.ok) return;

            const tema = await response.json();

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
