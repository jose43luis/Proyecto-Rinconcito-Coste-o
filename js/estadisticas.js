// estadisticas.js - Estadísticas y reportes del negocio

// Variables globales
let periodoActual = {
    tipo: 'mes-actual',
    inicio: null,
    fin: null
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de estadísticas cargada');
    inicializarPeriodo();
    llenarSelectAnos();
    await cargarEstadisticas();
});

// Inicializar período actual
function inicializarPeriodo() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    periodoActual.inicio = primerDia;
    periodoActual.fin = ultimoDia;
}

// Llenar select de años
function llenarSelectAnos() {
    const selectAnoInline = document.getElementById('select-ano-inline');
    const anoActual = new Date().getFullYear();
    
    // Llenar select inline
    for (let ano = anoActual; ano >= anoActual - 5; ano--) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAnoInline.appendChild(option);
    }

    // Seleccionar año actual
    selectAnoInline.value = anoActual;
    
    // Seleccionar mes actual
    const mesActual = new Date().getMonth() + 1;
    document.getElementById('select-mes-inline').value = mesActual;
}

// Cargar estadísticas con período personalizado desde selectores inline
function cargarEstadisticasPersonalizadas() {
    const ano = parseInt(document.getElementById('select-ano-inline').value);
    const mes = parseInt(document.getElementById('select-mes-inline').value) - 1; // 0-indexed

    periodoActual.inicio = new Date(ano, mes, 1);
    periodoActual.fin = new Date(ano, mes + 1, 0);
    periodoActual.tipo = 'personalizado';

    cargarEstadisticas();
}

// Cargar estadísticas desde Supabase SOLAMENTE
async function cargarEstadisticas() {
    try {
        const fechaInicio = periodoActual.inicio.toISOString().split('T')[0];
        const fechaFin = periodoActual.fin.toISOString().split('T')[0];

        if (typeof supabase === 'undefined') {
            console.warn('Supabase no configurado.');
            // Mostrar ceros si no hay datos
            calcularEstadisticas([], []);
            calcularRankings([], []);
            return;
        }

        // Cargar pedidos del período
        const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select(`
                *,
                pedido_items (
                    *,
                    productos (nombre)
                )
            `)
            .gte('fecha_evento', fechaInicio)
            .lte('fecha_evento', fechaFin);

        if (pedidosError) throw pedidosError;

        // Cargar eventos del salón del período
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_salon')
            .select('*')
            .gte('fecha_evento', fechaInicio)
            .lte('fecha_evento', fechaFin);

        if (eventosError) throw eventosError;

        // Calcular estadísticas
        calcularEstadisticas(pedidos || [], eventos || []);
        calcularRankings(pedidos || [], eventos || []);

        console.log('Estadísticas cargadas:', { pedidos: pedidos?.length || 0, eventos: eventos?.length || 0 });

    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        // Mostrar ceros en caso de error
        calcularEstadisticas([], []);
        calcularRankings([], []);
    }
}

// Calcular estadísticas principales
function calcularEstadisticas(pedidos, eventos) {
    // Total de pedidos (pedidos + eventos)
    const totalPedidos = pedidos.length + eventos.length;

    // Ingresos totales
    const ingresosPedidos = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const ingresosEventos = eventos.reduce((sum, e) => sum + (e.precio || 0), 0);
    const ingresosTotal = ingresosPedidos + ingresosEventos;

    // Ticket promedio
    const ticketPromedio = totalPedidos > 0 ? ingresosTotal / totalPedidos : 0;

    // Actualizar UI
    document.getElementById('total-pedidos').textContent = totalPedidos;
    document.getElementById('ingresos-totales').textContent = formatCurrency(ingresosTotal);
    document.getElementById('ticket-promedio').textContent = formatCurrency(ticketPromedio);

    // Calcular tasa de crecimiento (comparar con período anterior)
    calcularTasaCrecimiento(totalPedidos);
}

// Calcular tasa de crecimiento
async function calcularTasaCrecimiento(totalActual) {
    try {
        // Calcular período anterior
        const duracion = periodoActual.fin - periodoActual.inicio;
        const inicioAnterior = new Date(periodoActual.inicio.getTime() - duracion);
        const finAnterior = new Date(periodoActual.fin.getTime() - duracion);

        const fechaInicioAnt = inicioAnterior.toISOString().split('T')[0];
        const fechaFinAnt = finAnterior.toISOString().split('T')[0];

        if (typeof supabase === 'undefined') {
            document.getElementById('tasa-crecimiento').textContent = '+0%';
            return;
        }

        // Contar pedidos del período anterior
        const { count: pedidosAnt } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .gte('fecha_evento', fechaInicioAnt)
            .lte('fecha_evento', fechaFinAnt);

        const { count: eventosAnt } = await supabase
            .from('eventos_salon')
            .select('*', { count: 'exact', head: true })
            .gte('fecha_evento', fechaInicioAnt)
            .lte('fecha_evento', fechaFinAnt);

        const totalAnterior = (pedidosAnt || 0) + (eventosAnt || 0);

        // Calcular porcentaje de crecimiento
        let crecimiento = 0;
        if (totalAnterior > 0) {
            crecimiento = ((totalActual - totalAnterior) / totalAnterior) * 100;
        }

        const elementoCrecimiento = document.getElementById('tasa-crecimiento');
        const elementoBadge = document.getElementById('badge-pedidos');

        if (crecimiento >= 0) {
            elementoCrecimiento.textContent = `+${crecimiento.toFixed(0)}%`;
            elementoCrecimiento.classList.add('stat-growth');
            elementoBadge.textContent = `+${crecimiento.toFixed(0)}% vs anterior`;
            elementoBadge.className = 'stat-badge badge-growth';
        } else {
            elementoCrecimiento.textContent = `${crecimiento.toFixed(0)}%`;
            elementoCrecimiento.classList.remove('stat-growth');
            elementoBadge.textContent = `${crecimiento.toFixed(0)}% vs anterior`;
            elementoBadge.className = 'stat-badge badge-decline';
        }

    } catch (error) {
        console.error('Error al calcular crecimiento:', error);
        document.getElementById('tasa-crecimiento').textContent = '+0%';
    }
}

