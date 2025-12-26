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
                pedido_items!pedido_items_pedido_id_fkey (
                    id,
                    pedido_id,
                    producto_id,
                    cantidad,
                    precio_unitario,
                    subtotal,
                    es_juego,
                    es_componente_juego,
                    juego_padre_id,
                    color_cubremantel,
                    color_mono,
                    color,
                    tamano,
                    productos!pedido_items_producto_id_fkey (nombre)
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
                <button class="btn btn-danger btn-sm" onclick="eliminarPedido('${pedido.id}')" style="margin-left: auto;">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    
                </button>
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

// Obtener descripción de un juego
async function obtenerDescripcionJuego(juegoId) {
    try {
        const { data: componentes, error } = await supabase
            .from('juego_componentes')
            .select(`
                cantidad,
                productos (nombre)
            `)
            .eq('juego_id', juegoId);

        if (error || !componentes || componentes.length === 0) {
            return ''; // Retornar vacío en lugar de mensaje de error
        }

        // Formatear descripción
        const descripcion = componentes.map(comp => 
            `${comp.cantidad} ${comp.productos.nombre}`
        ).join(' + ');

        return descripcion;
    } catch (error) {
        console.error('Error al obtener descripción del juego:', error);
        return ''; // Retornar vacío en lugar de mensaje de error
    }
}

// Cargar colores disponibles para juegos (Cubremantel o Moño)
async function cargarColoresParaJuego(nombreProducto, selectId) {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase no configurado');
            return;
        }

        // Buscar el producto por nombre (ignorar mayúsculas/minúsculas y acentos)
        const { data: productos, error: errorProducto } = await supabase
            .from('productos')
            .select('id, nombre')
            .ilike('nombre', `%${nombreProducto}%`)
            .limit(1);

        if (errorProducto || !productos || productos.length === 0) {
            console.error(`❌ No se encontró el producto: ${nombreProducto}`);
            console.log('🔍 Intentando búsqueda alternativa...');
            
            // Búsqueda alternativa sin acentos
            const nombreSinAcentos = nombreProducto.replace(/ñ/g, 'n').replace(/Ñ/g, 'N');
            const { data: productosAlt, error: errorAlt } = await supabase
                .from('productos')
                .select('id, nombre')
                .or(`nombre.ilike.%${nombreProducto}%,nombre.ilike.%${nombreSinAcentos}%`)
                .limit(1);
            
            if (errorAlt || !productosAlt || productosAlt.length === 0) {
                console.error(`❌ Tampoco se encontró con búsqueda alternativa`);
                return;
            }
            
            console.log(`✅ Producto encontrado con búsqueda alternativa: "${productosAlt[0].nombre}" (ID: ${productosAlt[0].id})`);
            
            // Cargar colores para este producto
            await cargarColoresDeProducto(productosAlt[0].id, productosAlt[0].nombre, selectId);
            return;
        }

        console.log(`✅ Producto encontrado: "${productos[0].nombre}" (ID: ${productos[0].id})`);
        
        // Cargar colores para este producto
        await cargarColoresDeProducto(productos[0].id, productos[0].nombre, selectId);
        
    } catch (error) {
        console.error(`❌ Error al cargar colores para ${nombreProducto}:`, error);
    }
}

