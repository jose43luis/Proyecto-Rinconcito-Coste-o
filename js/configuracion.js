// configuracion.js - Configuración de precios

// Variables globales
let productosData = [];

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de configuración cargada');
    await cargarYMostrarPrecios();
});

// Cargar productos y mostrar precios dinámicamente
async function cargarYMostrarPrecios() {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('Supabase no configurado.');
            mostrarMensajeError('No se pudo conectar a la base de datos');
            return;
        }

        // Cargar todos los productos
        const { data: productos, error } = await supabase
            .from('productos')
            .select('*')
            .order('nombre');

        if (error) throw error;

        productosData = productos || [];
        console.log('Productos cargados:', productosData.length);

        // Renderizar los campos de precios
        renderizarCamposPrecios(productosData);

    } catch (error) {
        console.error('Error al cargar productos:', error);
        mostrarMensajeError('Error al cargar los productos');
    }
}

// Renderizar campos de precios dinámicamente
function renderizarCamposPrecios(productos) {
    const contenedor = document.getElementById('contenedor-precios');
    
    if (!contenedor) {
        console.error('Contenedor de precios no encontrado');
        return;
    }

    if (productos.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64" style="margin: 0 auto;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <h3 style="margin-top: 1rem;">No hay productos configurados</h3>
                <p>Primero agrega productos en la sección de Inventario</p>
            </div>
        `;
        return;
    }

    // Crear grid de 3 columnas con todos los productos
    let html = '<div class="precios-grid">';
    
    productos.forEach(producto => {
        const precioActual = producto.precio_renta !== null && producto.precio_renta !== undefined ? producto.precio_renta : 0;
        
        html += `
            <div class="precio-item">
                <label for="precio-${producto.id}">${producto.nombre}</label>
                <div class="input-group">
                    <span class="input-prefix">$</span>
                    <input 
                        type="number" 
                        id="precio-${producto.id}" 
                        class="precio-input"
                        data-producto-id="${producto.id}"
                        data-producto-nombre="${producto.nombre}"
                        value="${precioActual}" 
                        min="0" 
                        step="0.01"
                        placeholder="0.00">
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    contenedor.innerHTML = html;
    
    console.log(`✅ ${productos.length} campos de precios renderizados y listos para editar`);
}

// Guardar precios
async function guardarPrecios() {
    try {
        mostrarOverlayGuardando();

        if (typeof supabase === 'undefined') {
            setTimeout(() => {
                ocultarOverlayGuardando();
                alert('Supabase no configurado. Los cambios no se guardaron.');
            }, 1000);
            return;
        }

        // Obtener todos los inputs
        const inputs = document.querySelectorAll('#contenedor-precios input[type="number"]');
        let actualizaciones = [];
        let errores = 0;

        for (const input of inputs) {
            const productoId = input.dataset.productoId;
            const precio = parseFloat(input.value) || 0;

            if (productoId) {
                const { error } = await supabase
                    .from('productos')
                    .update({ precio_renta: precio })
                    .eq('id', productoId);

                if (error) {
                    console.error(`Error al actualizar producto ${productoId}:`, error);
                    errores++;
                } else {
                    actualizaciones.push(productoId);
                }
            }
        }

        ocultarOverlayGuardando();

        if (errores === 0) {
            mostrarNotificacionExito(`${actualizaciones.length} precios actualizados correctamente`);
            console.log('Todos los precios actualizados:', actualizaciones.length);
        } else {
            alert(`Se guardaron ${actualizaciones.length} precios, pero ${errores} tuvieron errores.`);
        }

    } catch (error) {
        console.error('Error al guardar precios:', error);
        ocultarOverlayGuardando();
        alert('Error al guardar los precios. Por favor intenta de nuevo.');
    }
}

// Mostrar overlay de guardando
function mostrarOverlayGuardando() {
    const overlay = document.createElement('div');
    overlay.id = 'saving-overlay';
    overlay.className = 'saving-overlay';
    overlay.innerHTML = `
        <div class="saving-content">
            <svg class="spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
                <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-width="4" stroke="currentColor" fill="none"/>
            </svg>
            <p>Guardando precios...</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Ocultar overlay
function ocultarOverlayGuardando() {
    const overlay = document.getElementById('saving-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Mostrar notificación de éxito
function mostrarNotificacionExito(mensaje) {
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #047857;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideInRight 0.3s ease-out;
    `;
    notificacion.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span style="font-weight: 600;">${mensaje}</span>
    `;

    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}

// Mostrar mensaje de error
function mostrarMensajeError(mensaje) {
    const contenedor = document.getElementById('contenedor-precios');
    if (contenedor) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--danger-color);">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64" style="margin: 0 auto;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3 style="margin-top: 1rem;">${mensaje}</h3>
                <button class="btn btn-primary" onclick="cargarYMostrarPrecios()" style="margin-top: 1rem;">
                    Reintentar
                </button>
            </div>
        `;
    }
}
