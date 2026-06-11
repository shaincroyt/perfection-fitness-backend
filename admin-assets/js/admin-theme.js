(function () {
    async function cargarTemaEmpresa() {
        try {
            const response = await fetch('/api/empresa/tema', {
                credentials: 'include'
            });

            if (response.status === 401) return;
            if (!response.ok) return;

            const tema = await response.json();
            window.EMPRESA_TEMA = tema;

            const prefijo = String(tema.codigo_prefijo || 'PFS')
                .replace(/\s+/g, '')
                .toUpperCase()
                .replace(/[^A-Z0-9-]/g, '') || 'PFS';
            const longitud = Math.min(Math.max(parseInt(tema.codigo_longitud, 10) || 4, 3), 8);

            document.documentElement.dataset.codigoPrefijo = prefijo;
            document.documentElement.dataset.codigoLongitud = String(longitud);

            document.querySelectorAll('[data-company-name]').forEach(el => {
                el.textContent = tema.nombre || el.textContent;
            });

            document.querySelectorAll('[data-company-logo]').forEach(img => {
                if (tema.logo_url) {
                    img.src = tema.logo_url;
                    img.style.display = '';
                }
            });

            window.dispatchEvent(new CustomEvent('empresa-theme-loaded', {
                detail: {
                    ...tema,
                    codigo_prefijo: prefijo,
                    codigo_longitud: longitud
                }
            }));

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
