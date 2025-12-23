// pedidos.js - Gestión de Pedidos de Mobiliario

// Funciones helper seguras para formato de fechas
function formatearFechaSegura(fecha) {
    const TZ = window.TimezoneMexico;
    if (TZ && TZ.formatearFechaLegible) {
        return TZ.formatearFechaLegible(fecha);
    }
    const fechaObj = new Date(fecha + 'T00:00:00');
    return fechaObj.toLocaleDateString('es-MX', { 
        day: 'numeric',
        month: 'long',
        year: 'numeric' 
    });
}

function formatearHoraSegura(hora) {
    const TZ = window.TimezoneMexico;
    if (TZ && TZ.formatearHoraLegible) {
        return TZ.formatearHoraLegible(hora);
    }
    return hora || 'N/A';
}

function obtenerFechaHoySegura() {
    const TZ = window.TimezoneMexico;
    if (TZ && TZ.formatearFechaInput) {
        return TZ.formatearFechaInput();
    }
    return new Date().toISOString().split('T')[0];
}

function obtenerTimestampSeguro() {
    const TZ = window.TimezoneMexico;
    if (TZ && TZ.formatearISOMexico) {
        return TZ.formatearISOMexico();
    }
    // Si no hay TZ, ajustar manualmente a México (UTC-6)
    const ahora = new Date();
    const offsetMexico = -6 * 60; // -6 horas en minutos
    const offsetActual = ahora.getTimezoneOffset();
    const diferencia = offsetActual - offsetMexico;
    const fechaMexico = new Date(ahora.getTime() - (diferencia * 60 * 1000));
    return fechaMexico.toISOString();
}

// Variables globales
let pedidosData = [];
let productosDisponibles = [];
let lugaresPopulares = [];
let itemsPedidoActual = [];
let filtroActual = 'todos';
let pedidoActualId = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Página de pedidos cargada');
    
    // Esperar a que TZ esté disponible
    if (typeof window.TimezoneMexico === 'undefined') {
        console.warn('⚠️ TimezoneMexico aún no está disponible, esperando...');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await verificarSupabase();
    await cargarDatosIniciales();
    await cargarPedidos();
});

// Verificar configuración de Supabase
async function verificarSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase no está configurado');
        mostrarErrorConexion();
        return false;
    }
    
    try {
        // Hacer una consulta simple para verificar la conexión
        const { error } = await supabase.from('productos').select('count');
        if (error) {
            console.error('❌ Error de conexión a Supabase:', error);
            mostrarErrorConexion();
            return false;
        }
        console.log('✅ Conexión a Supabase verificada');
        return true;
    } catch (error) {
        console.error('❌ Error al verificar Supabase:', error);
        mostrarErrorConexion();
        return false;
    }
}

// Mostrar error de conexión
function mostrarErrorConexion() {
    const contenedor = document.getElementById('contenedor-pedidos');
    if (contenedor) {
        contenedor.innerHTML = `
            <div class="error-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3>Error de Conexión</h3>
                <p>No se pudo conectar a la base de datos. Verifica tu configuración de Supabase.</p>
                <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
            </div>
        `;
    }
}

// Cargar datos iniciales desde Supabase
async function cargarDatosIniciales() {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase no configurado');
            return;
        }

        console.log('📦 Cargando productos...');
        // Cargar productos
        const { data: productos, error: errorProductos } = await supabase
            .from('productos')
            .select('*')
            .order('nombre');

        if (errorProductos) {
            console.error('❌ Error al cargar productos:', errorProductos);
            throw errorProductos;
        }
        
        productosDisponibles = productos || [];
        console.log(`✅ ${productosDisponibles.length} productos cargados`);

        console.log('📍 Cargando lugares...');
        // Cargar lugares populares
        const { data: lugares, error: errorLugares } = await supabase
            .from('lugares_populares')
            .select('*')
            .eq('activo', true)
            .order('orden');

        if (errorLugares) {
            console.error('❌ Error al cargar lugares:', errorLugares);
            throw errorLugares;
        }
        
        lugaresPopulares = lugares || [];
        console.log(`✅ ${lugaresPopulares.length} lugares cargados`);

        // Llenar selects
        llenarSelectProductos();
        llenarSelectLugares();

        console.log('✅ Datos iniciales cargados correctamente');
    } catch (error) {
        console.error('❌ Error al cargar datos iniciales:', error);
        alert('Error al cargar datos iniciales. Revisa la consola para más detalles.');
    }
}

// Llenar select de productos
function llenarSelectProductos() {
    const select = document.getElementById('producto-select');
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona un producto</option>';
    
    // Separar juegos y productos normales
    const juegos = productosDisponibles.filter(p => p.es_juego);
    const productos = productosDisponibles.filter(p => !p.es_juego);
    
    // Agregar juegos primero con un grupo
    if (juegos.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '🎯 Paquetes/Juegos';
        
        juegos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = `${producto.nombre} - ${formatCurrency(producto.precio_renta)}`;
            option.dataset.producto = JSON.stringify(producto);
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    }
    
    // Agregar productos individuales
    if (productos.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '📦 Productos Individuales';
        
        productos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = `${producto.nombre} - ${formatCurrency(producto.precio_renta)}`;
            option.dataset.producto = JSON.stringify(producto);
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    }
}

