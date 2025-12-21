// inventario.js - Gestión de Inventario

// Variables globales
let productosData = [];
let productosColores = [];
let productoActual = null;
let colorActual = null;
let accionActual = null;
let busquedaActual = '';

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de inventario cargada');
    await cargarInventario();
});

// Cargar inventario desde Supabase
async function cargarInventario() {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('Supabase no está configurado. Mostrando inventario vacío.');
            mostrarInventarioVacio();
            return;
        }

        // Cargar productos
        const { data: productos, error: productosError } = await supabase
            .from('productos')
            .select('*')
            .order('nombre');

        if (productosError) throw productosError;

        productosData = productos || [];

        // Cargar colores de productos
        const { data: colores, error: coloresError } = await supabase
            .from('producto_colores')
            .select('*');

        if (coloresError) throw coloresError;

        productosColores = colores || [];

        mostrarInventario();
        actualizarTotalPiezas();
        console.log('Inventario cargado:', { productos: productosData.length, colores: productosColores.length });
    } catch (error) {
        console.error('Error al cargar inventario:', error);
        mostrarInventarioVacio();
    }
}

// Mostrar inventario vacío o con productos
function mostrarInventarioVacio() {
    // Si no hay conexión a Supabase, mostrar mensaje
    productosData = [];
    productosColores = [];
    mostrarInventario();
    actualizarTotalPiezas();
}

// Mostrar inventario en la interfaz
function mostrarInventario() {
    // Excluir juegos del inventario (solo mostrar productos físicos)
    const productosReales = productosData.filter(p => !p.es_juego);
    
    // Separar productos por tipo
    const productosConColores = productosReales.filter(p => p.tiene_colores && !p.tiene_tamanos);
    const productosConTamanos = productosReales.filter(p => p.tiene_tamanos && !p.tiene_colores);
    const productosSinColoresNiTamanos = productosReales.filter(p => !p.tiene_colores && !p.tiene_tamanos);

    // Aplicar búsqueda si existe
    let productosColoresFiltrados = productosConColores;
    let productosTamanosFiltrados = productosConTamanos;
    let productosSinColoresFiltrados = productosSinColoresNiTamanos;

    if (busquedaActual) {
        const busqueda = busquedaActual.toLowerCase();
        productosColoresFiltrados = productosConColores.filter(p => 
            p.nombre.toLowerCase().includes(busqueda)
        );
        productosTamanosFiltrados = productosConTamanos.filter(p => 
            p.nombre.toLowerCase().includes(busqueda)
        );
        productosSinColoresFiltrados = productosSinColoresNiTamanos.filter(p => 
            p.nombre.toLowerCase().includes(busqueda)
        );
    }

    // Mostrar items por color
    const contenedorColores = document.getElementById('items-colores');
    if (productosColoresFiltrados.length > 0) {
        contenedorColores.innerHTML = productosColoresFiltrados.map(producto => 
            crearCardProductoConColores(producto)
        ).join('');
    } else {
        contenedorColores.innerHTML = '<p style="color: var(--text-light); padding: 2rem; text-align: center;">No hay productos con colores</p>';
    }

    // Mostrar items por tamaño
    const contenedorTamanos = document.getElementById('items-tamanos');
    if (productosTamanosFiltrados.length > 0) {
        contenedorTamanos.innerHTML = productosTamanosFiltrados.map(producto => 
            crearCardProductoConTamanos(producto)
        ).join('');
    } else {
        contenedorTamanos.innerHTML = '<p style="color: var(--text-light); padding: 2rem; text-align: center;">No hay productos con tamaños</p>';
    }

    // Mostrar mobiliario general
    const contenedorMobiliario = document.getElementById('items-mobiliario');
    if (productosSinColoresFiltrados.length > 0) {
        contenedorMobiliario.innerHTML = productosSinColoresFiltrados.map(producto => 
            crearCardProductoSimple(producto)
        ).join('');
    } else {
        contenedorMobiliario.innerHTML = '<p style="color: var(--text-light); padding: 2rem; text-align: center;">No hay productos en esta categoría</p>';
    }
}

