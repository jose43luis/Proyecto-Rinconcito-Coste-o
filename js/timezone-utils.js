// timezone-utils.js - Utilidades para manejo de fechas en zona horaria de México Centro

// Zona horaria de México Centro
const TIMEZONE_MEXICO = 'America/Mexico_City';

/**
 * Obtener la fecha/hora actual en México Centro
 */
function obtenerFechaHoraMexico() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE_MEXICO }));
}

/**
 * Convertir una fecha a zona horaria de México
 */
function convertirAMexico(fecha) {
    if (!fecha) return null;
    const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return new Date(fechaObj.toLocaleString('en-US', { timeZone: TIMEZONE_MEXICO }));
}

/**
 * Formatear fecha en formato ISO para México Centro
 * Ajusta la hora a México y la guarda en formato ISO
 */
function formatearISOMexico(fecha = null) {
    // Obtener fecha/hora en México
    const fechaMexico = fecha ? convertirAMexico(fecha) : obtenerFechaHoraMexico();
    
    // Formatear manualmente en zona horaria de México
    const year = fechaMexico.getFullYear();
    const month = String(fechaMexico.getMonth() + 1).padStart(2, '0');
    const day = String(fechaMexico.getDate()).padStart(2, '0');
    const hours = String(fechaMexico.getHours()).padStart(2, '0');
    const minutes = String(fechaMexico.getMinutes()).padStart(2, '0');
    const seconds = String(fechaMexico.getSeconds()).padStart(2, '0');
    const milliseconds = String(fechaMexico.getMilliseconds()).padStart(3, '0');
    
    // Formato: YYYY-MM-DD HH:MM:SS.mmm (compatible con PostgreSQL timestamp)
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Formatear fecha para input type="date" (YYYY-MM-DD)
 */
function formatearFechaInput(fecha = null) {
    const fechaMexico = fecha ? convertirAMexico(fecha) : obtenerFechaHoraMexico();
    const year = fechaMexico.getFullYear();
    const month = String(fechaMexico.getMonth() + 1).padStart(2, '0');
    const day = String(fechaMexico.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formatear hora para input type="time" (HH:MM)
 */
function formatearHoraInput(fecha = null) {
    const fechaMexico = fecha ? convertirAMexico(fecha) : obtenerFechaHoraMexico();
    const hours = String(fechaMexico.getHours()).padStart(2, '0');
    const minutes = String(fechaMexico.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Formatear fecha legible en español
 */
function formatearFechaLegible(fecha, opciones = {}) {
    const fechaObj = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
    
    const opcionesDefecto = {
        timeZone: TIMEZONE_MEXICO,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...opciones
    };
    
    return fechaObj.toLocaleDateString('es-MX', opcionesDefecto);
}

/**
 * Formatear fecha y hora legible en español
 */
function formatearFechaHoraLegible(fecha, opciones = {}) {
    const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    const opcionesDefecto = {
        timeZone: TIMEZONE_MEXICO,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...opciones
    };
    
    return fechaObj.toLocaleString('es-MX', opcionesDefecto);
}

/**
 * Formatear solo la hora en formato 12h o 24h
 */
function formatearHoraLegible(hora, formato24h = false) {
    if (!hora) return 'N/A';
    
    // Si es una fecha completa, extraer solo la hora
    if (hora instanceof Date || hora.includes('T')) {
        const fechaObj = typeof hora === 'string' ? new Date(hora) : hora;
        return fechaObj.toLocaleTimeString('es-MX', {
            timeZone: TIMEZONE_MEXICO,
            hour: '2-digit',
            minute: '2-digit',
            hour12: !formato24h
        });
    }
    
    // Si ya es una hora en formato HH:MM
    if (typeof hora === 'string' && hora.includes(':')) {
        const [hours, minutes] = hora.split(':');
        const tempDate = new Date();
        tempDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        return tempDate.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: !formato24h
        });
    }
    
    return hora;
}

/**
 * Obtener el inicio del día en México Centro
 */
function inicioDelDiaMexico(fecha = null) {
    const fechaMexico = fecha ? convertirAMexico(fecha) : obtenerFechaHoraMexico();
    fechaMexico.setHours(0, 0, 0, 0);
    return fechaMexico;
}

/**
 * Obtener el fin del día en México Centro
 */
function finDelDiaMexico(fecha = null) {
    const fechaMexico = fecha ? convertirAMexico(fecha) : obtenerFechaHoraMexico();
    fechaMexico.setHours(23, 59, 59, 999);
    return fechaMexico;
}

/**
 * Calcular diferencia de días desde hoy
 */
function diasDesdeHoy(fecha) {
    const hoy = inicioDelDiaMexico();
    const fechaObj = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
    const fechaMexico = inicioDelDiaMexico(fechaObj);
    
    const diffTime = fechaMexico - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

/**
 * Obtener texto relativo de fecha (hoy, mañana, en X días)
 */
function textoFechaRelativa(fecha) {
    const dias = diasDesdeHoy(fecha);
    
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias === -1) return 'Ayer';
    if (dias > 1) return `En ${dias} días`;
    if (dias < -1) return `Hace ${Math.abs(dias)} días`;
    
    return formatearFechaLegible(fecha);
}

/**
 * Validar si una fecha está en el pasado
 */
function esFechaPasada(fecha) {
    const fechaObj = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
    const hoy = inicioDelDiaMexico();
    return fechaObj < hoy;
}

/**
 * Validar si una fecha es hoy
 */
function esFechaHoy(fecha) {
    return diasDesdeHoy(fecha) === 0;
}

/**
 * Obtener rango de fechas para el mes actual
 */
function rangoMesActual() {
    const hoy = obtenerFechaHoraMexico();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    return {
        inicio: formatearFechaInput(primerDia),
        fin: formatearFechaInput(ultimoDia)
    };
}

/**
 * Obtener fecha mínima para inputs (hoy en México)
 */
function fechaMinimaInput() {
    return formatearFechaInput();
}

// Exportar funciones para uso global
if (typeof window !== 'undefined') {
    window.TimezoneMexico = {
        obtenerFechaHoraMexico,
        convertirAMexico,
        formatearISOMexico,
        formatearFechaInput,
        formatearHoraInput,
        formatearFechaLegible,
        formatearFechaHoraLegible,
        formatearHoraLegible,
        inicioDelDiaMexico,
        finDelDiaMexico,
        diasDesdeHoy,
        textoFechaRelativa,
        esFechaPasada,
        esFechaHoy,
        rangoMesActual,
        fechaMinimaInput,
        TIMEZONE: TIMEZONE_MEXICO
    };
}
