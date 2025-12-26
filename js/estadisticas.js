// estadisticas.js - Estadísticas y reportes del negocio

let periodoActual = {
    tipo: 'mes-actual',
    inicio: null,
    fin: null
};

let cargando = false;

// Datos para el reporte
let datosReporte = {
    pedidos: [],
    eventos: [],
    rankingLugares: [],
    rankingClientes: [],
    rankingItems: []
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📊 Página de estadísticas cargada');
    
    try {
        inicializarPeriodo();
        llenarSelectAnos();
        await cargarEstadisticas();
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
    }
});

function inicializarPeriodo() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    periodoActual.inicio = primerDia;
    periodoActual.fin = ultimoDia;
    
    console.log('📅 Período inicial:', {
        inicio: primerDia.toLocaleDateString(),
        fin: ultimoDia.toLocaleDateString()
    });
}

function llenarSelectAnos() {
    const selectAnoInline = document.getElementById('select-ano-inline');
    const selectMesInline = document.getElementById('select-mes-inline');
    const anoActual = new Date().getFullYear();
    
    if (!selectAnoInline || !selectMesInline) {
        console.error('❌ No se encontraron los selectores');
        return;
    }
    
    selectAnoInline.innerHTML = '';
    // Años desde 2020 hasta 5 años en el futuro
    const anoInicio = 2020;
    const anoFin = anoActual + 5;
    
    for (let ano = anoFin; ano >= anoInicio; ano--) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAnoInline.appendChild(option);
    }
    selectAnoInline.value = anoActual;
    
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    selectMesInline.innerHTML = '';
    meses.forEach((mes, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = mes;
        selectMesInline.appendChild(option);
    });
    
    const mesActual = new Date().getMonth() + 1;
    selectMesInline.value = mesActual;
    
    selectAnoInline.addEventListener('change', cargarEstadisticasPersonalizadas);
    selectMesInline.addEventListener('change', cargarEstadisticasPersonalizadas);
    
    console.log('✅ Selectores inicializados');
}

function cargarEstadisticasPersonalizadas() {
    if (cargando) {
        console.warn('⏳ Ya hay una carga en proceso');
        return;
    }
    
    const ano = parseInt(document.getElementById('select-ano-inline').value);
    const mes = parseInt(document.getElementById('select-mes-inline').value) - 1;

    periodoActual.inicio = new Date(ano, mes, 1);
    periodoActual.fin = new Date(ano, mes + 1, 0);
    periodoActual.tipo = 'personalizado';

    console.log('📅 Período actualizado:', {
        inicio: periodoActual.inicio.toLocaleDateString(),
        fin: periodoActual.fin.toLocaleDateString()
    });

    cargarEstadisticas();
}