// Crear card para producto con colores
function crearCardProductoConColores(producto) {
    const coloresProducto = productosColores.filter(c => c.producto_id === producto.id);
    const totalPiezas = coloresProducto.reduce((sum, c) => sum + (c.stock_disponible || 0), 0);

    const coloresBadges = coloresProducto.slice(0, 6).map(color => `
        <div class="color-badge">
            <span class="color-badge-nombre">${color.color}:</span>
            <span class="color-badge-cantidad">${color.stock_disponible || 0}</span>
        </div>
    `).join('');

    const masColores = coloresProducto.length > 6 ? 
        `<div class="color-badge">+${coloresProducto.length - 6} más</div>` : '';

    return `
        <div class="item-card" onclick="abrirModalColores('${producto.id}')">
            <div class="item-card-header">
                <div class="item-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
                    </svg>
                </div>
                <div class="item-nombre">${producto.nombre}</div>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </div>

            <div class="total-display">
                Total: ${totalPiezas}
            </div>

            <div class="item-colores-resumen">
                ${coloresBadges}
                ${masColores}
            </div>
        </div>
    `;
}

// Crear card para producto con tamaños (similar a colores)
function crearCardProductoConTamanos(producto) {
    // Por ahora mostrar el total general, luego se agregará tabla producto_tamanos
    const cantidad = producto.stock_disponible || 0;
    let claseEstado = '';
    if (cantidad === 0) claseEstado = 'sin-stock';
    else if (cantidad < 10) claseEstado = 'stock-bajo';
    
    // Extraer el tamaño del nombre (ej: "Lona 10x7" -> "10x7")
    const nombrePartes = producto.nombre.split(' ');
    const tamano = nombrePartes[nombrePartes.length - 1];
    const badge = `<span class="item-badge">${tamano}</span>`;

    return `
        <div class="item-card ${claseEstado}">
            <div class="item-card-header">
                <div class="item-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                    </svg>
                </div>
                <div class="item-nombre">${producto.nombre}</div>
                ${badge}
            </div>

            <div class="item-cantidad">
                <span class="item-cantidad-label">Cantidad Actual</span>
                <div class="item-cantidad-numero">${cantidad}</div>
            </div>

            <button class="btn btn-secondary item-action" onclick="abrirModalEditar('${producto.id}', event)">
                Editar Cantidad
            </button>
        </div>
    `;
}

// Crear card para producto simple
function crearCardProductoSimple(producto) {
    const cantidad = producto.stock_disponible || 0;
    let claseEstado = '';
    if (cantidad === 0) claseEstado = 'sin-stock';
    else if (cantidad < 10) claseEstado = 'stock-bajo';

    const badge = producto.tiene_tamanos ? 
        `<span class="item-badge">${producto.nombre.split(' ').pop()}</span>` : '';

    return `
        <div class="item-card ${claseEstado}">
            <div class="item-card-header">
                <div class="item-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                </div>
                <div class="item-nombre">${producto.nombre}</div>
                ${badge}
            </div>

            <div class="item-cantidad">
                <span class="item-cantidad-label">Cantidad Actual</span>
                <div class="item-cantidad-numero">${cantidad}</div>
            </div>

            <button class="btn btn-secondary item-action" onclick="abrirModalEditar('${producto.id}', event)">
                Editar Cantidad
            </button>
        </div>
    `;
}

// Actualizar total de piezas
function actualizarTotalPiezas() {
    let total = 0;

    // Sumar productos simples
    productosData.forEach(producto => {
        if (!producto.tiene_colores) {
            total += producto.stock_disponible || 0;
        }
    });

    // Sumar productos con colores
    productosColores.forEach(color => {
        total += color.stock_disponible || 0;
    });

    document.getElementById('total-piezas').textContent = total.toLocaleString('es-MX');
}

// Buscar productos
function buscarProductos() {
    busquedaActual = document.getElementById('buscar-item').value;
    mostrarInventario();
}

