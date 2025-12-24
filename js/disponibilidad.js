// disponibilidad.js - Consulta de disponibilidad de mobiliario

// Variables globales
let fechaActual = new Date();
let fechaSeleccionada = new Date();
let pedidosDia = [];
let eventosDia = [];

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📅 Página de disponibilidad cargada');
    
    // Esperar a que Supabase esté disponible
    let intentos = 0;
    while (typeof supabase === 'undefined' && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }
    
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase no se pudo cargar');
    } else {
        console.log('✅ Supabase cargado correctamente');
    }
    
    generarCalendario();
    await cargarDisponibilidadDia();
});

// Generar calendario
function generarCalendario() {
    const year = fechaActual.getFullYear();
    const month = fechaActual.getMonth();

    // Actualizar título
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    document.getElementById('calendar-title').textContent = `${meses[month]} ${year}`;

    // Obtener primer y último día del mes
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);

    // Ajustar al lunes como primer día de la semana
    let diaInicio = primerDia.getDay();
    diaInicio = diaInicio === 0 ? 6 : diaInicio - 1;

    const diasMes = ultimoDia.getDate();
    const diasMesAnterior = new Date(year, month, 0).getDate();

    // Generar días
    const contenedor = document.getElementById('calendar-days');
    contenedor.innerHTML = '';

    // Días del mes anterior
    for (let i = diaInicio - 1; i >= 0; i--) {
        const dia = diasMesAnterior - i;
        const diaDiv = document.createElement('div');
        diaDiv.className = 'calendar-day other-month';
        diaDiv.textContent = dia;
        contenedor.appendChild(diaDiv);
    }

    // Días del mes actual
    const hoy = new Date();
    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(year, month, dia);
        const diaDiv = document.createElement('div');
        diaDiv.className = 'calendar-day';
        diaDiv.textContent = dia;

        // Marcar hoy
        if (fecha.toDateString() === hoy.toDateString()) {
            diaDiv.classList.add('today');
        }

        // Marcar día seleccionado
        if (fecha.toDateString() === fechaSeleccionada.toDateString()) {
            diaDiv.classList.add('selected');
        }

        diaDiv.onclick = () => seleccionarDia(fecha);
        contenedor.appendChild(diaDiv);
    }

    // Días del siguiente mes
    const diasRestantes = 42 - (diaInicio + diasMes);
    for (let dia = 1; dia <= diasRestantes; dia++) {
        const diaDiv = document.createElement('div');
        diaDiv.className = 'calendar-day other-month';
        diaDiv.textContent = dia;
        contenedor.appendChild(diaDiv);
    }
}

// Cambiar mes
function cambiarMes(direccion) {
    fechaActual.setMonth(fechaActual.getMonth() + direccion);
    generarCalendario();
}

// Seleccionar día
function seleccionarDia(fecha) {
    fechaSeleccionada = fecha;
    generarCalendario();
    cargarDisponibilidadDia();
}

// Cargar disponibilidad del día seleccionado
async function cargarDisponibilidadDia() {
    try {
        const fechaStr = fechaSeleccionada.toISOString().split('T')[0];

        // Actualizar título
        const fechaFormateada = fechaSeleccionada.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.getElementById('titulo-pedidos').textContent = `Pedidos para ${fechaFormateada}`;

        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase no configurado - No se pueden cargar datos');
            alert('⚠️ Error: No se pudo conectar a la base de datos. Verifica tu configuración de Supabase.');
            pedidosDia = [];
            eventosDia = [];
            mostrarPedidosDia();
            mostrarDisponibilidad([]);
            return;
        }
        
        console.log('🔍 Buscando pedidos para fecha:', fechaStr);

        // Cargar pedidos del día - CONSULTA SIMPLIFICADA
        const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select('*')
            .eq('fecha_evento', fechaStr);

        if (pedidosError) {
            console.error('❌ Error al cargar pedidos:', pedidosError);
            console.error('❌ Detalles del error:', JSON.stringify(pedidosError, null, 2));
            console.error('❌ Mensaje:', pedidosError.message);
            console.error('❌ Código:', pedidosError.code);
            throw pedidosError;
        }
        
        console.log(`✅ Pedidos cargados: ${pedidos ? pedidos.length : 0}`);

        // Cargar eventos del salón del día
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_salon')
            .select('*')
            .eq('fecha_evento', fechaStr);

        if (eventosError) {
            console.error('❌ Error al cargar eventos:', eventosError);
            throw eventosError;
        }
        
        console.log(`✅ Eventos cargados: ${eventos ? eventos.length : 0}`);

        pedidosDia = pedidos || [];
        eventosDia = eventos || [];

        mostrarPedidosDia();
        await calcularDisponibilidad(fechaStr);

    } catch (error) {
        console.error('Error al cargar disponibilidad:', error);
        pedidosDia = [];
        eventosDia = [];
        mostrarPedidosDia();
        mostrarDisponibilidad([]);
    }
}