async function cargarEstadisticas() {
    if (cargando) {
        console.warn('⏳ Carga ya en proceso');
        return;
    }
    
    cargando = true;
    console.log('🔄 Cargando estadísticas...');
    
    try {
        const fechaInicio = periodoActual.inicio.toISOString().split('T')[0];
        const fechaFin = periodoActual.fin.toISOString().split('T')[0];

        console.log('🔍 Buscando datos entre:', fechaInicio, 'y', fechaFin);

        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase no disponible');
            mostrarEstadisticasVacias();
            return;
        }

        // Cargar pedidos SIN join problemático
        console.log('📦 Cargando pedidos...');
        const { data: pedidos, error: errorPedidos } = await supabase
            .from('pedidos')
            .select('*')
            .gte('fecha_evento', fechaInicio)
            .lte('fecha_evento', fechaFin);

        if (errorPedidos) {
            console.error('❌ Error al cargar pedidos:', errorPedidos);
            mostrarEstadisticasVacias();
            return;
        }

        // Cargar items por separado
        let pedidoItems = [];
        if (pedidos && pedidos.length > 0) {
            console.log('📦 Cargando items de pedidos...');
            const pedidoIds = pedidos.map(p => p.id);
            
            const { data: items, error: errorItems } = await supabase
                .from('pedido_items')
                .select('*')
                .in('pedido_id', pedidoIds);

            if (!errorItems && items) {
                pedidoItems = items;
            }
        }

        // Cargar productos
        console.log('📦 Cargando productos...');
        const { data: productos, error: errorProductos } = await supabase
            .from('productos')
            .select('id, nombre');

        if (errorProductos) {
            console.error('❌ Error al cargar productos:', errorProductos);
        }

        // Combinar datos manualmente
        const productosMap = {};
        if (productos) {
            productos.forEach(p => {
                productosMap[p.id] = p.nombre;
            });
        }

        // Agregar nombre de producto a cada item
        pedidoItems.forEach(item => {
            item.producto_nombre = productosMap[item.producto_id] || 'Producto';
        });

        // Agregar items a cada pedido
        const pedidosConItems = pedidos.map(pedido => ({
            ...pedido,
            pedido_items: pedidoItems.filter(item => item.pedido_id === pedido.id)
        }));

        // Cargar eventos del salón
        console.log('🏛️ Cargando eventos...');
        const { data: eventos, error: errorEventos } = await supabase
            .from('eventos_salon')
            .select('*')
            .gte('fecha_evento', fechaInicio)
            .lte('fecha_evento', fechaFin);

        if (errorEventos) {
            console.error('❌ Error al cargar eventos:', errorEventos);
        }

        const pedidosData = pedidosConItems || [];
        const eventosData = eventos || [];

        console.log('✅ Datos cargados:', { 
            pedidos: pedidosData.length, 
            items: pedidoItems.length,
            eventos: eventosData.length 
        });

        calcularEstadisticas(pedidosData, eventosData);
        calcularRankings(pedidosData, eventosData);
        await calcularTasaCrecimiento(pedidosData.length);

    } catch (error) {
        console.error('❌ Error general:', error);
        mostrarEstadisticasVacias();
    } finally {
        cargando = false;
        console.log('✅ Carga completada');
    }
}

function mostrarEstadisticasVacias() {
    document.getElementById('total-pedidos').textContent = '0';
    document.getElementById('ingresos-totales').textContent = '$0.00';
    document.getElementById('ticket-promedio').textContent = '$0.00';
    document.getElementById('tasa-crecimiento').textContent = '+0%';
    
    mostrarRankingLugares([]);
    mostrarRankingClientes([]);
    mostrarRankingItems([]);
}

function calcularEstadisticas(pedidos, eventos) {
    // Solo contar pedidos, NO eventos
    const totalPedidos = pedidos.length;
    const ingresosPedidos = pedidos.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const ingresosEventos = eventos.reduce((sum, e) => sum + (parseFloat(e.precio) || 0), 0);
    const ingresosTotal = ingresosPedidos + ingresosEventos;
    const ticketPromedio = totalPedidos > 0 ? ingresosPedidos / totalPedidos : 0;

    console.log('📊 Estadísticas:', { 
        totalPedidos, 
        ingresosTotal,
        ticketPromedio 
    });

    document.getElementById('total-pedidos').textContent = totalPedidos;
    document.getElementById('ingresos-totales').textContent = formatCurrency(ingresosTotal);
    document.getElementById('ticket-promedio').textContent = formatCurrency(ticketPromedio);
}

