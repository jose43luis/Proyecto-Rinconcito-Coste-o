// salon.js - Gestión de Eventos del Salón

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
    const year = fechaMexico.getFullYear();
    const month = String(fechaMexico.getMonth() + 1).padStart(2, '0');
    const day = String(fechaMexico.getDate()).padStart(2, '0');
    const hours = String(fechaMexico.getHours()).padStart(2, '0');
    const minutes = String(fechaMexico.getMinutes()).padStart(2, '0');
    const seconds = String(fechaMexico.getSeconds()).padStart(2, '0');
    const milliseconds = String(fechaMexico.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Variables globales
let eventosData = [];
let eventosFiltrados = [];
let filtroActual = 'todos';
let busquedaActual = '';
let paginaActual = 1;
let eventosPorPagina = 10;
let eventoActualId = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de eventos del salón cargada');
    
    // Establecer precio por defecto
    const precioInput = document.getElementById('precio-renta');
    if (precioInput) {
        precioInput.value = '5000.00';
    }
    
    await cargarEventos();
});

// Mostrar formulario de nuevo evento
function mostrarFormulario() {
    document.getElementById('modal-nuevo-evento').classList.add('active');
    // Resetear formulario
    document.getElementById('form-evento').reset();
    document.getElementById('precio-renta').value = '5000.00';
    document.getElementById('anticipo-container').style.display = 'block';
    actualizarResumenEvento();
}

// Cerrar modal de nuevo evento
function cerrarModalNuevoEvento() {
    document.getElementById('modal-nuevo-evento').classList.remove('active');
    document.getElementById('form-evento').reset();
}

// Cargar eventos desde Supabase SOLAMENTE
async function cargarEventos() {
    try {
        const contenedor = document.getElementById('contenedor-eventos');
        if (!contenedor) return;

        contenedor.innerHTML = '<div class="loading-eventos"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48"><circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-width="4" stroke="currentColor" fill="none"/></svg><p>Cargando eventos...</p></div>';

        if (typeof supabase === 'undefined') {
            console.warn('Supabase no está configurado.');
            eventosData = [];
            aplicarFiltrosYMostrar();
            return;
        }

        const { data: eventos, error } = await supabase
            .from('eventos_salon')
            .select('*')
            .order('fecha_evento', { ascending: true });

        if (error) throw error;

        eventosData = eventos || [];
        aplicarFiltrosYMostrar();
        console.log('Eventos cargados:', eventosData.length);
    } catch (error) {
        console.error('Error al cargar eventos:', error);
        eventosData = [];
        aplicarFiltrosYMostrar();
    }
}

// Aplicar filtros y mostrar
function aplicarFiltrosYMostrar() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    eventosFiltrados = eventosData.filter(evento => {
        const fechaEvento = new Date(evento.fecha_evento);
        fechaEvento.setHours(0, 0, 0, 0);
        
        // Aplicar filtro de estado
        let cumpleFiltro = true;
        if (filtroActual === 'proximos') {
            cumpleFiltro = fechaEvento >= hoy && evento.estado === 'confirmado';
        } else if (filtroActual === 'hoy') {
            cumpleFiltro = fechaEvento.getTime() === hoy.getTime();
        } else if (filtroActual === 'finalizados') {
            cumpleFiltro = fechaEvento < hoy || evento.estado === 'finalizado';
        }

        // Aplicar búsqueda
        if (busquedaActual && cumpleFiltro) {
            const busqueda = busquedaActual.toLowerCase();
            cumpleFiltro = evento.cliente_nombre.toLowerCase().includes(busqueda);
        }

        return cumpleFiltro;
    });

    paginaActual = 1;
    mostrarEventos();
}