// Abrir modal editar cantidad
function abrirModalEditar(productoId, event) {
    if (event) event.stopPropagation();
    
    const producto = productosData.find(p => p.id === productoId);
    if (!producto) return;

    productoActual = producto;
    accionActual = null;

    document.getElementById('modal-titulo-producto').textContent = producto.nombre;
    document.getElementById('cantidad-actual-display').textContent = producto.stock_disponible || 0;
    document.getElementById('form-cantidad').classList.add('oculto');
    document.getElementById('input-cantidad').value = '';
    document.getElementById('motivo-cambio').value = '';
    document.getElementById('btn-guardar-cantidad').disabled = true;

    // Quitar selección de botones
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    document.getElementById('modal-editar-cantidad').classList.add('active');
}

// Seleccionar acción (agregar, quitar, establecer)
function seleccionarAccion(accion) {
    accionActual = accion;

    // Actualizar botones
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.target.closest('.action-btn').classList.add('selected');

    // Mostrar formulario
    const formCantidad = document.getElementById('form-cantidad');
    formCantidad.classList.remove('oculto');

    // Actualizar label según acción
    const label = document.getElementById('label-cantidad');
    if (accion === 'agregar') {
        label.textContent = 'Cantidad a agregar';
    } else if (accion === 'quitar') {
        label.textContent = 'Cantidad a quitar';
    } else {
        label.textContent = 'Nueva cantidad total';
    }

    // Limpiar input y actualizar preview
    document.getElementById('input-cantidad').value = '';
    actualizarPreviewCantidad();
}

// Actualizar preview de nueva cantidad
function actualizarPreviewCantidad() {
    const cantidadActual = productoActual?.stock_disponible || 0;
    const cantidad = parseInt(document.getElementById('input-cantidad').value) || 0;
    let nuevaCantidad = cantidadActual;

    if (accionActual === 'agregar') {
        nuevaCantidad = cantidadActual + cantidad;
    } else if (accionActual === 'quitar') {
        nuevaCantidad = Math.max(0, cantidadActual - cantidad);
    } else if (accionActual === 'establecer') {
        nuevaCantidad = cantidad;
    }

    document.getElementById('preview-cantidad').textContent = nuevaCantidad;
    document.getElementById('btn-guardar-cantidad').disabled = cantidad === 0 && accionActual !== 'establecer';
}

// Escuchar cambios en el input de cantidad
document.addEventListener('DOMContentLoaded', function() {
    const inputCantidad = document.getElementById('input-cantidad');
    if (inputCantidad) {
        inputCantidad.addEventListener('input', actualizarPreviewCantidad);
    }
});

// Guardar cambio en inventario
async function guardarCambioInventario() {
    if (!productoActual || !accionActual) return;

    const cantidadActual = productoActual.stock_disponible || 0;
    const cantidad = parseInt(document.getElementById('input-cantidad').value) || 0;
    let nuevaCantidad = cantidadActual;

    if (accionActual === 'agregar') {
        nuevaCantidad = cantidadActual + cantidad;
    } else if (accionActual === 'quitar') {
        nuevaCantidad = Math.max(0, cantidadActual - cantidad);
    } else if (accionActual === 'establecer') {
        nuevaCantidad = cantidad;
    }

    try {
        if (typeof supabase !== 'undefined') {
            const { error } = await supabase
                .from('productos')
                .update({ 
                    stock_disponible: nuevaCantidad,
                    stock_total: nuevaCantidad // Actualizar también el total
                })
                .eq('id', productoActual.id);

            if (error) throw error;
            
            alert('Cantidad actualizada exitosamente');
        } else {
            // Modo demo
            productoActual.stock_disponible = nuevaCantidad;
            productoActual.stock_total = nuevaCantidad;
            alert('Cantidad actualizada (modo demo)');
        }

        await cargarInventario();
        cerrarModalEditar();
    } catch (error) {
        console.error('Error al actualizar cantidad:', error);
        alert('Error al actualizar la cantidad');
    }
}

// Cerrar modal editar
function cerrarModalEditar() {
    document.getElementById('modal-editar-cantidad').classList.remove('active');
    productoActual = null;
    accionActual = null;
}