async function calcularTasaCrecimiento(totalActual) {
    try {
        const duracion = periodoActual.fin - periodoActual.inicio;
        const inicioAnterior = new Date(periodoActual.inicio.getTime() - duracion - (24 * 60 * 60 * 1000));
        const finAnterior = new Date(periodoActual.fin.getTime() - duracion);

        const fechaInicioAnt = inicioAnterior.toISOString().split('T')[0];
        const fechaFinAnt = finAnterior.toISOString().split('T')[0];

        if (typeof supabase === 'undefined') {
            document.getElementById('tasa-crecimiento').textContent = '+0%';
            return;
        }

        const { count: pedidosAnt } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .gte('fecha_evento', fechaInicioAnt)
            .lte('fecha_evento', fechaFinAnt);

        // Solo contar pedidos para el crecimiento, NO eventos
        const totalAnterior = pedidosAnt || 0;

        let crecimiento = 0;
        if (totalAnterior > 0) {
            crecimiento = ((totalActual - totalAnterior) / totalAnterior) * 100;
        } else if (totalActual > 0) {
            crecimiento = 100;
        }

        const texto = crecimiento >= 0 ? `+${crecimiento.toFixed(0)}%` : `${crecimiento.toFixed(0)}%`;
        
        document.getElementById('tasa-crecimiento').textContent = texto;
        document.getElementById('badge-pedidos').textContent = `${texto} vs anterior`;
        
        if (crecimiento >= 0) {
            document.getElementById('tasa-crecimiento').classList.add('stat-growth');
            document.getElementById('badge-pedidos').className = 'stat-badge badge-growth';
        } else {
            document.getElementById('tasa-crecimiento').classList.remove('stat-growth');
            document.getElementById('badge-pedidos').className = 'stat-badge badge-decline';
        }

    } catch (error) {
        console.error('❌ Error crecimiento:', error);
        document.getElementById('tasa-crecimiento').textContent = '+0%';
    }
}

function calcularRankings(pedidos, eventos) {
    // Lugares
    const lugaresCont = {};
    pedidos.forEach(p => {
        const lugar = p.lugar || 'Sin especificar';
        if (!lugaresCont[lugar]) lugaresCont[lugar] = { pedidos: 0, ingresos: 0 };
        lugaresCont[lugar].pedidos++;
        lugaresCont[lugar].ingresos += parseFloat(p.total) || 0;
    });

    const rankingLugares = Object.entries(lugaresCont)
        .map(([lugar, datos]) => ({ nombre: lugar, ...datos }))
        .sort((a, b) => b.pedidos - a.pedidos)
        .slice(0, 5);

    mostrarRankingLugares(rankingLugares);

    // Clientes
    const clientesCont = {};
    [...pedidos, ...eventos].forEach(item => {
        const cliente = item.cliente_nombre;
        if (!cliente) return;
        if (!clientesCont[cliente]) clientesCont[cliente] = { pedidos: 0, ingresos: 0 };
        clientesCont[cliente].pedidos++;
        clientesCont[cliente].ingresos += parseFloat(item.total || item.precio || 0);
    });

    const rankingClientes = Object.entries(clientesCont)
        .map(([cliente, datos]) => ({ nombre: cliente, ...datos }))
        .sort((a, b) => b.pedidos - a.pedidos)
        .slice(0, 5);

    mostrarRankingClientes(rankingClientes);

    // Items
    const itemsCont = {};
    pedidos.forEach(pedido => {
        if (!pedido.pedido_items) return;
        
        pedido.pedido_items
            .filter(item => !item.es_componente_juego)
            .forEach(item => {
                const nombre = item.producto_nombre || 'Producto';
                if (!itemsCont[nombre]) itemsCont[nombre] = { veces: 0, cantidad: 0, ingresos: 0 };
                itemsCont[nombre].veces++;
                itemsCont[nombre].cantidad += parseInt(item.cantidad) || 0;
                itemsCont[nombre].ingresos += parseFloat(item.subtotal) || 0;
            });
    });

    const rankingItems = Object.entries(itemsCont)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.veces - a.veces)
        .slice(0, 5);

    mostrarRankingItems(rankingItems);
    
    console.log('🏆 Rankings:', {
        lugares: rankingLugares.length,
        clientes: rankingClientes.length,
        items: rankingItems.length
    });
    
    // Guardar datos para el reporte
    datosReporte = {
        rankingLugares: rankingLugares,
        rankingClientes: rankingClientes,
        rankingItems: rankingItems,
        pedidos: pedidos,
        eventos: eventos
    };
}

