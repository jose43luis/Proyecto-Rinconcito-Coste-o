// ========================================
// CONFIGURACIÓN DE SUPABASE
// ========================================

// CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://rdcailkglfjzqwuxgetq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkY2FpbGtnbGZqenF3dXhnZXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMTY2NDUsImV4cCI6MjA4MTY5MjY0NX0.ao9qWWoPgYRu_JjkCiYtasGuyD9eialP_wHgp_h6Nlg';

// Función que inicializa Supabase y lo asigna a window.supabase
(function() {
    console.log('=== CONFIGURANDO SUPABASE ===');
    console.log('URL:', SUPABASE_URL);
    console.log('API Key válida:', SUPABASE_ANON_KEY.length > 100 ? 'Sí ✓' : 'No ✗');
    
    // Esperar a que la librería esté disponible
    function inicializar() {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            try {
                // Crear cliente y asignarlo globalmente
                window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✅ Supabase inicializado correctamente');
                console.log('✅ supabase.from es función:', typeof window.supabase.from === 'function');
                
                // Probar conexión
                window.supabase.from('productos').select('count').then(response => {
                    if (response.error) {
                        console.warn('⚠️ Advertencia al probar conexión:', response.error.message);
                        console.warn('Esto puede ser normal si la tabla está vacía o RLS está activado');
                    } else {
                        console.log('✅ Conexión a base de datos verificada');
                    }
                });
                
                return true;
            } catch (error) {
                console.error('❌ Error al inicializar Supabase:', error);
                return false;
            }
        }
        return false;
    }
    
    // Intentar inicializar inmediatamente
    if (!inicializar()) {
        // Si no funciona, esperar al evento load
        window.addEventListener('load', inicializar);
    }
})();

console.log('✓ Configuración de Supabase cargada');