// Abrir modal de colores
function abrirModalColores(productoId) {
    const producto = productosData.find(p => p.id === productoId);
    if (!producto) return;

    productoActual = producto;

    document.getElementById('modal-titulo-colores').textContent = producto.nombre;
    
    const coloresProducto = productosColores.filter(c => c.producto_id === productoId);
    
    const coloresHTML = coloresProducto.map(color => `
        <div class="color-item">
            <div class="color-item-header">
                <span class="color-nombre">${color.color}</span>
            </div>
            <div class="color-cantidad">${color.stock_disponible || 0}</div>
            <button class="btn-editar-color" onclick="editarColor('${color.id}', event)">
                Editar
            </button>
        </div>
    `).join('');

    document.getElementById('colores-grid').innerHTML = coloresHTML;
    document.getElementById('form-nuevo-color').classList.add('oculto');
    document.getElementById('modal-editar-colores').classList.add('active');
}

// Editar color específico
function editarColor(colorId, event) {
    if (event) event.stopPropagation();
    
    const color = productosColores.find(c => c.id === colorId);
    if (!color) return;

    colorActual = color;
    
    // Abrir modal de editar cantidad pero para el color
    document.getElementById('modal-titulo-producto').textContent = `${productoActual.nombre} - ${color.color}`;
    document.getElementById('cantidad-actual-display').textContent = color.stock_disponible || 0;
    document.getElementById('form-cantidad').classList.add('oculto');
    document.getElementById('input-cantidad').value = '';
    document.getElementById('motivo-cambio').value = '';
    document.getElementById('btn-guardar-cantidad').disabled = true;

    // Quitar selección de botones
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Cerrar modal de colores y abrir modal de editar
    document.getElementById('modal-editar-colores').classList.remove('active');
    document.getElementById('modal-editar-cantidad').classList.add('active');
}

// Guardar cambio de color (modificar la función guardarCambioInventario para manejar colores)
const guardarCambioInventarioOriginal = guardarCambioInventario;
guardarCambioInventario = async function() {
    if (colorActual) {
        // Guardar cambio en color
        const cantidadActual = colorActual.stock_disponible || 0;
        const cantidad = parseInt(document.getElementById('input-cantidad').value) || 0;
        let nuevaCantidad = cantidadActual;

        if (accionActual === 'agregar') {
            nuevaCantidad = cantidadActual + cantidad;
        } else if (accionActual === 'quitar') {
            nuevaCantidad = Math.max(0, cantidadActual - cantidad);
        } else if (accionActual === 'establecer') {
            nuevaCantidad = cantidad;
        }

        try {
            if (typeof supabase !== 'undefined') {
                const { error } = await supabase
                    .from('producto_colores')
                    .update({ stock_disponible: nuevaCantidad })
                    .eq('id', colorActual.id);

                if (error) throw error;
                
                alert('Cantidad actualizada exitosamente');
            } else {
                colorActual.stock_disponible = nuevaCantidad;
                alert('Cantidad actualizada (modo demo)');
            }

            await cargarInventario();
            cerrarModalEditar();
            // Reabrir modal de colores
            setTimeout(() => abrirModalColores(productoActual.id), 100);
            colorActual = null;
        } catch (error) {
            console.error('Error al actualizar cantidad del color:', error);
            alert('Error al actualizar la cantidad');
        }
    } else {
        // Llamar a la función original para productos simples
        await guardarCambioInventarioOriginal();
    }
};

// Cerrar modal de colores
function cerrarModalColores() {
    document.getElementById('modal-editar-colores').classList.remove('active');
    productoActual = null;
}

// Mostrar formulario para agregar nuevo color
function mostrarAgregarColor() {
    document.getElementById('form-nuevo-color').classList.remove('oculto');
    document.getElementById('nuevo-color-nombre').value = '';
    document.getElementById('nuevo-color-cantidad').value = '0';
}

// Cancelar nuevo color
function cancelarNuevoColor() {
    document.getElementById('form-nuevo-color').classList.add('oculto');
}

