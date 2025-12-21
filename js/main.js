// Configuración y funciones principales

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

// Función para formatear números como moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

// Función para formatear fechas (usando zona horaria de México)
function formatDate(date) {
    return formatearFechaSegura(date);
}

// Función de logout
function logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        // Aquí irá la lógica de logout con Supabase
        // await supabase.auth.signOut();
        alert('Sesión cerrada exitosamente');
        window.location.href = 'login.html';
    }
}

// Cargar estadísticas del dashboard con datos REALES desde Supabase SOLAMENTE
async function loadDashboardStats() {
    try {
        const TZ = window.TimezoneMexico;
        const hoy = TZ ? TZ.obtenerFechaHoraMexico() : new Date();
        const rangoMes = TZ ? TZ.rangoMesActual() : {
            inicio: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0],
            fin: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
        };
        const primerDiaMes = rangoMes.inicio;
        const ultimoDiaMes = rangoMes.fin;
        const proximosSieteDias = new Date(hoy);
        proximosSieteDias.setDate(proximosSieteDias.getDate() + 7);

        let stats = {
            pedidosMes: 0,
            ingresosMes: 0,
            itemsInventario: 0,
            eventosProximos: 0
        };

        if (typeof supabase !== 'undefined') {
            // Obtener pedidos del mes
            const { data: pedidos, error: pedidosError } = await supabase
                .from('pedidos')
                .select('total')
                .gte('fecha_evento', primerDiaMes)
                .lte('fecha_evento', ultimoDiaMes);

            if (!pedidosError && pedidos) {
                stats.pedidosMes = pedidos.length;
                stats.ingresosMes = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
            }

            // Obtener eventos del salón del mes
            const { data: eventos, error: eventosError } = await supabase
                .from('eventos_salon')
                .select('precio')
                .gte('fecha_evento', primerDiaMes)
                .lte('fecha_evento', ultimoDiaMes);

            if (!eventosError && eventos) {
                stats.ingresosMes += eventos.reduce((sum, e) => sum + (e.precio || 0), 0);
            }

            // Obtener stock total de inventario
            const { data: productos, error: productosError } = await supabase
                .from('productos')
                .select('stock_disponible');

            if (!productosError && productos) {
                stats.itemsInventario = productos.reduce((sum, p) => sum + (p.stock_disponible || 0), 0);
            }

            // Obtener colores de productos
            const { data: colores, error: coloresError } = await supabase
                .from('producto_colores')
                .select('stock_disponible');

            if (!coloresError && colores) {
                stats.itemsInventario += colores.reduce((sum, c) => sum + (c.stock_disponible || 0), 0);
            }

            // Obtener eventos próximos (siguientes 7 días)
            const fechaHoy = TZ ? TZ.formatearFechaInput(hoy) : hoy.toISOString().split('T')[0];
            const fechaProxima = TZ ? TZ.formatearFechaInput(proximosSieteDias) : proximosSieteDias.toISOString().split('T')[0];
            
            const { data: eventosProximos, error: eventosProximosError } = await supabase
                .from('pedidos')
                .select('id')
                .gte('fecha_evento', fechaHoy)
                .lte('fecha_evento', fechaProxima)
                .in('estado', ['proximo', 'entregado']);

            if (!eventosProximosError && eventosProximos) {
                stats.eventosProximos = eventosProximos.length;
            }

            // Sumar eventos del salón próximos
            const { data: salonProximos, error: salonProximosError } = await supabase
                .from('eventos_salon')
                .select('id')
                .gte('fecha_evento', fechaHoy)
                .lte('fecha_evento', fechaProxima);

            if (!salonProximosError && salonProximos) {
                stats.eventosProximos += salonProximos.length;
            }

            console.log('✓ Estadísticas cargadas desde Supabase');
        } else {
            // SIN DATOS SI SUPABASE NO ESTÁ CONFIGURADO - TODOS EN CERO
            console.warn('⚠ Supabase no configurado - Mostrando ceros');
        }

        // Actualizar el DOM
        if (document.getElementById('pedidos-mes')) {
            document.getElementById('pedidos-mes').textContent = stats.pedidosMes;
        }
        if (document.getElementById('ingresos-mes')) {
            document.getElementById('ingresos-mes').textContent = formatCurrency(stats.ingresosMes);
        }
        if (document.getElementById('items-inventario')) {
            document.getElementById('items-inventario').textContent = stats.itemsInventario.toLocaleString('es-MX');
        }
        if (document.getElementById('eventos-proximos')) {
            document.getElementById('eventos-proximos').textContent = stats.eventosProximos;
        }

        console.log('📊 Estadísticas actualizadas:', stats);
    } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error);
        // En caso de error, mostrar ceros
        if (document.getElementById('pedidos-mes')) document.getElementById('pedidos-mes').textContent = '0';
        if (document.getElementById('ingresos-mes')) document.getElementById('ingresos-mes').textContent = '$0';
        if (document.getElementById('items-inventario')) document.getElementById('items-inventario').textContent = '0';
        if (document.getElementById('eventos-proximos')) document.getElementById('eventos-proximos').textContent = '0';
    }
}

