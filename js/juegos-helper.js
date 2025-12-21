// juegos-helper.js - Funciones auxiliares para manejo de juegos

// Cargar componentes de un juego desde Supabase
async function cargarComponentesJuego(juegoId) {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('Supabase no configurado');
            return [];
        }

        const { data: componentes, error } = await supabase
            .from('juego_componentes')
            .select(`
                cantidad,
                productos:producto_id (
                    id,
                    nombre,
                    precio_renta
                )
            `)
            .eq('juego_id', juegoId);

        if (error) throw error;

        // Transformar a formato más manejable
        return componentes.map(c => ({
            producto_id: c.productos.id,
            nombre: c.productos.nombre,
            precio_renta: c.productos.precio_renta,
            cantidad: c.cantidad
        }));

    } catch (error) {
        console.error('Error al cargar componentes del juego:', error);
        return [];
    }
}

// Expandir juegos en items individuales
// Si se agregan 3 "Juego de Tablón", esto retorna:
// - 30 Sillas (3 juegos × 10 sillas)
// - 3 Tablones (3 juegos × 1 tablón)
// - 3 Manteles Largos
// - 3 Cubremanteles
async function expandirJuegos(items) {
    const itemsExpandidos = [];

    for (const item of items) {
        // Verificar si es un juego
        const producto = await obtenerProducto(item.producto_id);
        
        if (producto && producto.es_juego) {
            // Es un juego - expandir componentes
            const componentes = await cargarComponentesJuego(item.producto_id);
            const cantidadJuegos = item.cantidad || 1;

            // Agregar cada componente multiplicado por la cantidad de juegos
            for (const componente of componentes) {
                itemsExpandidos.push({
                    producto_id: componente.producto_id,
                    nombre: componente.nombre,
                    cantidad: componente.cantidad * cantidadJuegos,
                    precio_unitario: 0, // Los componentes no se cobran individualmente
                    subtotal: 0,
                    es_componente_juego: true,
                    juego_origen: producto.nombre
                });
            }

            // También agregar el juego original para el precio
            itemsExpandidos.push({
                producto_id: item.producto_id,
                nombre: item.nombre || producto.nombre,
                cantidad: cantidadJuegos,
                precio_unitario: item.precio_unitario || producto.precio_renta || 0,
                subtotal: item.subtotal || (item.precio_unitario * cantidadJuegos),
                es_juego: true,
                color: null
            });

        } else {
            // No es un juego - agregar tal cual
            itemsExpandidos.push(item);
        }
    }

    return itemsExpandidos;
}

// Obtener un producto por ID
async function obtenerProducto(productoId) {
    try {
        if (typeof supabase === 'undefined') return null;

        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('id', productoId)
            .single();

        if (error) throw error;
        return data;

    } catch (error) {
        console.error('Error al obtener producto:', error);
        return null;
    }
}

// Calcular disponibilidad considerando juegos
// Ejemplo: Si hay 5 "Juego de Tablón" rentados, esto descuenta:
// - 50 Sillas
// - 5 Tablones
// - 5 Manteles Largos
// - 5 Cubremanteles
async function calcularDisponibilidadConJuegos(fecha, productos) {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('Supabase no configurado');
            return productos.map(p => ({
                ...p,
                disponible: p.stock_total || 0,
                en_uso: 0
            }));
        }

        // Cargar pedidos de esa fecha (excluyendo completados)
        const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select(`
                id,
                pedido_items (
                    producto_id,
                    cantidad,
                    productos (
                        id,
                        nombre,
                        es_juego
                    )
                )
            `)
            .eq('fecha_evento', fecha)
            .neq('estado', 'completado');

        if (pedidosError) throw pedidosError;

        // Cargar eventos del salón de esa fecha
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_salon')
            .select('*')
            .eq('fecha_evento', fecha)
            .neq('estado', 'completado');

        if (eventosError) throw eventosError;

        // Contador de items en uso
        const enUso = {};

        // Procesar cada pedido
        for (const pedido of pedidos || []) {
            for (const item of pedido.pedido_items || []) {
                const producto = item.productos;
                
                if (producto && producto.es_juego) {
                    // Es un juego - descomponer en componentes
                    const componentes = await cargarComponentesJuego(producto.id);
                    for (const componente of componentes) {
                        const key = componente.producto_id;
                        enUso[key] = (enUso[key] || 0) + (componente.cantidad * item.cantidad);
                    }
                } else {
                    // Producto normal
                    const key = item.producto_id;
                    enUso[key] = (enUso[key] || 0) + item.cantidad;
                }
            }
        }

        // Calcular disponibilidad para cada producto
        return productos.map(producto => {
            const cantidadEnUso = enUso[producto.id] || 0;
            const disponible = Math.max(0, (producto.stock_total || 0) - cantidadEnUso);

            return {
                ...producto,
                disponible: disponible,
                en_uso: cantidadEnUso
            };
        });

    } catch (error) {
        console.error('Error al calcular disponibilidad:', error);
        return productos.map(p => ({
            ...p,
            disponible: p.stock_total || 0,
            en_uso: 0
        }));
    }
}

// Agrupar componentes de juegos para mostrar en el resumen
function agruparComponentesJuegos(items) {
    const itemsAgrupados = [];
    const juegosVistos = new Set();

    for (const item of items) {
        if (item.es_juego) {
            // Es un juego - agregarlo al resumen
            itemsAgrupados.push(item);
            juegosVistos.add(item.producto_id);
        } else if (!item.es_componente_juego) {
            // Es un producto individual (no componente de juego)
            itemsAgrupados.push(item);
        }
        // Los componentes de juegos NO se muestran individualmente en el resumen
    }

    return itemsAgrupados;
}

// Obtener descripción detallada de un juego
async function obtenerDescripcionJuego(juegoId) {
    const componentes = await cargarComponentesJuego(juegoId);
    if (componentes.length === 0) return '';

    return componentes
        .map(c => `${c.cantidad} ${c.nombre}${c.cantidad > 1 ? 's' : ''}`)
        .join(' + ');
}