// Agregar nuevo color
async function agregarNuevoColor() {
    const nombre = document.getElementById('nuevo-color-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('nuevo-color-cantidad').value) || 0;

    if (!nombre) {
        alert('Por favor ingresa el nombre del color');
        return;
    }

    try {
        if (typeof supabase !== 'undefined') {
            const { error } = await supabase
                .from('producto_colores')
                .insert([{
                    producto_id: productoActual.id,
                    color: nombre,
                    stock_disponible: cantidad
                }]);

            if (error) throw error;
            
            alert('Color agregado exitosamente');
        } else {
            // Modo demo
            productosColores.push({
                id: Date.now().toString(),
                producto_id: productoActual.id,
                color: nombre,
                stock_disponible: cantidad
            });
            alert('Color agregado (modo demo)');
        }

        await cargarInventario();
        abrirModalColores(productoActual.id);
    } catch (error) {
        console.error('Error al agregar color:', error);
        alert('Error al agregar el color');
    }
}

// Modal nuevo producto
function mostrarModalNuevoProducto() {
    document.getElementById('nuevo-producto-nombre').value = '';
    document.getElementById('nuevo-producto-categoria').value = '';
    document.getElementById('nuevo-producto-cantidad').value = '0';
    document.getElementById('nuevo-producto-precio').value = '';
    document.getElementById('nuevo-producto-colores').checked = false;
    document.getElementById('nuevo-producto-tamanos').checked = false;
    document.getElementById('modal-nuevo-producto').classList.add('active');
}

function cerrarModalNuevoProducto() {
    document.getElementById('modal-nuevo-producto').classList.remove('active');
}

async function agregarNuevoProducto() {
    try {
        console.log('Iniciando creación de nuevo producto...');
        
        const nombre = document.getElementById('nuevo-producto-nombre')?.value.trim() || '';
        const categoria = document.getElementById('nuevo-producto-categoria')?.value.trim() || 'general';
        const cantidad = parseInt(document.getElementById('nuevo-producto-cantidad')?.value) || 0;
        const precio = parseFloat(document.getElementById('nuevo-producto-precio')?.value) || 0;
        const tieneColores = document.getElementById('nuevo-producto-colores')?.checked || false;
        const tieneTamanos = document.getElementById('nuevo-producto-tamanos')?.checked || false;

        console.log('Datos del formulario:', {
            nombre,
            categoria,
            cantidad,
            precio,
            tieneColores,
            tieneTamanos
        });

        // Validar nombre
        if (!nombre) {
            alert('Por favor ingresa el nombre del producto');
            document.getElementById('nuevo-producto-nombre')?.focus();
            return;
        }

        // Verificar que Supabase esté disponible
        if (typeof supabase !== 'undefined') {
            console.log('Guardando en Supabase...');
            
            const productoData = {
                nombre: nombre,
                categoria: categoria,
                stock_disponible: cantidad,
                stock_total: cantidad,
                precio_renta: precio,
                tiene_colores: tieneColores,
                tiene_tamanos: tieneTamanos
            };

            console.log('Datos a insertar:', productoData);

            const { data, error } = await supabase
                .from('productos')
                .insert([productoData])
                .select();

            if (error) {
                console.error('Error de Supabase:', error);
                throw error;
            }

            console.log('Producto guardado exitosamente:', data);
            alert('✅ Producto agregado exitosamente');
        } else {
            console.warn('Supabase no disponible - Modo demo');
            // Modo demo
            productosData.push({
                id: Date.now().toString(),
                nombre: nombre,
                categoria: categoria,
                stock_disponible: cantidad,
                stock_total: cantidad,
                precio_renta: precio,
                tiene_colores: tieneColores,
                tiene_tamanos: tieneTamanos
            });
            alert('✅ Producto agregado (modo demo)');
        }

        await cargarInventario();
        cerrarModalNuevoProducto();
    } catch (error) {
        console.error('❌ Error completo al agregar producto:', error);
        console.error('Detalles del error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        alert(`Error al agregar el producto: ${error.message || 'Error desconocido'}`);
    }
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