// Llenar select de lugares
function llenarSelectLugares() {
    const select = document.getElementById('lugar-predefinido');
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona un lugar</option>';
    lugaresPopulares.forEach(lugar => {
        const option = document.createElement('option');
        option.value = lugar.id;
        option.textContent = lugar.nombre;
        select.appendChild(option);
    });
}

// Cargar pedidos desde Supabase
async function cargarPedidos() {
    try {
        const contenedor = document.getElementById('contenedor-pedidos');
        if (!contenedor) return;

        // Mostrar loading
        contenedor.innerHTML = `
            <div class="loading">
                <svg class="spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
                    <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-width="4" stroke="currentColor" fill="none"/>
                </svg>
                <p>Cargando pedidos...</p>
            </div>
        `;

        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase no configurado');
            mostrarErrorConexion();
            return;
        }

        console.log('📋 Cargando pedidos desde Supabase...');
        
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                pedido_items (
                    *,
                    productos (nombre)
                )
            `)
            .order('fecha_evento', { ascending: true });

        if (error) {
            console.error('❌ Error al cargar pedidos:', error);
            throw error;
        }

        pedidosData = pedidos || [];
        console.log(`✅ ${pedidosData.length} pedidos cargados desde Supabase`);
        
        mostrarPedidos();
    } catch (error) {
        console.error('❌ Error al cargar pedidos:', error);
        const contenedor = document.getElementById('contenedor-pedidos');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="error-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3>Error al Cargar Pedidos</h3>
                    <p>${error.message || 'Error desconocido'}</p>
                    <button class="btn btn-primary" onclick="cargarPedidos()">Reintentar</button>
                </div>
            `;
        }
    }
}