// Cargar actividad reciente desde Supabase SOLAMENTE
async function loadRecentActivity() {
    try {
        const contenedor = document.getElementById('activity-list');
        if (!contenedor) return;

        if (typeof supabase === 'undefined') {
            console.warn('⚠ Supabase no configurado - Actividad reciente no disponible');
            contenedor.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3>Sin actividad reciente</h3>
                    <p>No hay pedidos ni eventos registrados aún</p>
                </div>
            `;
            return;
        }

        // Obtener últimos 3 pedidos
        const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select(`
                *,
                pedido_items (
                    cantidad,
                    productos (nombre)
                )
            `)
            .order('created_at', { ascending: false })
            .limit(3);

        // Obtener últimos 2 eventos del salón
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_salon')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2);

        if (pedidosError) throw pedidosError;
        if (eventosError) throw eventosError;

        const actividades = [];

        // Agregar pedidos
        if (pedidos && pedidos.length > 0) {
            pedidos.forEach(pedido => {
                const descripcion = pedido.pedido_items && pedido.pedido_items.length > 0 ?
                    pedido.pedido_items.map(item => 
                        `${item.cantidad} ${item.productos.nombre}`
                    ).join(', ') : 'Mobiliario';

                actividades.push({
                    tipo: 'pedido',
                    cliente: pedido.cliente_nombre,
                    descripcion: descripcion,
                    fecha: pedido.fecha_evento,
                    hora: pedido.hora_evento,
                    estado: pedido.estado || 'proximo',
                    created_at: pedido.created_at
                });
            });
        }

        // Agregar eventos del salón
        if (eventos && eventos.length > 0) {
            eventos.forEach(evento => {
                actividades.push({
                    tipo: 'salon',
                    cliente: evento.cliente_nombre,
                    descripcion: `Evento Salón${evento.tipo_evento ? ' - ' + evento.tipo_evento : ''}`,
                    fecha: evento.fecha_evento,
                    hora: evento.hora_inicio,
                    estado: evento.pagado ? 'pagado' : (evento.anticipo > 0 ? 'anticipo' : 'pendiente'),
                    created_at: evento.created_at
                });
            });
        }

        // Ordenar por fecha de creación
        actividades.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Tomar solo los primeros 5
        const actividadesRecientes = actividades.slice(0, 5);

        if (actividadesRecientes.length === 0) {
            contenedor.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3>Sin actividad reciente</h3>
                    <p>No hay pedidos ni eventos registrados aún</p>
                </div>
            `;
            return;
        }

        // Generar HTML
        const html = actividadesRecientes.map(actividad => {
            const badgeClass = actividad.estado === 'pagado' ? 'badge-pagado' : 
                              actividad.estado === 'confirmado' ? 'badge-confirmado' : 
                              actividad.estado === 'anticipo' ? 'badge-anticipo' : 
                              'badge-pendiente';

            const badgeText = actividad.estado === 'pagado' ? 'pagado' : 
                            actividad.estado === 'confirmado' ? 'confirmado' : 
                            actividad.estado === 'anticipo' ? 'anticipo' : 
                            actividad.estado === 'proximo' ? 'próximo' : 'pendiente';

            const fechaHoraTexto = actividad.hora ? 
                `${formatearFechaSegura(actividad.fecha)} a las ${formatearHoraSegura(actividad.hora)}` :
                formatearFechaSegura(actividad.fecha);

            return `
                <div class="activity-item">
                    <div class="activity-content">
                        <div class="activity-header">
                            <h4>${actividad.cliente}</h4>
                            <span class="badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <p class="activity-description">${actividad.descripcion}</p>
                        <div class="activity-date">${fechaHoraTexto}</div>
                    </div>
                </div>
            `;
        }).join('');

        contenedor.innerHTML = html;

        console.log('✓ Actividad reciente cargada:', actividadesRecientes.length, 'items');
    } catch (error) {
        console.error('❌ Error al cargar actividad reciente:', error);
        const contenedor = document.getElementById('activity-list');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <h3>Error al cargar actividad</h3>
                    <p>Intenta recargar la página</p>
                </div>
            `;
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema El Rinconcito Costeño iniciado');
    
    // Cargar datos si estamos en el dashboard
    if (document.getElementById('pedidos-mes')) {
        loadDashboardStats();
        loadRecentActivity();
    }
});

// Exportar funciones para uso global
window.logout = logout;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
