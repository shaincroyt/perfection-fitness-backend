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
            const variablesTema = {
    '--bg-body': tema.bg_body,
    '--bg-sidebar': tema.bg_sidebar,
    '--bg-header': tema.bg_header,
    '--bg-card': tema.bg_card,
    '--bg-modal': tema.bg_modal,

    '--theme-text-principal': tema.text_principal,
    '--theme-text-secundario': tema.text_secundario,
    '--theme-text-sidebar': tema.text_sidebar,
    '--theme-text-header': tema.text_header,

    '--btn-primario-bg': tema.btn_primario_bg,
    '--btn-primario-text': tema.btn_primario_text,
    '--btn-secundario-bg': tema.btn_secundario_bg,
    '--btn-secundario-text': tema.btn_secundario_text,

    '--table-header-bg': tema.table_header_bg,
    '--table-border': tema.table_border,

    '--input-bg': tema.input_bg,
    '--input-border': tema.input_border,

    '--theme-success-color': tema.success_color,
    '--theme-warning-color': tema.warning_color,
    '--theme-danger-color': tema.danger_color,
    '--theme-info-color': tema.info_color
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