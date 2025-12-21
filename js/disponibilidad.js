// disponibilidad.js - Consulta de disponibilidad de mobiliario

// Variables globales
let fechaActual = new Date();
let fechaSeleccionada = new Date();
let pedidosDia = [];
let eventosDia = [];

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('Página de disponibilidad cargada');
    generarCalendario();
    cargarDisponibilidadDia();
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
            console.warn('Supabase no configurado.');
            pedidosDia = [];
            eventosDia = [];
            mostrarPedidosDia();
            mostrarDisponibilidad([]);
            return;
        }

        // Cargar pedidos del día
        const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select(`
                *,
                pedido_items (
                    *,
                    productos (nombre)
                )
            `)
            .eq('fecha_evento', fechaStr);

        if (pedidosError) throw pedidosError;

        // Cargar eventos del salón del día
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_salon')
            .select('*')
            .eq('fecha_evento', fechaStr);

        if (eventosError) throw eventosError;

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
            .select('*')
            .eq('es_juego', false)
            .order('nombre');

        if (productosError) throw productosError;

        console.log('📅 Calculando disponibilidad para:', fecha);
        console.log(`📦 Productos a calcular: ${productos.length}`);

        // Usar la función helper para calcular disponibilidad con juegos
        const disponibilidad = await calcularDisponibilidadConJuegos(fecha, productos);

        console.log('✅ Disponibilidad calculada:', disponibilidad.length);

        // Formatear para mostrar
        const disponibilidadFormateada = disponibilidad.map(prod => ({
            nombre: prod.nombre,
            disponible: prod.disponible,
            total: prod.stock_total || prod.stock_disponible || 0,
            enUso: prod.en_uso
        }));

        mostrarDisponibilidad(disponibilidadFormateada);

    } catch (error) {
        console.error('Error al calcular disponibilidad:', error);
        mostrarDisponibilidad([]);
    }
}

// Mostrar disponibilidad
function mostrarDisponibilidad(items) {
    const contenedor = document.getElementById('disponibilidad-inventario');

    if (!items || items.length === 0) {
        contenedor.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 2rem;">No hay datos de inventario</p>';
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
