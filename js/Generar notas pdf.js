/* ============================================
   GENERADOR DE NOTAS PROFESIONALES EN PDF
   Para agregar a pedidos.js
   ============================================ */

// PASO 1: Agregar jsPDF al HTML (en pedidos.html antes del cierre de </body>)
/*
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
*/

// PASO 2: Reemplazar la función descargarNotaPedido en pedidos.js

function descargarNotaPedido() {
    if (!pedidoActualId) {
        alert('No hay pedido seleccionado');
        return;
    }

    const pedido = pedidosData.find(p => p.id === pedidoActualId);
    if (!pedido) {
        alert('No se encontró el pedido');
        return;
    }

    try {
        generarNotaPDF(pedido);
    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar la nota. Verifica que jsPDF esté cargado.');
    }
}

function generarNotaPDF(pedido) {
    // Verificar que jsPDF esté disponible
    if (typeof window.jspdf === 'undefined') {
        alert('jsPDF no está cargado. Agrega el script de jsPDF al HTML.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configuración de colores
    const primaryColor = [12, 123, 179]; // #0c7bb3
    const darkGray = [17, 24, 39];
    const lightGray = [107, 114, 128];
    const backgroundColor = [249, 250, 251];

    // Márgenes y dimensiones
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPos = margin;

    // =====================================
    // HEADER CON FONDO
    // =====================================
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo/Nombre de la empresa (blanco)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('El Rinconcito Costeño', margin, 20);

    // Subtítulo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Renta de Mobiliario para Eventos', margin, 28);

    // Contacto en header
    doc.setFontSize(9);
    doc.text('Tel: (951) 123-4567 | www.elrinconcitocosteño.com', margin, 36);

    yPos = 55;

    // =====================================
    // TÍTULO DE LA NOTA
    // =====================================
    doc.setTextColor(...darkGray);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA DE PEDIDO', pageWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // =====================================
    // INFORMACIÓN DEL PEDIDO (2 columnas)
    // =====================================
    const colWidth = (pageWidth - 2 * margin) / 2;
    
    // Columna izquierda - Cliente
    doc.setFillColor(...backgroundColor);
    doc.rect(margin, yPos, colWidth - 5, 35, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INFORMACIÓN DEL CLIENTE', margin + 5, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.setFontSize(9);
    doc.text(`Nombre: ${pedido.cliente_nombre}`, margin + 5, yPos + 15);
    if (pedido.cliente_telefono) {
        doc.text(`Teléfono: ${pedido.cliente_telefono}`, margin + 5, yPos + 22);
    }
    doc.text(`Pedido #${pedido.id.substring(0, 8).toUpperCase()}`, margin + 5, yPos + 29);

    // Columna derecha - Evento
    doc.setFillColor(...backgroundColor);
    doc.rect(margin + colWidth + 5, yPos, colWidth - 5, 35, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INFORMACIÓN DEL EVENTO', margin + colWidth + 10, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    
    const fechaFormateada = formatearFechaSegura(pedido.fecha_evento);
    doc.text(`Fecha: ${fechaFormateada}`, margin + colWidth + 10, yPos + 15);
    doc.text(`Hora: ${formatearHoraSegura(pedido.hora_evento)}`, margin + colWidth + 10, yPos + 22);
    doc.text(`Lugar: ${pedido.lugar || 'No especificado'}`, margin + colWidth + 10, yPos + 29);

    yPos += 45;

    // Dirección completa si existe
    if (pedido.lugar_descripcion) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...lightGray);
        const direccionLines = doc.splitTextToSize(`Dirección: ${pedido.lugar_descripcion}`, pageWidth - 2 * margin);
        doc.text(direccionLines, margin, yPos);
        yPos += direccionLines.length * 4 + 5;
    }

    yPos += 5;

    // =====================================
    // TABLA DE ITEMS
    // =====================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...darkGray);
    doc.text('ITEMS DEL PEDIDO', margin, yPos);
    yPos += 8;

    // Header de tabla
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTO', margin + 3, yPos + 5.5);
    doc.text('CANT.', pageWidth - margin - 60, yPos + 5.5);
    doc.text('PRECIO UNIT.', pageWidth - margin - 45, yPos + 5.5);
    doc.text('SUBTOTAL', pageWidth - margin - 20, yPos + 5.5, { align: 'right' });
    
    yPos += 10;

    // Items
    doc.setTextColor(...darkGray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let itemCount = 0;
    const itemsPerPage = 15;

    if (pedido.pedido_items && pedido.pedido_items.length > 0) {
        pedido.pedido_items.forEach((item, index) => {
            // Verificar si necesitamos nueva página
            if (itemCount >= itemsPerPage) {
                doc.addPage();
                yPos = margin;
                itemCount = 0;
            }

            const nombreProducto = item.productos ? item.productos.nombre : 'Producto';
            const cantidad = item.cantidad;
            const precioUnit = formatCurrency(item.precio_unitario || 0);
            const subtotal = formatCurrency(item.subtotal || 0);

            // Fila alternada
            if (index % 2 === 0) {
                doc.setFillColor(248, 249, 250);
                doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
            }

            doc.text(nombreProducto, margin + 3, yPos);
            doc.text(cantidad.toString(), pageWidth - margin - 57, yPos);
            doc.text(precioUnit, pageWidth - margin - 45, yPos);
            doc.text(subtotal, pageWidth - margin - 3, yPos, { align: 'right' });

            yPos += 7;
            itemCount++;
        });
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...lightGray);
        doc.text('No hay items en este pedido', margin + 3, yPos);
        yPos += 7;
    }

    yPos += 5;

    // =====================================
    // TOTALES
    // =====================================
    const totalBoxY = yPos;
    const totalBoxHeight = pedido.anticipo > 0 ? 25 : 15;
    
    // Fondo del total
    doc.setFillColor(...backgroundColor);
    doc.rect(pageWidth - margin - 70, totalBoxY, 70, totalBoxHeight, 'F');
    
    // Línea decorativa
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(2);
    doc.line(pageWidth - margin - 70, totalBoxY, pageWidth - margin, totalBoxY);

    yPos += 8;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.text('TOTAL:', pageWidth - margin - 65, yPos);
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.text(formatCurrency(pedido.total || 0), pageWidth - margin - 5, yPos, { align: 'right' });

    // Anticipo si existe
    if (pedido.anticipo > 0) {
        yPos += 7;
        doc.setFontSize(9);
        doc.setTextColor(...lightGray);
        doc.setFont('helvetica', 'normal');
        doc.text(`Anticipo: ${formatCurrency(pedido.anticipo)}`, pageWidth - margin - 65, yPos);
        
        const saldo = pedido.total - pedido.anticipo;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkGray);
        doc.text(`Saldo: ${formatCurrency(saldo)}`, pageWidth - margin - 5, yPos, { align: 'right' });
    }

    yPos += 15;

    // Estado de pago
    if (pedido.pagado) {
        doc.setFillColor(209, 250, 229);
        doc.setTextColor(4, 120, 87);
    } else {
        doc.setFillColor(254, 242, 242);
        doc.setTextColor(220, 38, 38);
    }
    
    const estadoPago = pedido.pagado ? '✓ PAGADO COMPLETO' : '⚠ PAGO PENDIENTE';
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const estadoWidth = doc.getTextWidth(estadoPago) + 10;
    doc.rect(pageWidth - margin - estadoWidth, yPos - 5, estadoWidth, 8, 'F');
    doc.text(estadoPago, pageWidth - margin - estadoWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // =====================================
    // COMENTARIOS
    // =====================================
    if (pedido.comentarios) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.5);
        const comentariosBox = doc.splitTextToSize(pedido.comentarios, pageWidth - 2 * margin - 10);
        const boxHeight = comentariosBox.length * 5 + 10;
        
        doc.rect(margin, yPos, pageWidth - 2 * margin, boxHeight, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(180, 83, 9);
        doc.text('COMENTARIOS:', margin + 5, yPos + 6);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkGray);
        doc.setFontSize(8);
        doc.text(comentariosBox, margin + 5, yPos + 12);
        
        yPos += boxHeight + 5;
    }

    // =====================================
    // FOOTER
    // =====================================
    const footerY = pageHeight - 30;
    
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightGray);
    
    doc.text('Términos y Condiciones:', margin, footerY + 5);
    doc.setFontSize(7);
    doc.text('• El mobiliario debe ser devuelto en las mismas condiciones.', margin, footerY + 10);
    doc.text('• Cualquier daño será cobrado al cliente.', margin, footerY + 14);
    doc.text('• La fecha de devolución es al día siguiente del evento.', margin, footerY + 18);

    // Firma
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('_____________________________', pageWidth - margin - 60, footerY + 10);
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text('Firma del Cliente', pageWidth - margin - 45, footerY + 15);

    // Fecha de emisión
    const fechaEmision = new Date().toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    doc.setFontSize(7);
    doc.text(`Nota emitida el ${fechaEmision}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // =====================================
    // GUARDAR PDF
    // =====================================
    const nombreArchivo = `Nota_Pedido_${pedido.cliente_nombre.replace(/\s+/g, '_')}_${pedido.id.substring(0, 8)}.pdf`;
    doc.save(nombreArchivo);

    console.log('✅ Nota generada:', nombreArchivo);
}