// Calcular rankings
function calcularRankings(pedidos, eventos) {
    // Ranking de lugares
    const lugaresCont = {};
    pedidos.forEach(p => {
        const lugar = p.lugar || 'Sin especificar';
        if (!lugaresCont[lugar]) {
            lugaresCont[lugar] = { pedidos: 0, ingresos: 0 };
        }
        lugaresCont[lugar].pedidos++;
        lugaresCont[lugar].ingresos += p.total || 0;
    });

    const rankingLugares = Object.entries(lugaresCont)
        .map(([lugar, datos]) => ({ nombre: lugar, ...datos }))
        .sort((a, b) => b.pedidos - a.pedidos)
        .slice(0, 5);

    mostrarRankingLugares(rankingLugares);

    // Ranking de clientes
    const clientesCont = {};
    [...pedidos, ...eventos].forEach(item => {
        const cliente = item.cliente_nombre;
        if (!clientesCont[cliente]) {
            clientesCont[cliente] = { pedidos: 0, ingresos: 0 };
        }
        clientesCont[cliente].pedidos++;
        clientesCont[cliente].ingresos += item.total || item.precio || 0;
    });

    const rankingClientes = Object.entries(clientesCont)
        .map(([cliente, datos]) => ({ nombre: cliente, ...datos }))
        .sort((a, b) => b.pedidos - a.pedidos)
        .slice(0, 5);

    mostrarRankingClientes(rankingClientes);

    // Ranking de items más rentados
    const itemsCont = {};
    pedidos.forEach(pedido => {
        if (pedido.pedido_items) {
            pedido.pedido_items.forEach(item => {
                const nombre = item.productos?.nombre || 'Producto';
                if (!itemsCont[nombre]) {
                    itemsCont[nombre] = { veces: 0, cantidad: 0, ingresos: 0 };
                }
                itemsCont[nombre].veces++;
                itemsCont[nombre].cantidad += item.cantidad || 0;
                itemsCont[nombre].ingresos += item.subtotal || 0;
            });
        }
    });

    const rankingItems = Object.entries(itemsCont)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.veces - a.veces)
        .slice(0, 5);

    mostrarRankingItems(rankingItems);
}

// Mostrar ranking de lugares
function mostrarRankingLugares(ranking) {
    const contenedor = document.getElementById('ranking-lugares');

    if (ranking.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-ranking">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                </svg>
                <h4>Sin datos</h4>
                <p>No hay lugares registrados en este período</p>
            </div>
        `;
        return;
    }

    const html = `<div class="ranking-list">${ranking.map((lugar, index) => `
        <div class="ranking-item">
            <div class="ranking-number">${index + 1}</div>
            <div class="ranking-info">
                <div class="ranking-nombre">${lugar.nombre}</div>
                <div class="ranking-detalle">${lugar.pedidos} pedidos</div>
            </div>
            <div class="ranking-valor">${formatCurrency(lugar.ingresos)}</div>
        </div>
    `).join('')}</div>`;

    contenedor.innerHTML = html;
}

// Mostrar ranking de clientes
function mostrarRankingClientes(ranking) {
    const contenedor = document.getElementById('ranking-clientes');

    if (ranking.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-ranking">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <h4>Sin datos</h4>
                <p>No hay clientes registrados en este período</p>
            </div>
        `;
        return;
    }

    const html = `<div class="ranking-list">${ranking.map((cliente, index) => `
        <div class="ranking-item">
            <div class="ranking-number">${index + 1}</div>
            <div class="ranking-info">
                <div class="ranking-nombre">${cliente.nombre}</div>
                <div class="ranking-detalle">${cliente.pedidos} pedidos</div>
            </div>
            <div class="ranking-valor">${formatCurrency(cliente.ingresos)}</div>
        </div>
    `).join('')}</div>`;

    contenedor.innerHTML = html;
}

// Mostrar ranking de items
function mostrarRankingItems(ranking) {
    const contenedor = document.getElementById('ranking-items');

    if (ranking.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-ranking">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <h4>Sin datos</h4>
                <p>No hay productos rentados en este período</p>
            </div>
        `;
        return;
    }

    const html = ranking.map((item, index) => `
        <div class="item-rentado">
            <div class="ranking-number">${index + 1}</div>
            <div class="ranking-info">
                <div class="item-info-left">
                    <div class="ranking-nombre">${item.nombre}</div>
                </div>
                <div class="item-stats">
                    <div class="item-stat">
                        <span class="item-stat-label">Veces rentado</span>
                        <span class="item-stat-value">${item.veces}</span>
                    </div>
                    <div class="item-stat">
                        <span class="item-stat-label">Piezas totales</span>
                        <span class="item-stat-value">${item.cantidad}</span>
                    </div>
                    <div class="item-stat">
                        <span class="item-stat-label">Ingresos</span>
                        <span class="item-stat-value primary">${formatCurrency(item.ingresos)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    contenedor.innerHTML = html;
}

// Descargar reporte
function descargarReporte() {
    alert('Función de descarga en desarrollo.\n\nSe generará un PDF con:\n- Estadísticas del período\n- Rankings completos\n- Gráficos\n- Análisis detallado');
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