// Mostrar pedidos del día
function mostrarPedidosDia() {
    const contenedor = document.getElementById('lista-pedidos-dia');
    const subtitulo = document.getElementById('subtitulo-pedidos');

    const totalPedidos = pedidosDia.length + eventosDia.length;

    if (totalPedidos === 0) {
        subtitulo.textContent = 'No hay pedidos registrados';
        contenedor.innerHTML = `
            <div class="empty-state-pedidos">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <h4>Sin eventos para esta fecha</h4>
                <p>No hay pedidos ni eventos registrados</p>
            </div>
        `;
        return;
    }

    subtitulo.textContent = `${totalPedidos} ${totalPedidos === 1 ? 'pedido registrado' : 'pedidos registrados'}`;

    let html = '';

    // Mostrar pedidos de mobiliario
    pedidosDia.forEach(pedido => {
        const descripcion = pedido.pedido_items && pedido.pedido_items.length > 0 ?
            pedido.pedido_items.map(item => 
                `${item.cantidad} ${item.productos.nombre}`
            ).join(', ') : 'Mobiliario';

        html += `
            <div class="pedido-dia-item">
                <div class="pedido-dia-header">
                    <div class="pedido-dia-nombre">${pedido.cliente_nombre}</div>
                    <span class="pedido-dia-badge badge-mobiliario">Mobiliario</span>
                </div>
                <div class="pedido-dia-descripcion">${descripcion}</div>
                <div class="pedido-dia-hora">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Hora: ${pedido.hora_evento}</span>
                </div>
            </div>
        `;
    });

    // Mostrar eventos del salón
    eventosDia.forEach(evento => {
        html += `
            <div class="pedido-dia-item">
                <div class="pedido-dia-header">
                    <div class="pedido-dia-nombre">${evento.cliente_nombre}</div>
                    <span class="pedido-dia-badge badge-salon">Salón</span>
                </div>
                <div class="pedido-dia-descripcion">Evento en Salón${evento.tipo_evento ? ' - ' + evento.tipo_evento : ''}</div>
                <div class="pedido-dia-hora">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Hora: ${evento.hora_inicio}</span>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

// Calcular disponibilidad real
async function calcularDisponibilidad(fecha) {
    try {
        if (typeof supabase === 'undefined') {
            mostrarDisponibilidad([]);
            return;
        }

        // Obtener todos los productos (excluyendo juegos)
        const { data: productos, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, stock_total, stock_disponible, tiene_colores')
            .eq('es_juego', false)
            .order('nombre');

        if (productosError) {
            console.error('❌ Error al cargar productos:', productosError);
            throw productosError;
        }
        
        if (!productos || productos.length === 0) {
            console.warn('⚠️ No hay productos en la base de datos');
            mostrarDisponibilidad([]);
            return;
        }

        console.log('📅 Calculando disponibilidad para:', fecha);
        console.log(`📦 Productos a calcular: ${productos.length}`);

        // Obtener pedidos del día - CONSULTA SIMPLIFICADA
        const { data: pedidosDia, error: pedidosError } = await supabase
            .from('pedidos')
            .select('*')
            .eq('fecha_evento', fecha);

        if (pedidosError) throw pedidosError;

        console.log(`✅ ${pedidosDia ? pedidosDia.length : 0} pedidos encontrados para ${fecha}`);

        // Si no hay pedidos, mostrar todo disponible
        if (!pedidosDia || pedidosDia.length === 0) {
            // Cargar stock por colores para productos que lo tienen
            const disponibilidadPromises = productos.map(async producto => {
                if (producto.tiene_colores) {
                    // Sumar stock de todos los colores
                    const { data: colores } = await supabase
                        .from('producto_colores')
                        .select('stock_disponible')
                        .eq('producto_id', producto.id);
                    
                    const stockTotal = colores ? colores.reduce((sum, c) => sum + (c.stock_disponible || 0), 0) : 0;
                    
                    return {
                        nombre: producto.nombre,
                        disponible: stockTotal,
                        total: stockTotal,
                        enUso: 0
                    };
                } else {
                    // Productos sin colores usan stock_total
                    return {
                        nombre: producto.nombre,
                        disponible: producto.stock_total || producto.stock_disponible || 0,
                        total: producto.stock_total || producto.stock_disponible || 0,
                        enUso: 0
                    };
                }
            });
            
            const disponibilidad = await Promise.all(disponibilidadPromises);
            console.log('✅ Disponibilidad calculada (sin pedidos):', disponibilidad.length);
            mostrarDisponibilidad(disponibilidad);
            return;
        }

        // Cargar TODOS los items de los pedidos del día (incluyendo componentes de juegos)
        const pedidoIds = pedidosDia.map(p => p.id);
        const { data: todosLosItems, error: itemsError } = await supabase
            .from('pedido_items')
            .select('producto_id, cantidad, es_componente_juego, color, color_cubremantel, color_mono')
            .in('pedido_id', pedidoIds);

        if (itemsError) throw itemsError;

        console.log(`✅ ${todosLosItems ? todosLosItems.length : 0} items cargados`);
        
        // Log detallado de items
        if (todosLosItems && todosLosItems.length > 0) {
            console.log('📦 Items encontrados para esta fecha:');
            todosLosItems.forEach(item => {
                const colorInfo = item.color || item.color_cubremantel || item.color_mono || 'N/A';
                console.log(`  - Producto ID: ${item.producto_id}, Cantidad: ${item.cantidad}, Color: ${colorInfo}, Es componente: ${item.es_componente_juego}`);
            });
        }

        // Calcular disponibilidad
        const disponibilidadPromises = productos.map(async producto => {
            let cantidadUsada = 0;

            if (producto.tiene_colores) {
                // Para productos con colores, calcular el uso POR COLOR
                const { data: colores } = await supabase
                    .from('producto_colores')
                    .select('id, color, stock_disponible')
                    .eq('producto_id', producto.id);
                
                if (!colores || colores.length === 0) {
                    return {
                        nombre: producto.nombre,
                        disponible: 0,
                        total: 0,
                        enUso: 0
                    };
                }
                
                // Calcular uso de cada color
                const usoPorColor = {};
                colores.forEach(color => {
                    usoPorColor[color.color] = 0;
                });
                
                // Sumar items que usan cada color (INCLUYENDO colores que no existen en producto_colores)
                let usoColoresNoRegistrados = 0;
                
                console.log(`🔍 Buscando items para producto "${producto.nombre}" (ID: ${producto.id})`);
                
                if (todosLosItems) {
                    todosLosItems.forEach(item => {
                        // Para productos con colores, buscar en TRES columnas: color, color_cubremantel, color_mono
                        let colorItem = null;
                        
                        if (item.producto_id === producto.id) {
                            // Determinar qué columna de color usar
                            if (item.color) {
                                colorItem = item.color;
                            } else if (item.color_cubremantel && producto.nombre.toLowerCase().includes('cubremantel')) {
                                colorItem = item.color_cubremantel;
                            } else if (item.color_mono && (producto.nombre.toLowerCase().includes('moño') || producto.nombre.toLowerCase().includes('mono'))) {
                                colorItem = item.color_mono;
                            }
                            
                            if (colorItem) {
                                console.log(`  ✅ Match encontrado: Color="${colorItem}", Cantidad=${item.cantidad}`);
                                if (usoPorColor[colorItem] !== undefined) {
                                    // Color existe en producto_colores
                                    usoPorColor[colorItem] += item.cantidad || 0;
                                } else {
                                    // Color NO existe en producto_colores
                                    usoColoresNoRegistrados += item.cantidad || 0;
                                    console.warn(`⚠️ ${producto.nombre} - Color "${colorItem}" usado pero no existe en inventario (${item.cantidad} piezas)`);
                                }
                            }
                        }
                    });
                }
                
                // Sumar stock total y uso total
                let stockTotal = 0;
                let usoTotal = 0;
                
                colores.forEach(color => {
                    stockTotal += color.stock_disponible || 0;
                    usoTotal += usoPorColor[color.color] || 0;
                });
                
                // Añadir uso de colores no registrados
                usoTotal += usoColoresNoRegistrados;
                
                const disponible = Math.max(0, stockTotal - usoTotal);
                
                console.log(`📦 ${producto.nombre}: Total=${stockTotal}, En uso=${usoTotal}, Disponible=${disponible}`);
                
                return {
                    nombre: producto.nombre,
                    disponible: disponible,
                    total: stockTotal,
                    enUso: usoTotal
                };
            } else {
                // Productos sin colores: sumar TODAS las cantidades
                if (todosLosItems) {
                    todosLosItems.forEach(item => {
                        if (item.producto_id === producto.id) {
                            cantidadUsada += item.cantidad || 0;
                        }
                    });
                }
                
                const stockTotal = producto.stock_total || producto.stock_disponible || 0;
                const disponible = Math.max(0, stockTotal - cantidadUsada);

                return {
                    nombre: producto.nombre,
                    disponible: disponible,
                    total: stockTotal,
                    enUso: cantidadUsada
                };
            }
        });
        
        const disponibilidad = await Promise.all(disponibilidadPromises);

        console.log('✅ Disponibilidad calculada:', disponibilidad.length);
        mostrarDisponibilidad(disponibilidad);

    } catch (error) {
        console.error('Error al calcular disponibilidad:', error);
        mostrarDisponibilidad([]);
    }
}

// Mostrar disponibilidad
function mostrarDisponibilidad(items) {
    const contenedor = document.getElementById('disponibilidad-inventario');

    if (!items || items.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64" style="margin: 0 auto 1rem;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <h3 style="margin: 0 0 0.5rem 0;">No hay datos de inventario</h3>
                <p style="margin: 0;">Agrega productos en la sección de Inventario</p>
            </div>
        `;
        return;
    }

    // Orden de prioridad para mostrar productos
    const ordenProductos = [
        // Items por Color
        'Cubremantel',
        'Moño',
        // Items por Tamaño
        'Lona 10x7',
        'Lona 10x15',
        'Módulo 6x3',
        'Módulo 6x6',
        'Módulo 6x8',
        // Mobiliario General (orden de importancia)
        'Silla',
        'Silla Infantil',
        'Funda para Silla',
        'Tablón',
        'Tablón Infantil',
        'Mesa Redonda',
        'Mesa Cuadrada 1x1',
        'Mantel Largo',
        'Mantel Redondo',
        'Mantel Infantil',
        'Charola',
        'Tarima'
    ];

    // Ordenar items según el orden definido
    const itemsOrdenados = [];
    
    // Primero agregar los que están en el orden definido
    ordenProductos.forEach(nombreOrden => {
        const item = items.find(i => i.nombre === nombreOrden);
        if (item) {
            itemsOrdenados.push(item);
        }
    });
    
    // Luego agregar cualquier otro producto que no esté en la lista
    items.forEach(item => {
        if (!itemsOrdenados.find(i => i.nombre === item.nombre)) {
            itemsOrdenados.push(item);
        }
    });

    const html = itemsOrdenados.map(item => {
        const porcentajeDisponible = item.total > 0 ? (item.disponible / item.total) * 100 : 0;
        let claseProgreso = '';
        if (porcentajeDisponible === 0) claseProgreso = 'agotado';
        else if (porcentajeDisponible < 30) claseProgreso = 'bajo';

        return `
            <div class="disponibilidad-item">
                <div class="disponibilidad-header">
                    <span class="disponibilidad-nombre">${item.nombre}</span>
                    <span class="disponibilidad-numeros">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        ${item.disponible} / ${item.total} disponibles
                    </span>
                </div>
                <div class="disponibilidad-barra">
                    <div class="disponibilidad-progreso ${claseProgreso}" style="width: ${porcentajeDisponible}%"></div>
                </div>
                ${item.enUso > 0 ? `<div class="disponibilidad-en-uso">${item.enUso} piezas en uso</div>` : ''}
            </div>
        `;
    }).join('');

    contenedor.innerHTML = html;
}
