(function () {
    async function cargarTemaEmpresa() {
        try {
            const response = await fetch('/api/empresa/tema', {
                credentials: 'include'
            });

            if (response.status === 401) return;
            if (!response.ok) return;

            const tema = await response.json();
            const root = document.documentElement;

            const variablesTema = {
                '--color-primario': tema.color_primario,
                '--color-secundario': tema.color_secundario,
                '--color-acento': tema.color_acento,

                '--theme-primary': tema.color_primario,
                '--theme-secondary': tema.color_secundario,
                '--theme-accent': tema.color_acento,

                '--theme-bg': tema.bg_body,
                '--theme-surface': tema.bg_card,
                '--theme-text': tema.text_principal,
                '--theme-muted': tema.text_secundario,
                '--theme-border': tema.table_border,
                '--theme-glow': tema.theme_glow
            };

            Object.entries(variablesTema).forEach(([variable, valor]) => {
                if (valor) {
                    root.style.setProperty(variable, valor);
                }
            });

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
