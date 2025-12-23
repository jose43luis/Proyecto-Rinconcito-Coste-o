// configuracion-fix.js - Parche para GitHub Pages

(function() {
    console.log('🔧 Iniciando parche de configuración...');
    
    let intentos = 0;
    const MAX_INTENTOS = 10;
    
    const intervalo = setInterval(() => {
        intentos++;
        console.log(`⏳ Verificando Supabase... (intento ${intentos}/${MAX_INTENTOS})`);
        
        // Verificar si Supabase está disponible
        if (typeof window.supabase !== 'undefined' && window.supabase.from) {
            console.log('✅ Supabase detectado en intento', intentos);
            clearInterval(intervalo);
            
            // Verificar si la función de carga existe
            if (typeof window.cargarYMostrarPrecios === 'function') {
                console.log('✅ Función cargarYMostrarPrecios encontrada, ejecutando...');
                window.cargarYMostrarPrecios();
            } else {
                console.warn('⚠️ Función cargarYMostrarPrecios no encontrada, esperando...');
                // Esperar un poco más y reintentar
                setTimeout(() => {
                    if (typeof window.cargarYMostrarPrecios === 'function') {
                        window.cargarYMostrarPrecios();
                    }
                }, 500);
            }
        } else if (intentos >= MAX_INTENTOS) {
            console.error('❌ Timeout: Supabase no se cargó después de', MAX_INTENTOS, 'intentos');
            clearInterval(intervalo);
            
            // Mostrar mensaje de error al usuario
            const contenedor = document.getElementById('contenedor-precios');
            if (contenedor) {
                contenedor.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #dc2626;">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="64" height="64" style="margin: 0 auto; color: #dc2626;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <h3 style="margin-top: 1rem; font-size: 1.25rem; color: #1f2937;">Error de Conexión</h3>
                        <p style="color: #6b7280; margin-top: 0.5rem;">No se pudo conectar a la base de datos.</p>
                        <p style="font-size: 0.875rem; margin-top: 1rem; color: #6b7280;">
                            Por favor, verifica tu conexión a internet y recarga la página.
                        </p>
                        <button onclick="location.reload()" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #0c7bb3; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem;">
                            🔄 Recargar Página
                        </button>
                    </div>
                `;
            }
        } else {
            console.log('⏳ Supabase aún no disponible, reintentando...');
        }
    }, 500); // Verificar cada 500ms
})();

console.log('✓ Parche de configuración cargado');