// Mostrar eventos con paginación
function mostrarEventos() {
    const contenedor = document.getElementById('contenedor-eventos');
    if (!contenedor) return;

    if (eventosFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <h3>No hay eventos registrados</h3>
                <p>Comienza agregando tu primer evento del salón</p>
                <button class="btn btn-primary" onclick="mostrarFormulario()">Crear Evento</button>
            </div>
        `;
        document.getElementById('paginacion-container').innerHTML = '';
        return;
    }

    // Calcular eventos para la página actual
    const inicio = (paginaActual - 1) * eventosPorPagina;
    const fin = inicio + eventosPorPagina;
    const eventosPagina = eventosFiltrados.slice(inicio, fin);

    // Generar HTML
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const html = eventosPagina.map(evento => {
        const fechaEvento = new Date(evento.fecha_evento);
        fechaEvento.setHours(0, 0, 0, 0);
        
        return crearCardEvento(evento, fechaEvento, hoy);
    }).join('');

    contenedor.innerHTML = html;
    actualizarPaginacion();
}

// Crear card de evento
function crearCardEvento(evento, fechaEvento, hoy) {
    const esHoy = fechaEvento.getTime() === hoy.getTime();
    const esProximo = fechaEvento > hoy;
    const esPasado = fechaEvento < hoy;

    let claseEstado = '';
    if (esHoy) claseEstado = 'evento-hoy';
    else if (esProximo) claseEstado = 'evento-proximo';
    else if (esPasado) claseEstado = 'evento-pasado';

    // Badge de pago
    let badgePago = '';
    if (evento.pagado) {
        badgePago = '<span class="badge badge-pagado">Pagado</span>';
    } else if (evento.anticipo > 0) {
        badgePago = '<span class="badge badge-anticipo">Anticipo</span>';
    } else {
        badgePago = '<span class="badge badge-pendiente">Pendiente</span>';
    }

    // Badge de tipo
    const badgeTipo = evento.tipo_evento ? `<span class="badge badge-tipo">${evento.tipo_evento}</span>` : '';

    // Fecha formateada
    const fechaFormateada = formatearFechaSegura(evento.fecha_evento);

    return `
        <div class="evento-card ${claseEstado}">
            <div class="evento-header">
                <div>
                    <h3 class="evento-cliente">${evento.cliente_nombre}</h3>
                    <div class="evento-badges">
                        ${badgePago}
                        ${badgeTipo}
                    </div>
                </div>
                <div class="evento-precio">${formatCurrency(evento.precio || 0)}</div>
            </div>

            <div class="evento-info">
                <div class="info-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>${fechaFormateada}</span>
                </div>

                <div class="info-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>${formatearHoraSegura(evento.hora_inicio)}</span>
                </div>

                ${evento.num_invitados ? `
                <div class="info-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <span>${evento.num_invitados} invitados</span>
                </div>
                ` : ''}

                ${evento.cliente_telefono ? `
                <div class="info-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <span>${evento.cliente_telefono}</span>
                </div>
                ` : ''}

                ${evento.condiciones ? `
                <div class="evento-condiciones">
                    <strong>Condiciones:</strong> ${evento.condiciones}
                </div>
                ` : ''}
            </div>

            <div class="evento-actions">
                <button class="btn btn-secondary" onclick="verDetallesEvento('${evento.id}')">Ver Detalles</button>
                <button class="btn btn-outline" onclick="descargarNota('${evento.id}')">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Descargar Nota
                </button>
            </div>
        </div>
    `;
}

// Actualizar paginación
function actualizarPaginacion() {
    const contenedor = document.getElementById('paginacion-container');
    if (!contenedor) return;

    const totalPaginas = Math.ceil(eventosFiltrados.length / eventosPorPagina);

    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        return;
    }

    let html = `
        <div class="paginacion">
            <button class="btn-paginacion" onclick="cambiarPagina(${paginaActual - 1})" ${paginaActual === 1 ? 'disabled' : ''}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Anterior
            </button>

            <div class="paginacion-numeros">
    `;

    // Mostrar números de página
    const rango = 2;
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaActual - rango && i <= paginaActual + rango)) {
            html += `<button class="btn-numero ${i === paginaActual ? 'active' : ''}" onclick="cambiarPagina(${i})">${i}</button>`;
        } else if (i === paginaActual - rango - 1 || i === paginaActual + rango + 1) {
            html += '<span class="paginacion-dots">...</span>';
        }
    }

    html += `
            </div>

            <button class="btn-paginacion" onclick="cambiarPagina(${paginaActual + 1})" ${paginaActual === totalPaginas ? 'disabled' : ''}>
                Siguiente
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
        </div>

        <div class="paginacion-info">
            Página ${paginaActual} de ${totalPaginas} (${eventosFiltrados.length} eventos)
        </div>
    `;

    contenedor.innerHTML = html;
}

// Cambiar página
function cambiarPagina(nuevaPagina) {
    const totalPaginas = Math.ceil(eventosFiltrados.length / eventosPorPagina);
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    
    paginaActual = nuevaPagina;
    mostrarEventos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Filtrar eventos
function filtrarEventos(filtro, event) {
    filtroActual = filtro;
    
    // Actualizar UI de tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (event) {
        event.target.classList.add('active');
    }
    
    aplicarFiltrosYMostrar();
}

// Buscar eventos
function buscarEventos() {
    busquedaActual = document.getElementById('buscar-eventos').value;
    aplicarFiltrosYMostrar();
}

// Guardar evento
async function guardarEvento() {
    try {
        console.log('Iniciando guardado de evento...');
        
        // Obtener valores del formulario
        const clienteNombre = document.getElementById('cliente-nombre-evento')?.value.trim() || '';
        const clienteTelefono = document.getElementById('cliente-telefono-evento')?.value.trim() || '';
        const fechaEvento = document.getElementById('fecha-evento')?.value || '';
        const horaInicio = document.getElementById('hora-inicio')?.value || '';
        const tipoEvento = document.getElementById('tipo-evento')?.value || '';
        const numInvitados = parseInt(document.getElementById('num-invitados')?.value) || null;
        const precio = parseFloat(document.getElementById('precio-renta')?.value) || 5000;
        const pagado = document.getElementById('evento-pagado')?.checked || false;
        const anticipo = pagado ? 0 : (parseFloat(document.getElementById('anticipo-evento')?.value) || 0);
        const condiciones = document.getElementById('condiciones-evento')?.value.trim() || '';
        const notas = document.getElementById('comentarios-evento')?.value.trim() || '';

        console.log('Datos del formulario:', {
            clienteNombre,
            clienteTelefono,
            fechaEvento,
            horaInicio,
            tipoEvento,
            numInvitados,
            precio,
            pagado,
            anticipo,
            condiciones,
            notas
        });

        // Validar campos requeridos
        if (!clienteNombre) {
            alert('Por favor ingresa el nombre del cliente');
            document.getElementById('cliente-nombre-evento').focus();
            return;
        }

        if (!fechaEvento) {
            alert('Por favor selecciona la fecha del evento');
            document.getElementById('fecha-evento').focus();
            return;
        }

        if (!horaInicio) {
            alert('Por favor ingresa la hora de inicio');
            document.getElementById('hora-inicio').focus();
            return;
        }

        // Verificar que Supabase esté disponible
        if (typeof supabase === 'undefined') {
            alert('Error: Supabase no está configurado. No se puede guardar el evento.');
            console.error('Supabase no está definido');
            return;
        }

        console.log('Intentando guardar en Supabase...');

        // Preparar datos para insertar
        const eventoData = {
            cliente_nombre: clienteNombre,
            cliente_telefono: clienteTelefono || null,
            fecha_evento: fechaEvento,
            hora_inicio: horaInicio,
            tipo_evento: tipoEvento || null,
            num_invitados: numInvitados,
            precio: precio,
            pagado: pagado,
            anticipo: anticipo,
            condiciones: condiciones || null,
            notas: notas || null,
            estado: 'confirmado'
        };

        console.log('Datos a insertar:', eventoData);

        // Insertar en Supabase
        const { data, error } = await supabase
            .from('eventos_salon')
            .insert([eventoData])
            .select();

        if (error) {
            console.error('Error de Supabase:', error);
            throw error;
        }

        console.log('Evento guardado exitosamente:', data);
        alert('✅ Evento guardado exitosamente');
        
        // Cerrar modal y recargar eventos
        cerrarModalNuevoEvento();
        await cargarEventos();

    } catch (error) {
        console.error('❌ Error completo al guardar evento:', error);
        console.error('Detalles del error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        alert(`Error al guardar el evento: ${error.message || 'Error desconocido'}`);
    }
}

// Ver detalles del evento
function verDetallesEvento(eventoId) {
    const evento = eventosData.find(e => e.id === eventoId);
    if (!evento) return;

    eventoActualId = eventoId;

    // Llenar modal
    document.getElementById('modal-cliente-nombre').textContent = evento.cliente_nombre;
    document.getElementById('modal-cliente-telefono').textContent = evento.cliente_telefono || 'No especificado';
    
    const fechaFormateada = formatearFechaSegura(evento.fecha_evento);
    document.getElementById('modal-fecha').textContent = fechaFormateada;
    document.getElementById('modal-horario').textContent = formatearHoraSegura(evento.hora_inicio);
    document.getElementById('modal-tipo').textContent = evento.tipo_evento || 'No especificado';
    document.getElementById('modal-invitados').textContent = evento.num_invitados || 'No especificado';
    document.getElementById('modal-condiciones').textContent = evento.condiciones || 'Sin condiciones especiales';
    document.getElementById('modal-notas').textContent = evento.notas || 'Sin notas adicionales';
    document.getElementById('modal-precio').textContent = formatCurrency(evento.precio || 0);
    
    let estadoPago = '';
    if (evento.pagado) {
        estadoPago = '<span class="badge badge-pagado">✓ PAGADO COMPLETO</span>';
    } else if (evento.anticipo > 0) {
        const saldo = (evento.precio || 0) - evento.anticipo;
        estadoPago = `<span class="badge badge-anticipo">Anticipo: ${formatCurrency(evento.anticipo)} | Saldo: ${formatCurrency(saldo)}</span>`;
    } else {
        estadoPago = '<span class="badge badge-pendiente">⚠️ PAGO PENDIENTE</span>';
    }
    document.getElementById('modal-pago').innerHTML = estadoPago;

    // Mostrar modal
    document.getElementById('modal-ver-detalles').classList.add('active');
}

// Cerrar modal
function cerrarModalDetalles() {
    document.getElementById('modal-ver-detalles').classList.remove('active');
}

// Descargar nota - FUNCIÓN ACTUALIZADA CON PDF
async function descargarNota(eventoId) {
    try {
        const evento = eventosData.find(e => e.id === eventoId);
        if (!evento) { alert('No se encontró el evento'); return; }
        if (typeof window.jspdf === 'undefined') await cargarJsPDF();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const azulOscuro = [25, 48, 91], grisOscuro = [60, 60, 60], azulClaro = [52, 152, 219];
        doc.setFillColor(...azulOscuro); doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text('EL RINCONCITO COSTEÑO', 105, 12, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'normal');
        doc.text('Renta de Salón para Eventos', 105, 19, { align: 'center' });
        doc.setFontSize(9); doc.text('Tel: 954-124-2921 | 954-125-1757', 105, 26, { align: 'center' });
        doc.text('Bajos de Chila, Colonia Las Flores', 105, 32, { align: 'center' });
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('CONTRATO DE RENTA DE SALÓN', 105, 40, { align: 'center' });
        let yPos = 55;
        doc.setTextColor(...grisOscuro); doc.setFillColor(240, 240, 240);
        doc.roundedRect(15, yPos - 5, 85, 25, 2, 2, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('INFORMACIÓN DEL CLIENTE', 20, yPos);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`Nombre: ${evento.cliente_nombre}`, 20, yPos + 7);
        doc.text(`Teléfono: ${evento.cliente_telefono || 'N/A'}`, 20, yPos + 14);
        doc.setFillColor(...azulClaro); doc.roundedRect(110, yPos - 5, 85, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        const fechaEvento = new Date(evento.fecha_evento);
        const eventoNumero = `${fechaEvento.getDate()}-${fechaEvento.getMonth() + 1}-${fechaEvento.getFullYear()}`;
        doc.text(`Evento #${eventoNumero}`, 152.5, yPos, { align: 'center' });
        yPos += 35; doc.setTextColor(...grisOscuro); doc.setFillColor(240, 240, 240);
        doc.roundedRect(15, yPos - 5, 180, 35, 2, 2, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('INFORMACIÓN DEL EVENTO', 20, yPos);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`Fecha: ${formatearFechaSegura(evento.fecha_evento)}`, 20, yPos + 7);
        doc.text(`Horario: ${formatearHoraSegura(evento.hora_inicio)}`, 20, yPos + 14);
        doc.text(`Tipo de Evento: ${evento.tipo_evento || 'No especificado'}`, 20, yPos + 21);
        doc.text(`Número de Invitados: ${evento.num_invitados || 'No especificado'}`, 20, yPos + 28);
        yPos += 50; doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('CONDICIONES Y SERVICIOS INCLUIDOS', 20, yPos); yPos += 5;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        if (evento.condiciones) { const lineas = doc.splitTextToSize(evento.condiciones, 170); lineas.forEach((linea, i) => doc.text(linea, 20, yPos + 5 + (i * 5))); yPos += 5 + (lineas.length * 5); }
        if (evento.notas) { yPos += 5; doc.setFont('helvetica', 'bold'); doc.text('NOTAS ADICIONALES:', 20, yPos); doc.setFont('helvetica', 'normal'); const lineas = doc.splitTextToSize(evento.notas, 170); lineas.forEach((linea, i) => doc.text(linea, 20, yPos + 5 + (i * 5))); yPos += 5 + (lineas.length * 5); }
        yPos += 10; doc.setFillColor(...azulOscuro); doc.rect(130, yPos, 65, 8, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('PRECIO TOTAL:', 140, yPos + 5);
        doc.text(formatCurrency(evento.precio || 5000), 185, yPos + 5, { align: 'right' });
        yPos += 10; doc.setTextColor(...grisOscuro); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        if (evento.pagado) { doc.setFillColor(16, 185, 129); doc.roundedRect(130, yPos, 65, 8, 2, 2, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text('PAGADO COMPLETO', 162.5, yPos + 5, { align: 'center' }); }
        else if (evento.anticipo > 0) { doc.setFont('helvetica', 'bold'); doc.text(`Anticipo: ${formatCurrency(evento.anticipo)}`, 140, yPos + 3); doc.text(`Saldo: ${formatCurrency((evento.precio || 5000) - evento.anticipo)}`, 140, yPos + 9); yPos += 15; doc.setFillColor(245, 158, 11); doc.roundedRect(130, yPos, 65, 8, 2, 2, 'F'); doc.setTextColor(255, 255, 255); doc.text('ANTICIPO RECIBIDO', 162.5, yPos + 5, { align: 'center' }); }
        else { yPos += 2; doc.setFillColor(239, 68, 68); doc.roundedRect(130, yPos, 65, 8, 2, 2, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text('PAGO PENDIENTE', 162.5, yPos + 5, { align: 'center' }); }
        yPos = 220; doc.setTextColor(...grisOscuro); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text('TÉRMINOS Y CONDICIONES DEL CONTRATO:', 20, yPos); doc.setFont('helvetica', 'normal');
        doc.text('• El arrendatario se compromete a dejar el salón en las mismas condiciones en que lo recibió.', 20, yPos + 5);
        doc.text('• Cualquier daño a las instalaciones, mobiliario o equipo será cobrado al cliente.', 20, yPos + 10);
        doc.text('• El horario de entrada y salida debe respetarse según lo acordado.', 20, yPos + 15);
        doc.text('• En caso de cancelación, el anticipo no es reembolsable.', 20, yPos + 30);
        yPos += 45; doc.line(20, yPos, 80, yPos); doc.setFontSize(8);
        doc.text('Firma del Cliente', 50, yPos + 5, { align: 'center' });
        doc.text(evento.cliente_nombre, 50, yPos + 10, { align: 'center' });
        doc.line(130, yPos, 190, yPos); doc.text('El Rinconcito Costeño', 160, yPos + 5, { align: 'center' });
        doc.text('Arrendador', 160, yPos + 10, { align: 'center' });
        doc.setFontSize(7); doc.setTextColor(120, 120, 120);
        doc.text(`Contrato emitido el ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`, 105, 285, { align: 'center' });
        doc.save(`Contrato_Salon_${eventoNumero}_${evento.cliente_nombre.replace(/\s+/g, '-')}.pdf`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

function cargarJsPDF() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined') { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
        document.head.appendChild(script);
    });
}

// Toggle anticipo
function toggleAnticipo() {
    const pagado = document.getElementById('evento-pagado').checked;
    const anticipoContainer = document.getElementById('anticipo-container');
    
    if (pagado) {
        anticipoContainer.style.display = 'none';
        document.getElementById('anticipo-evento').value = '';
    } else {
        anticipoContainer.style.display = 'block';
    }
    
    actualizarResumenEvento();
}

// Actualizar resumen del evento
function actualizarResumenEvento() {
    const clienteNombre = document.getElementById('cliente-nombre-evento').value || 'Sin especificar';
    const fechaEvento = document.getElementById('fecha-evento').value;
    const horaInicio = document.getElementById('hora-inicio').value;
    const precio = parseFloat(document.getElementById('precio-renta').value) || 5000;

    document.getElementById('resumen-cliente').textContent = clienteNombre;
    
    if (fechaEvento) {
        const fechaFormateada = formatearFechaSegura(fechaEvento);
        document.getElementById('resumen-fecha').textContent = fechaFormateada;
    } else {
        document.getElementById('resumen-fecha').textContent = 'Sin especificar';
    }

    if (horaInicio) {
        document.getElementById('resumen-horario').textContent = horaInicio;
    } else {
        document.getElementById('resumen-horario').textContent = 'Sin especificar';
    }

    document.getElementById('resumen-precio').textContent = formatCurrency(precio);
}

// Event listeners para actualizar resumen
document.addEventListener('DOMContentLoaded', function() {
    const inputs = ['cliente-nombre-evento', 'fecha-evento', 'hora-inicio', 'precio-renta'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', actualizarResumenEvento);
        }
    });
});

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