function mostrarRankingLugares(ranking) {
    const contenedor = document.getElementById('ranking-lugares');
    if (!contenedor) return;

    if (ranking.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-ranking">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                </svg>
                <h4>Sin datos</h4>
                <p>No hay lugares registrados en este período</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = `<div class="ranking-list">${ranking.map((lugar, i) => `
        <div class="ranking-item">
            <div class="ranking-number">${i + 1}</div>
            <div class="ranking-info">
                <div class="ranking-nombre">${lugar.nombre}</div>
                <div class="ranking-detalle">${lugar.pedidos} pedidos</div>
            </div>
            <div class="ranking-valor">${formatCurrency(lugar.ingresos)}</div>
        </div>
    `).join('')}</div>`;
}

function mostrarRankingClientes(ranking) {
    const contenedor = document.getElementById('ranking-clientes');
    if (!contenedor) return;

    if (ranking.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-ranking">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <h4>Sin datos</h4>
                <p>No hay clientes registrados en este período</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = `<div class="ranking-list">${ranking.map((cliente, i) => `
        <div class="ranking-item">
            <div class="ranking-number">${i + 1}</div>
            <div class="ranking-info">
                <div class="ranking-nombre">${cliente.nombre}</div>
                <div class="ranking-detalle">${cliente.pedidos} pedidos</div>
            </div>
            <div class="ranking-valor">${formatCurrency(cliente.ingresos)}</div>
        </div>
    `).join('')}</div>`;
}

function mostrarRankingItems(ranking) {
    const contenedor = document.getElementById('ranking-items');
    if (!contenedor) return;

    if (ranking.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-ranking">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <h4>Sin datos</h4>
                <p>No hay productos rentados en este período</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = ranking.map((item, i) => `
        <div class="item-rentado">
            <div class="ranking-number">${i + 1}</div>
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
}

// Generar y descargar reporte en PDF
async function descargarReporte() {
    try {
        console.log('📄 Generando reporte PDF...');
        if (typeof window.jspdf === 'undefined') {
            console.log('⌛ Cargando jsPDF...');
            await cargarJsPDF();
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const azulOscuro = [12, 123, 179];
        const grisOscuro = [60, 60, 60];
        
        // ENCABEZADO
        doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE ESTADÍSTICAS', 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('El Rinconcito Costeño', 105, 23, { align: 'center' });
        
        const mesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio','Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mes = mesNombres[periodoActual.inicio.getMonth()];
        const ano = periodoActual.inicio.getFullYear();
        doc.setFontSize(11);
        doc.text(`Período: ${mes} ${ano}`, 105, 30, { align: 'center' });
        const hoy = new Date();
        const fechaGen = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
        doc.setFontSize(9);
        doc.text(`Generado: ${fechaGen}`, 105, 36, { align: 'center' });
        
        let yPos = 50;
        doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN EJECUTIVO', 20, yPos);
        yPos += 8;
        
        const stats = [
            ['Total de Pedidos', document.getElementById('total-pedidos').textContent],
            ['Ingresos Totales', document.getElementById('ingresos-totales').textContent],
            ['Ticket Promedio', document.getElementById('ticket-promedio').textContent],
            ['Crecimiento', document.getElementById('tasa-crecimiento').textContent]
        ];
        
        stats.forEach((stat, i) => {
            const bgColor = i % 2 === 0 ? [248, 248, 248] : [255, 255, 255];
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.rect(20, yPos, 170, 8, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(stat[0], 25, yPos + 5);
            doc.setFont('helvetica', 'bold');
            doc.text(stat[1], 180, yPos + 5, { align: 'right' });
            yPos += 8;
        });
        
        yPos += 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('LUGARES MÁS RENTADOS', 20, yPos);
        yPos += 8;
        
        if (datosReporte.rankingLugares.length > 0) {
            doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
            doc.rect(20, yPos, 170, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('#', 25, yPos + 5);
            doc.text('Lugar', 35, yPos + 5);
            doc.text('Pedidos', 120, yPos + 5);
            doc.text('Ingresos', 175, yPos + 5, { align: 'right' });
            yPos += 8;
            
            doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
            datosReporte.rankingLugares.slice(0, 5).forEach((lugar, i) => {
                const bgColor = i % 2 === 0 ? [248, 248, 248] : [255, 255, 255];
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(20, yPos, 170, 7, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`${i + 1}`, 25, yPos + 5);
                doc.text(lugar.nombre.substring(0, 35), 35, yPos + 5);
                doc.text(`${lugar.pedidos}`, 120, yPos + 5);
                doc.text(formatCurrency(lugar.ingresos), 175, yPos + 5, { align: 'right' });
                yPos += 7;
            });
        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles', 25, yPos + 5);
            yPos += 10;
        }
        
        yPos += 10;
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTES FRECUENTES', 20, yPos);
        yPos += 8;
        
        if (datosReporte.rankingClientes.length > 0) {
            doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
            doc.rect(20, yPos, 170, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('#', 25, yPos + 5);
            doc.text('Cliente', 35, yPos + 5);
            doc.text('Pedidos', 120, yPos + 5);
            doc.text('Ingresos', 175, yPos + 5, { align: 'right' });
            yPos += 8;
            
            doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
            datosReporte.rankingClientes.slice(0, 10).forEach((cliente, i) => {
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                const bgColor = i % 2 === 0 ? [248, 248, 248] : [255, 255, 255];
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(20, yPos, 170, 7, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`${i + 1}`, 25, yPos + 5);
                doc.text(cliente.nombre.substring(0, 35), 35, yPos + 5);
                doc.text(`${cliente.pedidos}`, 120, yPos + 5);
                doc.text(formatCurrency(cliente.ingresos), 175, yPos + 5, { align: 'right' });
                yPos += 7;
            });
        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles', 25, yPos + 5);
            yPos += 10;
        }
        
        if (datosReporte.rankingItems.length > 0) {
            doc.addPage();
            yPos = 20;
            doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('PRODUCTOS MÁS RENTADOS', 20, yPos);
            yPos += 8;
            
            doc.setFillColor(azulOscuro[0], azulOscuro[1], azulOscuro[2]);
            doc.rect(20, yPos, 170, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('#', 25, yPos + 5);
            doc.text('Producto', 35, yPos + 5);
            doc.text('Veces', 110, yPos + 5);
            doc.text('Piezas', 135, yPos + 5);
            doc.text('Ingresos', 175, yPos + 5, { align: 'right' });
            yPos += 8;
            
            doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
            datosReporte.rankingItems.forEach((item, i) => {
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                const bgColor = i % 2 === 0 ? [248, 248, 248] : [255, 255, 255];
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(20, yPos, 170, 7, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`${i + 1}`, 25, yPos + 5);
                doc.text(item.nombre.substring(0, 30), 35, yPos + 5);
                doc.text(`${item.veces}`, 110, yPos + 5);
                doc.text(`${item.cantidad}`, 135, yPos + 5);
                doc.text(formatCurrency(item.ingresos), 175, yPos + 5, { align: 'right' });
                yPos += 7;
            });
        }
        
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);
            doc.text(`Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
            doc.text('El Rinconcito Costeño - Reporte Confidencial', 105, 285, { align: 'center' });
        }
        
        const nombreArchivo = `Reporte_${mes}_${ano}.pdf`;
        doc.save(nombreArchivo);
        console.log('✅ Reporte generado:', nombreArchivo);
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al generar reporte: ' + error.message);
    }
}

function cargarJsPDF() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined') { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => { console.log('✅ jsPDF cargado'); resolve(); };
        script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
        document.head.appendChild(script);
    });
}