// Mostrar pedidos filtrados
function mostrarPedidos() {
    const contenedor = document.getElementById('contenedor-pedidos');
    if (!contenedor) return;

    let pedidosFiltrados = pedidosData;

    // Aplicar filtro
    if (filtroActual !== 'todos') {
        pedidosFiltrados = pedidosData.filter(p => p.estado === filtroActual);
    }

    // Si no hay pedidos
    if (pedidosFiltrados.length === 0) {
        const mensaje = filtroActual === 'todos' 
            ? 'No hay pedidos registrados. Crea tu primer pedido usando el botón "Nuevo Pedido".'
            : `No hay pedidos en la categoría "${filtroActual}"`;
            
        contenedor.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <h3>Sin Pedidos</h3>
                <p>${mensaje}</p>
            </div>
        `;
        return;
    }

    console.log(`📊 Mostrando ${pedidosFiltrados.length} pedidos (filtro: ${filtroActual})`);

    // Agrupar por categoría de estado
    const grupos = {
        'proximo': { titulo: 'Pedidos Próximos', subtitulo: 'Pedidos pendientes de entrega', pedidos: [] },
        'entregado': { titulo: 'Pedidos Entregados', subtitulo: 'Pedidos entregados pendientes de recoger', pedidos: [] },
        'recogido': { titulo: 'Pedidos Recogidos', subtitulo: 'Pedidos completados', pedidos: [] }
    };

    pedidosFiltrados.forEach(pedido => {
        const estado = pedido.estado || 'proximo';
        if (grupos[estado]) {
            grupos[estado].pedidos.push(pedido);
        } else {
            // Si el estado no existe, agregarlo a próximos por defecto
            grupos['proximo'].pedidos.push(pedido);
        }
    });

    let html = '';
    Object.entries(grupos).forEach(([key, grupo]) => {
        if (grupo.pedidos.length > 0) {
            html += `
                <div class="section" style="margin-bottom: 2rem;">
                    <div class="section-header">
                        <div>
                            <h2 class="section-title">${grupo.titulo}</h2>
                            <p class="section-subtitle">${grupo.subtitulo} (${grupo.pedidos.length})</p>
                        </div>
                    </div>
                    <div class="pedidos-grid">
                        ${grupo.pedidos.map(pedido => crearCardPedido(pedido)).join('')}
                    </div>
                </div>
            `;
        }
    });

    contenedor.innerHTML = html;
}

// Crear card de pedido
function crearCardPedido(pedido) {
    const estado = pedido.estado || 'proximo';
    
    // Verificar si es urgente (hoy o mañana)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(pedido.fecha_evento + 'T00:00:00');
    fechaEvento.setHours(0, 0, 0, 0);
    
    const diffDias = Math.ceil((fechaEvento - hoy) / (1000 * 60 * 60 * 24));
    const esUrgente = estado === 'proximo' && (diffDias === 0 || diffDias === 1);
    
    const badgeClass = esUrgente ? 'badge-urgente' :
                       estado === 'proximo' ? 'badge-proximo' : 
                       estado === 'entregado' ? 'badge-entregado' : 
                       estado === 'recogido' ? 'badge-recogido' : 'badge-proximo';
    
    const badgeText = esUrgente ? (diffDias === 0 ? '¡HOY!' : '¡MAÑANA!') :
                      estado === 'proximo' ? 'Próximo' : 
                      estado === 'entregado' ? 'Entregado' : 
                      estado === 'recogido' ? 'Recogido' : 'Próximo';
    
    const claseCard = esUrgente ? 'pedido-card urgente' : 'pedido-card';

    const fechaFormateada = formatearFechaSegura(pedido.fecha_evento);

    // Contar items
    const totalItems = pedido.pedido_items ? pedido.pedido_items.length : 0;
    const totalPiezas = pedido.pedido_items ? 
        pedido.pedido_items.reduce((sum, item) => sum + item.cantidad, 0) : 0;

    let botones = '';
    if (estado === 'proximo') {
        botones = `
            <button class="btn btn-primary btn-sm" onclick="marcarComoEntregado('${pedido.id}')">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Marcar Entregado
            </button>
        `;
    } else if (estado === 'entregado') {
        botones = `
            <button class="btn btn-primary btn-sm" onclick="marcarComoRecogido('${pedido.id}')">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Marcar Recogido
            </button>
        `;
    }

    let infoExtra = '';
    if (pedido.entregado_por) {
        infoExtra += `
            <div class="pedido-detalle-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span>Entregado por: ${pedido.entregado_por}</span>
            </div>
        `;
    }
    if (pedido.recogido_por) {
        infoExtra += `
            <div class="pedido-detalle-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span>Recogido por: ${pedido.recogido_por}</span>
            </div>
        `;
    }

    return `
        <div class="${claseCard}">
            <div class="pedido-header">
                <div class="pedido-info">
                    <h3>${pedido.cliente_nombre}</h3>
                    <span class="pedido-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="pedido-total">${formatCurrency(pedido.total || 0)}</div>
            </div>
            <div class="pedido-detalles">
                <div class="pedido-detalle-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>${fechaFormateada} a las ${formatearHoraSegura(pedido.hora_evento)}</span>
                </div>
                <div class="pedido-detalle-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span>${pedido.lugar || 'Sin lugar especificado'}</span>
                </div>
                <div class="pedido-detalle-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                    <span>${totalItems} items (${totalPiezas} piezas)</span>
                </div>
                ${pedido.cliente_telefono ? `
                <div class="pedido-detalle-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <span>${pedido.cliente_telefono}</span>
                </div>
                ` : ''}
                ${infoExtra}
            </div>
            <div class="pedido-actions">
                ${botones}
                <button class="btn btn-secondary btn-sm" onclick="verDetallesPedido('${pedido.id}')">Ver Detalles</button>
            </div>
        </div>
    `;
}

// Filtrar pedidos
function filtrarPedidos(filtro) {
    filtroActual = filtro;
    
    // Actualizar tabs activos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filtro) {
            btn.classList.add('active');
        }
    });

    console.log('🔍 Filtrando por:', filtro);
    mostrarPedidos();
}

// Mostrar formulario de nuevo pedido
function mostrarFormularioNuevo() {
    document.getElementById('vista-lista').classList.remove('vista-activa');
    document.getElementById('vista-lista').classList.add('vista-oculta');
    document.getElementById('vista-formulario').classList.remove('vista-oculta');
    document.getElementById('vista-formulario').classList.add('vista-activa');
    
    // Limpiar formulario
    document.getElementById('form-nuevo-pedido').reset();
    itemsPedidoActual = [];
    actualizarResumen();
    actualizarListaItems();
    
    // Establecer fecha mínima (hoy)
    const inputFecha = document.getElementById('fecha-evento');
    if (inputFecha) {
        inputFecha.min = obtenerFechaHoySegura();
        inputFecha.value = obtenerFechaHoySegura();
    }
    
    console.log('📝 Formulario de nuevo pedido abierto');
}

// Cancelar formulario y volver a lista
function cancelarNuevoPedido() {
    if (itemsPedidoActual.length > 0) {
        if (!confirm('¿Estás seguro de que deseas cancelar? Se perderán los datos ingresados.')) {
            return;
        }
    }

    volverALista();
}

// Volver a la lista sin confirmación (para usar después de guardar)
function volverALista() {
    document.getElementById('vista-formulario').classList.remove('vista-activa');
    document.getElementById('vista-formulario').classList.add('vista-oculta');
    document.getElementById('vista-lista').classList.remove('vista-oculta');
    document.getElementById('vista-lista').classList.add('vista-activa');
    
    // Limpiar items
    itemsPedidoActual = [];
    
    console.log('↩️ Volviendo a la lista de pedidos');
}

// Abrir modal agregar item
function abrirModalAgregarItem() {
    const modal = document.getElementById('modal-agregar-item');
    modal.classList.add('active');
    
    // Limpiar formulario del modal
    document.getElementById('producto-select').value = '';
    document.getElementById('detalles-producto').classList.remove('detalles-visibles');
    document.getElementById('detalles-producto').classList.add('detalles-ocultos');
}

// Cerrar modal agregar item
function cerrarModalAgregarItem() {
    const modal = document.getElementById('modal-agregar-item');
    modal.classList.remove('active');
}

// Cargar detalles del producto seleccionado
async function cargarDetallesProducto() {
    const select = document.getElementById('producto-select');
    const detalles = document.getElementById('detalles-producto');
    
    if (!select.value) {
        detalles.classList.remove('detalles-visibles');
        detalles.classList.add('detalles-ocultos');
        return;
    }

    const productoData = JSON.parse(select.selectedOptions[0].dataset.producto);
    
    // Mostrar detalles
    detalles.classList.remove('detalles-ocultos');
    detalles.classList.add('detalles-visibles');

    // Resetear cantidad
    document.getElementById('cantidad-producto').value = 1;

    // Si es un juego, mostrar descripción
    if (productoData.es_juego) {
        // Ocultar selectores
        document.getElementById('selector-color').classList.add('selector-oculto');
        document.getElementById('selector-tamano').classList.add('selector-oculto');
        
        // Mostrar descripción del juego
        const descripcion = await obtenerDescripcionJuego(productoData.id);
        
        // Agregar descripción si no existe
        let descripcionDiv = document.getElementById('descripcion-juego');
        if (!descripcionDiv) {
            descripcionDiv = document.createElement('div');
            descripcionDiv.id = 'descripcion-juego';
            descripcionDiv.className = 'descripcion-juego';
            detalles.insertBefore(descripcionDiv, document.getElementById('precio-info'));
        }
        
        descripcionDiv.innerHTML = `
            <div class="juego-info">
                <h4>🎁 Este paquete incluye:</h4>
                <p>${descripcion}</p>
            </div>
        `;
        descripcionDiv.style.display = 'block';
        
        calcularSubtotal();
        return;
    } else {
        // Ocultar descripción del juego si existe
        const descripcionDiv = document.getElementById('descripcion-juego');
        if (descripcionDiv) {
            descripcionDiv.style.display = 'none';
        }
    }

    // Mostrar/ocultar selectores según el producto
    const selectorColor = document.getElementById('selector-color');
    const selectorTamano = document.getElementById('selector-tamano');

    if (productoData.tiene_colores) {
        selectorColor.classList.remove('selector-oculto');
        selectorColor.classList.add('selector-visible');
        
        // Cargar colores desde la base de datos
        if (typeof supabase !== 'undefined') {
            const { data: colores } = await supabase
                .from('producto_colores')
                .select('*')
                .eq('producto_id', productoData.id);
                
            const colorSelect = document.getElementById('color-select');
            colorSelect.innerHTML = '<option value="">Selecciona un color</option>';
            
            if (colores && colores.length > 0) {
                colores.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color.id;
                    option.textContent = `${color.color} (${color.stock_disponible} disponibles)`;
                    colorSelect.appendChild(option);
                });
            }
        }
    } else {
        selectorColor.classList.remove('selector-visible');
        selectorColor.classList.add('selector-oculto');
    }

    if (productoData.tiene_tamanos) {
        selectorTamano.classList.remove('selector-oculto');
        selectorTamano.classList.add('selector-visible');
        
        // Cargar tamaños desde la base de datos
        if (typeof supabase !== 'undefined') {
            const { data: tamanos } = await supabase
                .from('producto_tamanos')
                .select('*')
                .eq('producto_id', productoData.id);
                
            const tamanoSelect = document.getElementById('tamano-select');
            tamanoSelect.innerHTML = '<option value="">Selecciona un tamaño</option>';
            
            if (tamanos && tamanos.length > 0) {
                tamanos.forEach(tamano => {
                    const option = document.createElement('option');
                    option.value = tamano.id;
                    option.textContent = tamano.tamano;
                    option.dataset.precio = tamano.precio_renta;
                    tamanoSelect.appendChild(option);
                });
            }
        }
    } else {
        selectorTamano.classList.remove('selector-visible');
        selectorTamano.classList.add('selector-oculto');
    }

    calcularSubtotal();
}

// Calcular subtotal del item
function calcularSubtotal() {
    const select = document.getElementById('producto-select');
    if (!select.value) return;

    const productoData = JSON.parse(select.selectedOptions[0].dataset.producto);
    const cantidad = parseInt(document.getElementById('cantidad-producto').value) || 0;
    
    let precioUnitario = productoData.precio_renta;

    // Si tiene tamaños, usar el precio del tamaño seleccionado
    const tamanoSelect = document.getElementById('tamano-select');
    if (tamanoSelect.value && tamanoSelect.selectedOptions[0].dataset.precio) {
        precioUnitario = parseFloat(tamanoSelect.selectedOptions[0].dataset.precio);
    }

    const subtotal = precioUnitario * cantidad;

    document.getElementById('precio-unitario').textContent = formatCurrency(precioUnitario);
    document.getElementById('subtotal-item').textContent = formatCurrency(subtotal);
}

// Agregar item al pedido
function agregarItemAlPedido() {
    const select = document.getElementById('producto-select');
    if (!select.value) {
        alert('Por favor selecciona un producto');
        return;
    }

    const productoData = JSON.parse(select.selectedOptions[0].dataset.producto);
    const cantidad = parseInt(document.getElementById('cantidad-producto').value);
    
    if (cantidad <= 0) {
        alert('La cantidad debe ser mayor a 0');
        return;
    }

    let precioUnitario = productoData.precio_renta;
    const tamanoSelect = document.getElementById('tamano-select');
    if (tamanoSelect.value && tamanoSelect.selectedOptions[0].dataset.precio) {
        precioUnitario = parseFloat(tamanoSelect.selectedOptions[0].dataset.precio);
    }

    const item = {
        producto_id: productoData.id,
        nombre: productoData.nombre,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        subtotal: cantidad * precioUnitario
    };

    // Agregar color si aplica
    const colorSelect = document.getElementById('color-select');
    if (colorSelect.value) {
        item.color = colorSelect.options[colorSelect.selectedIndex].text;
    }

    // Agregar tamaño si aplica
    if (tamanoSelect.value) {
        item.tamano = tamanoSelect.options[tamanoSelect.selectedIndex].text;
    }

    itemsPedidoActual.push(item);
    console.log('➕ Item agregado:', item);
    
    actualizarListaItems();
    actualizarResumen();
    cerrarModalAgregarItem();
}

// Actualizar lista de items en el formulario
function actualizarListaItems() {
    const contenedor = document.getElementById('lista-items-pedido');
    
    if (itemsPedidoActual.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p>No hay items agregados. Haz clic en "Agregar Item" para comenzar.</p>
            </div>
        `;
        return;
    }

    let html = '';
    itemsPedidoActual.forEach((item, index) => {
        let detalles = `${item.cantidad} x ${formatCurrency(item.precio_unitario)}`;
        if (item.color) detalles += ` - ${item.color}`;
        if (item.tamano) detalles += ` - ${item.tamano}`;

        html += `
            <div class="item-pedido">
                <div class="item-info">
                    <div class="item-nombre">${item.nombre}</div>
                    <div class="item-detalles">${detalles}</div>
                </div>
                <div class="item-precio">
                    <div class="item-subtotal">${formatCurrency(item.subtotal)}</div>
                    <div class="item-unitario">${formatCurrency(item.precio_unitario)} c/u</div>
                </div>
                <button type="button" class="btn-eliminar-item" onclick="eliminarItemPedido(${index})" title="Eliminar item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

// Eliminar item del pedido
function eliminarItemPedido(index) {
    if (confirm('¿Estás seguro de que deseas eliminar este item?')) {
        itemsPedidoActual.splice(index, 1);
        console.log('➖ Item eliminado');
        actualizarListaItems();
        actualizarResumen();
    }
}

// Actualizar resumen del pedido
function actualizarResumen() {
    const totalItems = itemsPedidoActual.length;
    const totalPiezas = itemsPedidoActual.reduce((sum, item) => sum + item.cantidad, 0);
    const total = itemsPedidoActual.reduce((sum, item) => sum + item.subtotal, 0);

    document.getElementById('resumen-items').textContent = totalItems;
    document.getElementById('resumen-piezas').textContent = totalPiezas;
    document.getElementById('resumen-total').textContent = formatCurrency(total);
}

// Toggle anticipo
function toggleAnticipo() {
    const checkbox = document.getElementById('esta-pagado');
    const grupoAnticipo = document.getElementById('grupo-anticipo');
    const inputAnticipo = document.getElementById('anticipo');

    if (checkbox.checked) {
        grupoAnticipo.style.display = 'none';
        inputAnticipo.value = '';
    } else {
        grupoAnticipo.style.display = 'block';
    }
}

// Guardar pedido
async function guardarPedido(event) {
    event.preventDefault();

    if (itemsPedidoActual.length === 0) {
        alert('Debes agregar al menos un item al pedido');
        return;
    }

    const formData = new FormData(event.target);
    const total = itemsPedidoActual.reduce((sum, item) => sum + item.subtotal, 0);

    const lugarSelect = document.getElementById('lugar-predefinido');
    const lugarNombre = lugarSelect.value ? 
        lugarSelect.selectedOptions[0].text : 
        'Otro lugar';

    const pedido = {
        cliente_nombre: formData.get('nombre_cliente'),
        cliente_telefono: formData.get('telefono_cliente') || null,
        fecha_evento: formData.get('fecha_evento'),
        hora_evento: formData.get('hora_evento'),
        lugar: lugarNombre,
        lugar_descripcion: formData.get('direccion_completa') || null,
        comentarios: formData.get('comentarios') || null,
        total: total,
        pagado: formData.get('esta_pagado') === 'on',
        anticipo: parseFloat(formData.get('anticipo')) || 0,
        estado: 'proximo'
    };

    console.log('💾 Guardando pedido:', pedido);

    try {
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase no está configurado');
        }

        // Guardar pedido en Supabase
        const { data: pedidoData, error: pedidoError } = await supabase
            .from('pedidos')
            .insert([pedido])
            .select()
            .single();

        if (pedidoError) {
            console.error('❌ Error al guardar pedido:', pedidoError);
            throw pedidoError;
        }

        console.log('✅ Pedido guardado:', pedidoData);

        // Expandir items (incluye descomponer juegos en sus componentes)
        console.log('🎯 Expandiendo juegos...');
        const itemsExpandidos = await expandirJuegos(itemsPedidoActual);
        console.log(`✅ ${itemsExpandidos.length} items expandidos (original: ${itemsPedidoActual.length})`);

        // Preparar items para guardar
        const itemsParaGuardar = itemsExpandidos.map(item => ({
            pedido_id: pedidoData.id,
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario || 0,
            subtotal: item.subtotal || 0,
            es_componente_juego: item.es_componente_juego || false
        }));

        // Guardar todos los items (juegos + componentes)
        const { error: itemsError } = await supabase
            .from('pedido_items')
            .insert(itemsParaGuardar);

        if (itemsError) {
            console.error('❌ Error al guardar items:', itemsError);
            throw itemsError;
        }

        console.log(`✅ ${itemsParaGuardar.length} items guardados (incluyendo componentes de juegos)`);

        alert('✅ Pedido guardado exitosamente');
        await cargarPedidos();
        volverALista();
    } catch (error) {
        console.error('❌ Error al guardar pedido:', error);
        alert(`Error al guardar el pedido: ${error.message}`);
    }
}

// Marcar como entregado
async function marcarComoEntregado(pedidoId) {
    const nombreEncargado = prompt('¿Quién entregó el pedido?');
    if (!nombreEncargado) return;

    try {
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase no configurado');
        }

        const { error } = await supabase
            .from('pedidos')
            .update({ 
                estado: 'entregado',
                entregado_por: nombreEncargado,
                fecha_entrega: obtenerTimestampSeguro()
            })
            .eq('id', pedidoId);

        if (error) throw error;

        console.log('✅ Pedido marcado como entregado');
        alert('✅ Pedido marcado como entregado');
        await cargarPedidos();
    } catch (error) {
        console.error('❌ Error al actualizar pedido:', error);
        alert(`Error al actualizar el pedido: ${error.message}`);
    }
}

// Marcar como recogido
async function marcarComoRecogido(pedidoId) {
    const nombreEncargado = prompt('¿Quién recogió el pedido?');
    if (!nombreEncargado) return;

    try {
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase no configurado');
        }

        const { error } = await supabase
            .from('pedidos')
            .update({ 
                estado: 'recogido',
                recogido_por: nombreEncargado,
                fecha_recogida: obtenerTimestampSeguro()
            })
            .eq('id', pedidoId);

        if (error) throw error;

        console.log('✅ Pedido marcado como recogido');
        alert('✅ Pedido marcado como recogido');
        await cargarPedidos();
    } catch (error) {
        console.error('❌ Error al actualizar pedido:', error);
        alert(`Error al actualizar el pedido: ${error.message}`);
    }
}

// Ver detalles del pedido
function verDetallesPedido(pedidoId) {
    const pedido = pedidosData.find(p => p.id === pedidoId);
    if (!pedido) {
        alert('No se encontró el pedido');
        return;
    }

    pedidoActualId = pedidoId;

    const fechaFormateada = formatearFechaSegura(pedido.fecha_evento);

    let itemsHtml = '<p>No hay items en este pedido</p>';
    if (pedido.pedido_items && pedido.pedido_items.length > 0) {
        itemsHtml = `
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${pedido.pedido_items.map(item => `
                        <tr>
                            <td>${item.productos ? item.productos.nombre : 'Producto'}</td>
                            <td>${item.cantidad}</td>
                            <td>${formatCurrency(item.precio_unitario || 0)}</td>
                            <td>${formatCurrency(item.subtotal || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    const contenido = `
        <div class="detalle-grid">
            <div class="detalle-section">
                <h4>Información del Cliente</h4>
                <div class="detalle-item">
                    <div class="detalle-label">Nombre</div>
                    <div class="detalle-value">${pedido.cliente_nombre}</div>
                </div>
                ${pedido.cliente_telefono ? `
                <div class="detalle-item">
                    <div class="detalle-label">Teléfono</div>
                    <div class="detalle-value">${pedido.cliente_telefono}</div>
                </div>
                ` : ''}
            </div>
            <div class="detalle-section">
                <h4>Información del Evento</h4>
                <div class="detalle-item">
                    <div class="detalle-label">Fecha</div>
                    <div class="detalle-value">${fechaFormateada}</div>
                </div>
                <div class="detalle-item">
                    <div class="detalle-label">Hora</div>
                    <div class="detalle-value">${formatearHoraSegura(pedido.hora_evento)}</div>
                </div>
                <div class="detalle-item">
                    <div class="detalle-label">Lugar</div>
                    <div class="detalle-value">${pedido.lugar}</div>
                </div>
            </div>
        </div>
        
        ${pedido.lugar_descripcion ? `
        <div class="detalle-section">
            <h4>Dirección Completa</h4>
            <p>${pedido.lugar_descripcion}</p>
        </div>
        ` : ''}
        
        ${pedido.comentarios ? `
        <div class="detalle-section">
            <h4>Comentarios</h4>
            <p>${pedido.comentarios}</p>
        </div>
        ` : ''}
        
        <div class="detalle-section">
            <h4>Items del Pedido</h4>
            ${itemsHtml}
        </div>
        
        <div class="table-total">
            <div class="table-total-label">Total del Pedido</div>
            <div class="table-total-value">${formatCurrency(pedido.total || 0)}</div>
            ${!pedido.pagado && pedido.anticipo > 0 ? `
                <div class="table-total-label" style="margin-top: 0.5rem;">Anticipo: ${formatCurrency(pedido.anticipo)}</div>
            ` : ''}
            ${pedido.pagado ? `
                <div class="table-total-label" style="margin-top: 0.5rem; color: var(--success-color);">✓ Pagado</div>
            ` : ''}
        </div>
    `;

    document.getElementById('contenido-detalles-pedido').innerHTML = contenido;
    document.getElementById('modal-detalles-pedido').classList.add('active');
}

// Cerrar modal de detalles
function cerrarModalDetalles() {
    document.getElementById('modal-detalles-pedido').classList.remove('active');
    pedidoActualId = null;
}

// Generar y descargar nota
function generarYDescargarNota() {
    if (itemsPedidoActual.length === 0) {
        alert('Debes agregar items al pedido antes de generar la nota');
        return;
    }

    alert('Función de generar nota en desarrollo. El pedido se guardará sin generar PDF.');
}

// Descargar nota de un pedido existente
function descargarNotaPedido() {
    if (!pedidoActualId) {
        alert('No hay pedido seleccionado');
        return;
    }

    const pedido = pedidosData.find(p => p.id === pedidoActualId);
    if (!pedido) {
        alert('No se encontró el pedido');
        return;
    }

    try {
        generarNotaPDF(pedido);
    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar la nota: ' + error.message);
    }
}

// FUNCIÓN CORREGIDA: generarNotaPDF
// REEMPLAZAR COMPLETAMENTE la función generarNotaPDF en pedidos.js
// (busca "function generarNotaPDF(pedido) {" y reemplaza toda la función)

function generarNotaPDF(pedido) {
    // Verificar que jsPDF esté disponible
    if (typeof window.jspdf === 'undefined') {
        alert('jsPDF no está cargado. Por favor recarga la página.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configuración de colores
    const primaryColor = [12, 123, 179]; // #0c7bb3
    const darkGray = [17, 24, 39];
    const lightGray = [107, 114, 128];
    const backgroundColor = [249, 250, 251];

    // Márgenes y dimensiones
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPos = margin;

    // =====================================
    // CALCULAR NÚMERO DE PEDIDO FORMATEADO
    // =====================================
    // Obtener todos los pedidos del mes actual para calcular el número
    const fechaPedido = new Date(pedido.created_at || new Date());
    const mes = fechaPedido.getMonth() + 1; // 1-12
    const anio = fechaPedido.getFullYear();
    
    // Filtrar pedidos del mismo mes/año
    const pedidosDelMes = pedidosData.filter(p => {
        const fechaP = new Date(p.created_at || p.fecha_evento);
        return fechaP.getMonth() + 1 === mes && fechaP.getFullYear() === anio;
    });
    
    // Encontrar el índice de este pedido
    const indicePedido = pedidosDelMes.findIndex(p => p.id === pedido.id) + 1;
    const numeroPedido = indicePedido > 0 ? indicePedido : pedidosDelMes.length;
    
    // Formato: (101-12-2025) = pedido 101 de diciembre 2025
    const numeroPedidoFormateado = `${numeroPedido}-${mes.toString().padStart(2, '0')}-${anio}`;

    // =====================================
    // HEADER CON FONDO
    // =====================================
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Logo/Nombre de la empresa (blanco)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('El Rinconcito Costeño', margin, 18);

    // Subtítulo
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Renta de Mobiliario para Eventos', margin, 27);

    // Contacto en header - LÍNEA 1
    doc.setFontSize(8);
    doc.text('Tel: 954-124-2921 | 954-125-1757', margin, 35);
    
    // Dirección en header - LÍNEA 2
    doc.setFontSize(8);
    doc.text('Bajos de Chila, Colonia Las Flores', margin, 42);

    yPos = 60;

    // =====================================
    // TÍTULO DE LA NOTA
    // =====================================
    doc.setTextColor(...darkGray);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA DE PEDIDO', pageWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // =====================================
    // INFORMACIÓN DEL PEDIDO (2 columnas)
    // =====================================
    const colWidth = (pageWidth - 2 * margin) / 2;
    
    // Columna izquierda - Cliente
    doc.setFillColor(...backgroundColor);
    doc.rect(margin, yPos, colWidth - 5, 35, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INFORMACIÓN DEL CLIENTE', margin + 5, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.setFontSize(9);
    doc.text(`Nombre: ${pedido.cliente_nombre}`, margin + 5, yPos + 15);
    if (pedido.cliente_telefono) {
        doc.text(`Teléfono: ${pedido.cliente_telefono}`, margin + 5, yPos + 22);
    }
    // NÚMERO DE PEDIDO CORREGIDO
    doc.text(`Pedido #${numeroPedidoFormateado}`, margin + 5, yPos + 29);

    // Columna derecha - Evento
    doc.setFillColor(...backgroundColor);
    doc.rect(margin + colWidth + 5, yPos, colWidth - 5, 35, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INFORMACIÓN DEL EVENTO', margin + colWidth + 10, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    
    const fechaFormateada = formatearFechaSegura(pedido.fecha_evento);
    doc.text(`Fecha: ${fechaFormateada}`, margin + colWidth + 10, yPos + 15);
    doc.text(`Hora: ${formatearHoraSegura(pedido.hora_evento)}`, margin + colWidth + 10, yPos + 22);
    doc.text(`Lugar: ${pedido.lugar || 'No especificado'}`, margin + colWidth + 10, yPos + 29);

    yPos += 45;

    // Dirección completa si existe
    if (pedido.lugar_descripcion) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...lightGray);
        const direccionLines = doc.splitTextToSize(`Dirección: ${pedido.lugar_descripcion}`, pageWidth - 2 * margin);
        doc.text(direccionLines, margin, yPos);
        yPos += direccionLines.length * 4 + 5;
    }

    yPos += 5;

    // =====================================
    // TABLA DE ITEMS
    // =====================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...darkGray);
    doc.text('ITEMS DEL PEDIDO', margin, yPos);
    yPos += 8;

    // Header de tabla
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTO', margin + 3, yPos + 5.5);
    doc.text('CANT.', pageWidth - margin - 60, yPos + 5.5);
    doc.text('PRECIO UNIT.', pageWidth - margin - 45, yPos + 5.5);
    doc.text('SUBTOTAL', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
    
    yPos += 10;

    // Items
    doc.setTextColor(...darkGray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    if (pedido.pedido_items && pedido.pedido_items.length > 0) {
        pedido.pedido_items.forEach((item, index) => {
            const nombreProducto = item.productos ? item.productos.nombre : 'Producto';
            const cantidad = item.cantidad;
            const precioUnit = formatCurrency(item.precio_unitario || 0);
            const subtotal = formatCurrency(item.subtotal || 0);

            // Fila alternada
            if (index % 2 === 0) {
                doc.setFillColor(248, 249, 250);
                doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
            }

            doc.text(nombreProducto, margin + 3, yPos);
            doc.text(cantidad.toString(), pageWidth - margin - 57, yPos);
            doc.text(precioUnit, pageWidth - margin - 45, yPos);
            doc.text(subtotal, pageWidth - margin - 3, yPos, { align: 'right' });

            yPos += 7;
        });
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...lightGray);
        doc.text('No hay items en este pedido', margin + 3, yPos);
        yPos += 7;
    }

    yPos += 5;

    // =====================================
    // TOTALES Y ESTADO DE PAGO
    // =====================================
    const totalBoxY = yPos;
    
    // Determinar altura según el estado de pago
    let totalBoxHeight = 15; // Base
    if (!pedido.pagado && pedido.anticipo > 0) {
        totalBoxHeight = 25; // Con anticipo y saldo
    }
    
    // Fondo del total
    doc.setFillColor(...backgroundColor);
    doc.rect(pageWidth - margin - 70, totalBoxY, 70, totalBoxHeight, 'F');
    
    // Línea decorativa
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(2);
    doc.line(pageWidth - margin - 70, totalBoxY, pageWidth - margin, totalBoxY);

    yPos += 8;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.text('TOTAL:', pageWidth - margin - 65, yPos);
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.text(formatCurrency(pedido.total || 0), pageWidth - margin - 5, yPos, { align: 'right' });

    // ESTADO DE PAGO CORREGIDO
    if (!pedido.pagado && pedido.anticipo > 0) {
        // Caso: Dio anticipo
        yPos += 7;
        doc.setFontSize(9);
        doc.setTextColor(...lightGray);
        doc.setFont('helvetica', 'normal');
        doc.text(`Anticipo: ${formatCurrency(pedido.anticipo)}`, pageWidth - margin - 65, yPos);
        
        const saldo = pedido.total - pedido.anticipo;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkGray);
        doc.text(`Saldo: ${formatCurrency(saldo)}`, pageWidth - margin - 5, yPos, { align: 'right' });
    }

    yPos += 15;

    // Badge de estado de pago
    let estadoPago, bgColor, textColor;
    
    if (pedido.pagado) {
        // Pagado completo
        estadoPago = 'PAGADO COMPLETO';
        bgColor = [209, 250, 229]; // Verde claro
        textColor = [4, 120, 87]; // Verde oscuro
    } else if (pedido.anticipo > 0) {
        // Anticipo dado
        estadoPago = 'ANTICIPO RECIBIDO';
        bgColor = [254, 243, 199]; // Amarillo claro
        textColor = [180, 83, 9]; // Amarillo oscuro
    } else {
        // Pago pendiente
        estadoPago = 'PAGO PENDIENTE';
        bgColor = [254, 242, 242]; // Rojo claro
        textColor = [220, 38, 38]; // Rojo oscuro
    }
    
    doc.setFillColor(...bgColor);
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const estadoWidth = doc.getTextWidth(estadoPago) + 10;
    doc.rect(pageWidth - margin - estadoWidth, yPos - 5, estadoWidth, 8, 'F');
    doc.text(estadoPago, pageWidth - margin - estadoWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // =====================================
    // COMENTARIOS
    // =====================================
    if (pedido.comentarios) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.5);
        const comentariosBox = doc.splitTextToSize(pedido.comentarios, pageWidth - 2 * margin - 10);
        const boxHeight = comentariosBox.length * 5 + 10;
        
        doc.rect(margin, yPos, pageWidth - 2 * margin, boxHeight, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(180, 83, 9);
        doc.text('COMENTARIOS:', margin + 5, yPos + 6);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkGray);
        doc.setFontSize(8);
        doc.text(comentariosBox, margin + 5, yPos + 12);
        
        yPos += boxHeight + 5;
    }

    // =====================================
    // FOOTER
    // =====================================
    const footerY = pageHeight - 30;
    
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightGray);
    
    doc.text('Términos y Condiciones:', margin, footerY + 5);
    doc.setFontSize(7);
    doc.text('• El mobiliario debe ser devuelto en las mismas condiciones.', margin, footerY + 10);
    doc.text('• Cualquier daño será cobrado al cliente.', margin, footerY + 14);
    doc.text('• La fecha de devolución es al día siguiente del evento.', margin, footerY + 18);

    // Firma
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('_____________________________', pageWidth - margin - 60, footerY + 10);
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text('Firma del Cliente', pageWidth - margin - 45, footerY + 15);

    // Fecha de emisión
    const fechaEmision = new Date().toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    doc.setFontSize(7);
    doc.text(`Nota emitida el ${fechaEmision}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // =====================================
    // GUARDAR PDF
    // =====================================
    const nombreArchivo = `Nota_${numeroPedidoFormateado}_${pedido.cliente_nombre.replace(/\s+/g, '_')}.pdf`;
    doc.save(nombreArchivo);

    console.log('✅ Nota generada:', nombreArchivo);
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