// Función auxiliar para cargar colores de un producto específico
async function cargarColoresDeProducto(productoId, nombreProducto, selectId) {
    try {
        // Cargar colores disponibles
        const { data: colores, error: errorColores } = await supabase
            .from('producto_colores')
            .select('color, stock_disponible')
            .eq('producto_id', productoId)
            .order('color');

        if (errorColores) {
            console.error(`❌ Error al cargar colores de ${nombreProducto}:`, errorColores);
            return;
        }

        // Llenar el select con los colores
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            selectElement.innerHTML = '<option value="">Selecciona un color</option>';
            
            if (colores && colores.length > 0) {
                colores.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color.color;
                    // NO mostrar stock disponible en el selector
                    option.textContent = color.color;
                    selectElement.appendChild(option);
                });
                
                console.log(`✅ ${colores.length} colores cargados para ${nombreProducto}`);
            } else {
                console.warn(`⚠️ No hay colores disponibles para ${nombreProducto}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error al cargar colores de producto:`, error);
    }
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
    
    // Hacer precio editable y llenarlo con el precio por defecto
    const precioInput = document.getElementById('precio-personalizado');
    if (precioInput) {
        precioInput.value = productoData.precio_renta;
    }

    // Si es un juego, mostrar selectores según el tipo
    if (productoData.es_juego) {
        // Ocultar descripción del juego completamente
        let descripcionDiv = document.getElementById('descripcion-juego');
        if (descripcionDiv) {
            descripcionDiv.style.display = 'none';
        }
        
        const selectorColor = document.getElementById('selector-color');
        const selectorTamano = document.getElementById('selector-tamano');
        
        // Ocultar selector de tamaño para todos los juegos
        selectorTamano.classList.add('selector-oculto');
        selectorTamano.classList.remove('selector-visible');
        
        // Determinar qué selectores mostrar según el nombre del juego
        const nombreJuego = productoData.nombre.toLowerCase();
        
        if (nombreJuego.includes('juego de tablón')) {
            // JUEGO DE TABLÓN: Solo color de cubremantel
            selectorColor.classList.remove('selector-oculto');
            selectorColor.classList.add('selector-visible');
            
            const labelColor = selectorColor.querySelector('label');
            if (labelColor) {
                labelColor.textContent = 'Color del Cubremantel';
            }
            
            // Cargar colores de Cubremantel desde la base de datos
            await cargarColoresParaJuego('Cubremantel', 'color-select');
            
        } else if (nombreJuego.includes('mesa redonda de lujo')) {
            // MESA REDONDA DE LUJO: Color de cubremantel + Color de moño
            selectorColor.classList.remove('selector-oculto');
            selectorColor.classList.add('selector-visible');
            
            const labelColor = selectorColor.querySelector('label');
            if (labelColor) {
                labelColor.textContent = 'Color del Cubremantel';
            }
            
            // Cargar colores de Cubremantel desde la base de datos
            await cargarColoresParaJuego('Cubremantel', 'color-select');
            
            // Agregar selector de color de moño (usar selector de tamaño como segundo selector)
            selectorTamano.classList.remove('selector-oculto');
            selectorTamano.classList.add('selector-visible');
            
            const labelMono = selectorTamano.querySelector('label');
            if (labelMono) {
                labelMono.textContent = 'Color del Moño';
            }
            
            // Cargar colores de Moño desde la base de datos
            await cargarColoresParaJuego('Moño', 'tamano-select');
            
        } else if (nombreJuego.includes('mesa redonda')) {
            // MESA REDONDA NORMAL: Solo color de cubremantel
            selectorColor.classList.remove('selector-oculto');
            selectorColor.classList.add('selector-visible');
            
            const labelColor = selectorColor.querySelector('label');
            if (labelColor) {
                labelColor.textContent = 'Color del Cubremantel';
            }
            
            // Cargar colores de Cubremantel desde la base de datos
            await cargarColoresParaJuego('Cubremantel', 'color-select');
            
        } else {
            // Otros juegos: ocultar selectores
            selectorColor.classList.add('selector-oculto');
            selectorColor.classList.remove('selector-visible');
        }
        
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
        
        // Restaurar label original
        const labelColor = selectorColor.querySelector('label');
        if (labelColor) {
            labelColor.textContent = 'Color';
        }
        
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

    // No mostrar selector de tamaño si:
    // 1. El nombre ya incluye tamaño (6x6, 10x15, 12 x 3, etc)
    // 2. Es un producto específico como Maya Sombra que ya tiene su tamaño
    const nombreIncluyeTamano = /\d+\s*x\s*\d+/i.test(productoData.nombre);
    const esMayaSombra = productoData.nombre.toLowerCase().includes('maya');
    
    if (productoData.tiene_tamanos && !nombreIncluyeTamano && !esMayaSombra) {
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
    
    // Usar precio personalizado si existe, si no, el precio por defecto
    const precioInput = document.getElementById('precio-personalizado');
    let precioUnitario = precioInput && precioInput.value ? 
        parseFloat(precioInput.value) : productoData.precio_renta;

    // Si tiene tamaños, usar el precio del tamaño seleccionado (solo para productos NO juego)
    const tamanoSelect = document.getElementById('tamano-select');
    if (!productoData.es_juego && tamanoSelect.value && tamanoSelect.selectedOptions[0].dataset.precio) {
        precioUnitario = parseFloat(tamanoSelect.selectedOptions[0].dataset.precio);
        if (precioInput) {
            precioInput.value = precioUnitario;
        }
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

    // Usar precio personalizado o precio por defecto
    const precioInput = document.getElementById('precio-personalizado');
    let precioUnitario = precioInput && precioInput.value ? 
        parseFloat(precioInput.value) : productoData.precio_renta;
    
    const tamanoSelect = document.getElementById('tamano-select');
    if (!productoData.es_juego && tamanoSelect.value && tamanoSelect.selectedOptions[0].dataset.precio) {
        precioUnitario = parseFloat(tamanoSelect.selectedOptions[0].dataset.precio);
    }

    const item = {
        producto_id: productoData.id,
        nombre: productoData.nombre,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        subtotal: cantidad * precioUnitario,
        es_juego: productoData.es_juego || false
    };

    // Agregar color de cubremantel para juegos
    const colorSelect = document.getElementById('color-select');
    if (productoData.es_juego && colorSelect.value) {
        // Limpiar el texto para quitar "(X disponibles)"
        let colorTexto = colorSelect.options[colorSelect.selectedIndex].text;
        colorTexto = colorTexto.replace(/\s*\(\d+\s+disponibles\)\s*/gi, '').trim();
        item.color_cubremantel = colorTexto;
    } else if (colorSelect.value) {
        // Color normal para productos no-juego - LIMPIAR también
        let colorTexto = colorSelect.options[colorSelect.selectedIndex].text;
        colorTexto = colorTexto.replace(/\s*\(\d+\s+disponibles\)\s*/gi, '').trim();
        item.color = colorTexto;
    }

    // Agregar color de moño para Mesa Redonda de Lujo (viene en tamano-select)
    const nombreJuego = productoData.nombre.toLowerCase();
    
    if (productoData.es_juego && nombreJuego.includes('mesa redonda de lujo') && tamanoSelect.value) {
        // Limpiar el texto para quitar "(X disponibles)"
        let colorMono = tamanoSelect.options[tamanoSelect.selectedIndex].text;
        colorMono = colorMono.replace(/\s*\(\d+\s+disponibles\)\s*/gi, '').trim();
        item.color_mono = colorMono;
        console.log('🎯 Mesa Redonda de Lujo - Cubremantel:', item.color_cubremantel, '- Moño:', item.color_mono);
    } else if (tamanoSelect.value && !productoData.es_juego) {
        // Tamaño normal para productos no-juego
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
        // Solo mostrar color si existe Y no incluye "disponibles"
        if (item.color && !item.color.includes('disponibles')) {
            detalles += ` - ${item.color}`;
        }
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

    // Deshabilitar botón para evitar múltiples clics
    const btnGuardar = event.target.querySelector('button[type="submit"]');
    if (btnGuardar) {
        if (btnGuardar.disabled) {
            console.log('⚠️ Botón ya deshabilitado, evitando duplicado');
            return; // Ya se está procesando
        }
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `
            <svg class="spinner" style="width: 18px; height: 18px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-width="4" stroke="currentColor" fill="none"/>
            </svg>
            Guardando...
        `;
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

        // PASO 2: Preparar items - Guardar juegos SIN expandir + componentes para inventario
        const itemsParaGuardar = [];

        for (const item of itemsPedidoActual) {
            const producto = productosDisponibles.find(p => p.id === item.producto_id);
            
            if (producto && producto.es_juego) {
                // Es un juego - Guardarlo CON su precio
                itemsParaGuardar.push({
                    pedido_id: pedidoData.id,
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal,
                    es_juego: true,
                    color_cubremantel: item.color_cubremantel || null,
                    color_mono: item.color_mono || null,
                    es_componente_juego: false
                });
                
                console.log(`🎯 Juego guardado: ${item.nombre} - ${formatCurrency(item.subtotal)}`);
                
                // Buscar componentes para deducir inventario
                const { data: componentes, error } = await supabase
                    .from('juego_componentes')
                    .select('producto_id, cantidad')
                    .eq('juego_id', item.producto_id);

                if (componentes && componentes.length > 0) {
                    // Guardar componentes con precio $0 para inventario
                    for (const componente of componentes) {
                        const productoCom = productosDisponibles.find(p => p.id === componente.producto_id);
                        if (productoCom) {
                            const itemComponente = {
                                pedido_id: pedidoData.id,
                                producto_id: componente.producto_id,
                                cantidad: componente.cantidad * item.cantidad,
                                precio_unitario: 0,
                                subtotal: 0,
                                es_componente_juego: true,
                                juego_padre_id: item.producto_id,
                                es_juego: false
                            };
                            
                            // Asignar color según el tipo de componente
                            const nombreComp = productoCom.nombre.toLowerCase();
                            console.log(`🔍 Procesando componente: "${productoCom.nombre}" (lowercase: "${nombreComp}")`);
                            
                            if (nombreComp.includes('cubremantel') && item.color_cubremantel) {
                                itemComponente.color = item.color_cubremantel;
                                console.log(`🔵 Cubremantel ${item.color_cubremantel} asignado (producto_id: ${componente.producto_id})`);
                            }
                            
                            // Buscar "moño" O "mono" (sin acento) - AMBAS VARIANTES
                            if ((nombreComp.includes('moño') || nombreComp.includes('mono')) && item.color_mono) {
                                itemComponente.color = item.color_mono;
                                console.log(`🔴 Moño ${item.color_mono} asignado (producto_id: ${componente.producto_id})`);
                            } else if (nombreComp.includes('moño') || nombreComp.includes('mono')) {
                                console.warn(`⚠️ Producto "${productoCom.nombre}" detectado como moño pero NO tiene color_mono`);
                                console.warn(`⚠️ item.color_mono = ${item.color_mono}`);
                            }
                            
                            itemsParaGuardar.push(itemComponente);
                        }
                    }
                }
            } else {
                // No es juego - guardarlo normal
                itemsParaGuardar.push({
                    pedido_id: pedidoData.id,
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal,
                    color: item.color || null,
                    tamano: item.tamano || null,
                    es_juego: false,
                    es_componente_juego: false
                });
            }
        }

        console.log(`✅ ${itemsParaGuardar.length} items preparados para guardar`);

        // Guardar todos los items (juegos + componentes)
        const { error: itemsError } = await supabase
            .from('pedido_items')
            .insert(itemsParaGuardar);

        if (itemsError) {
            console.error('❌ Error al guardar items:', itemsError);
            throw itemsError;
        }

        console.log(`✅ ${itemsParaGuardar.length} items guardados correctamente`);

        alert('✅ Pedido guardado exitosamente');
        await cargarPedidos();
        volverALista();
    } catch (error) {
        console.error('❌ Error al guardar pedido:', error);
        alert(`Error al guardar el pedido: ${error.message}`);
        
        // Rehabilitar botón en caso de error
        const btnGuardar = document.querySelector('#form-nuevo-pedido button[type="submit"]');
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '💾 Guardar Pedido';
        }
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

// Eliminar pedido
async function eliminarPedido(pedidoId) {
    // Buscar el pedido para mostrar información
    const pedido = pedidosData.find(p => p.id === pedidoId);
    if (!pedido) {
        alert('No se encontró el pedido');
        return;
    }

    // Confirmar eliminación
    const confirmar = confirm(
        `¿Estás seguro de que deseas eliminar este pedido?

` +
        `Cliente: ${pedido.cliente_nombre}
` +
        `Fecha: ${formatearFechaSegura(pedido.fecha_evento)}
` +
        `Total: ${formatCurrency(pedido.total || 0)}

` +
        `Esta acción NO se puede deshacer.`
    );

    if (!confirmar) return;

    try {
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase no configurado');
        }

        console.log('🗑️ Eliminando pedido:', pedidoId);

        // Eliminar pedido (los items se eliminan automáticamente por CASCADE)
        const { error } = await supabase
            .from('pedidos')
            .delete()
            .eq('id', pedidoId);

        if (error) throw error;

        console.log('✅ Pedido eliminado correctamente');
        alert('✅ Pedido eliminado correctamente');
        await cargarPedidos();
    } catch (error) {
        console.error('❌ Error al eliminar pedido:', error);
        alert(`Error al eliminar el pedido: ${error.message}`);
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
        // Filtrar solo items que NO son componentes de juegos
        const itemsVisibles = pedido.pedido_items.filter(item => !item.es_componente_juego);
        
        if (itemsVisibles.length > 0) {
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
                        ${itemsVisibles.map(item => {
                            let nombreProducto = item.productos ? item.productos.nombre : 'Producto';
                            
                            // Si tiene color de cubremantel, agregarlo SIN stock
                            if (item.color_cubremantel) {
                                nombreProducto += ` (Cubremantel: ${item.color_cubremantel})`;
                            }
                            
                            // Si tiene color de moño, agregarlo SIN stock
                            if (item.color_mono) {
                                nombreProducto += ` (Moño: ${item.color_mono})`;
                            }
                            
                            return `
                                <tr>
                                    <td>${nombreProducto}</td>
                                    <td>${item.cantidad}</td>
                                    <td>${formatCurrency(item.precio_unitario || 0)}</td>
                                    <td>${formatCurrency(item.subtotal || 0)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
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
            ${(() => {
                if (pedido.pagado) {
                    // Caso 1: Pagado completo
                    return `<div class="table-total-label" style="margin-top: 0.5rem; color: #10b981; font-weight: bold;">✓ PAGADO COMPLETO</div>`;
                } else if (pedido.anticipo > 0) {
                    // Caso 2: Con anticipo (pago parcial)
                    const saldo = (pedido.total || 0) - pedido.anticipo;
                    return `
                        <div class="table-total-label" style="margin-top: 0.5rem;">Anticipo: ${formatCurrency(pedido.anticipo)}</div>
                        <div class="table-total-label" style="margin-top: 0.25rem; color: #f59e0b; font-weight: bold;">Saldo pendiente: ${formatCurrency(saldo)}</div>
                    `;
                } else {
                    // Caso 3: No pagado (sin anticipo)
                    return `<div class="table-total-label" style="margin-top: 0.5rem; color: #ef4444; font-weight: bold;">⚠️ PAGO PENDIENTE</div>`;
                }
            })()}
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
// Generar y descargar nota (para pedidos nuevos antes de guardar)
function generarYDescargarNota() {
    if (itemsPedidoActual.length === 0) {
        alert('Debes agregar items al pedido antes de generar la nota');
        return;
    }

    alert('⚠️ Esta función genera una vista previa. El pedido aún no se ha guardado. Usa el botón "Guardar Pedido" para guardarlo en la base de datos.');
}

// Descargar nota de un pedido existente
async function descargarNotaPedido() {
    if (!pedidoActualId) return;
    
    try {
        // Buscar el pedido
        const pedido = pedidosData.find(p => p.id === pedidoActualId);
        if (!pedido) {
            alert('No se encontró el pedido');
            return;
        }

        console.log('📄 Generando PDF para pedido:', pedido.id);

        // Cargar jsPDF si no está cargado
        if (typeof window.jspdf === 'undefined') {
            console.log('⏳ Cargando jsPDF...');
            await cargarJsPDF();
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Configuración de colores
        const azulOscuro = [25, 48, 91];
        const grisOscuro = [60, 60, 60];
        const azulClaro = [52, 152, 219];

        // ==================== ENCABEZADO ====================
        doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
        doc.rect(0, 0, 210, 45, 'F');

        // Título principal
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('EL RINCONCITO COSTEÑO', 105, 12, { align: 'center' });

        // Subtítulo
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Renta de Mobiliario para Eventos', 105, 19, { align: 'center' });

        // Teléfonos
        doc.setFontSize(9);
        doc.text('Tel: 954-124-2921 | 954-125-1757', 105, 26, { align: 'center' });

        // Dirección
        doc.text('Bajos de Chila, Colonia Las Flores', 105, 32, { align: 'center' });

        // "NOTA DE PEDIDO"
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('NOTA DE PEDIDO', 105, 40, { align: 'center' });

        // ==================== INFORMACIÓN DEL CLIENTE ====================
        let yPos = 55;

        doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(15, yPos - 5, 85, 25, 2, 2, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMACIÓN DEL CLIENTE', 20, yPos);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Nombre: ${pedido.cliente_nombre}`, 20, yPos + 7);
        doc.text(`Teléfono: ${pedido.cliente_telefono || 'N/A'}`, 20, yPos + 14);

        // ==================== PEDIDO # ====================
        doc.setFillColor(azulClaro[0], azulClaro[1], azulClaro[2]);
        doc.roundedRect(110, yPos - 5, 85, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        
        const fechaPedido = new Date(pedido.fecha_evento);
        const pedidoNumero = `${fechaPedido.getDate()}-${fechaPedido.getMonth() + 1}-${fechaPedido.getFullYear()}`;
        doc.text(`Pedido #${pedidoNumero}`, 152.5, yPos, { align: 'center' });

        // ==================== INFORMACIÓN DEL EVENTO ====================
        yPos += 35;

        doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(15, yPos - 5, 180, 30, 2, 2, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMACIÓN DEL EVENTO', 20, yPos);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        const fechaFormateada = formatearFechaSegura(pedido.fecha_evento);
        doc.text(`Fecha: ${fechaFormateada}`, 20, yPos + 7);
        doc.text(`Hora: ${formatearHoraSegura(pedido.hora_evento)}`, 20, yPos + 14);
        doc.text(`Lugar: ${pedido.lugar}`, 20, yPos + 21);

        if (pedido.lugar_descripcion) {
            doc.text(`Dirección: ${pedido.lugar_descripcion}`, 100, yPos + 7);
        }

        // ==================== ITEMS DEL PEDIDO ====================
        yPos += 45;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('ITEMS DEL PEDIDO', 20, yPos);

        yPos += 5;

        // Encabezados de tabla
        doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
        doc.rect(15, yPos, 180, 8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PRODUCTO', 20, yPos + 5);
        doc.text('CANT.', 125, yPos + 5, { align: 'right' });
        doc.text('PRECIO UNIT.', 150, yPos + 5, { align: 'right' });
        doc.text('SUBTOTAL', 185, yPos + 5, { align: 'right' });

        yPos += 8;

        // Filtrar items NO componentes
        const itemsVisibles = pedido.pedido_items.filter(item => !item.es_componente_juego);

        // Items
        doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.setFont('helvetica', 'normal');
        
        itemsVisibles.forEach((item, index) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            // Fondo alternado
            if (index % 2 === 0) {
                doc.setFillColor(248, 248, 248);
                doc.rect(15, yPos, 180, 8, 'F');
            }

            let nombreProducto = item.productos ? item.productos.nombre : 'Producto';
            
            // Agregar color de cubremantel si existe
            if (item.color_cubremantel) {
                nombreProducto += ` (Cubremantel: ${item.color_cubremantel})`;
            }
            
            // Agregar color de moño si existe
            if (item.color_mono) {
                nombreProducto += ` (Moño: ${item.color_mono})`;
            }

            doc.text(nombreProducto, 20, yPos + 5);
            doc.text(item.cantidad.toString(), 125, yPos + 5, { align: 'right' });
            doc.text(formatCurrency(item.precio_unitario || 0), 150, yPos + 5, { align: 'right' });
            doc.text(formatCurrency(item.subtotal || 0), 185, yPos + 5, { align: 'right' });

            yPos += 8;
        });

        // ==================== TOTAL ====================
        yPos += 5;

        doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
        doc.rect(130, yPos, 65, 8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('TOTAL:', 140, yPos + 5);
        doc.text(formatCurrency(pedido.total || 0), 185, yPos + 5, { align: 'right' });

        yPos += 10;

        // ==================== ESTADO DE PAGO ====================
        doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        if (pedido.pagado) {
            // Pagado completo
            doc.setFillColor(16, 185, 129);
            doc.roundedRect(130, yPos, 65, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('PAGADO COMPLETO', 162.5, yPos + 5, { align: 'center' });
        } else if (pedido.anticipo > 0) {
            // Con anticipo
            doc.setFont('helvetica', 'bold');
            doc.text(`Anticipo: ${formatCurrency(pedido.anticipo)}`, 140, yPos + 3);
            const saldo = (pedido.total || 0) - pedido.anticipo;
            doc.text(`Saldo: ${formatCurrency(saldo)}`, 140, yPos + 9);
            
            yPos += 15;
            doc.setFillColor(245, 158, 11);
            doc.roundedRect(130, yPos, 65, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('ANTICIPO RECIBIDO', 162.5, yPos + 5, { align: 'center' });
        } else {
            // No pagado
            yPos += 2;
            doc.setFillColor(239, 68, 68);
            doc.roundedRect(130, yPos, 65, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('PAGO PENDIENTE', 162.5, yPos + 5, { align: 'center' });
        }

        // ==================== PIE DE PÁGINA ====================
        yPos = 260;

        doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Términos y Condiciones:', 20, yPos);

        doc.setFont('helvetica', 'normal');
        doc.text('• El mobiliario debe ser devuelto en las mismas condiciones.', 20, yPos + 5);
        doc.text('• Cualquier daño será cobrado al cliente.', 20, yPos + 10);
        doc.text('• La fecha de devolución es al día siguiente del evento.', 20, yPos + 15);

        // Línea de firma
        yPos += 25;
        doc.line(20, yPos, 80, yPos);
        doc.text('Firma del Cliente', 50, yPos + 5, { align: 'center' });

        // Fecha de emisión
        const hoy = new Date();
        const fechaEmision = hoy.toLocaleDateString('es-MX', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(`Nota emitida el ${fechaEmision}`, 105, 285, { align: 'center' });

        // ==================== GUARDAR PDF ====================
        const nombreArchivo = `Nota_${pedidoNumero}_${pedido.cliente_nombre.replace(/\s+/g, '-')}.pdf`;
        doc.save(nombreArchivo);

        console.log('✅ PDF generado:', nombreArchivo);

    } catch (error) {
        console.error('❌ Error al generar PDF:', error);
        alert(`Error al generar la nota: ${error.message}`);
    }
}

// Cargar librería jsPDF
function cargarJsPDF() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
            console.log('✅ jsPDF cargado');
            resolve();
        };
        script.onerror = () => {
            reject(new Error('No se pudo cargar jsPDF'));
        };
        document.head.appendChild(script);
    });
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
