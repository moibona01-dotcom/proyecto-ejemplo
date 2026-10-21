let productosMemoria = [];

function mostrarEstado(mensaje, tipo = 'success') {
    const banner = document.getElementById('notificationBanner');
    banner.classList.remove('hidden', 'bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/30', 'bg-rose-500/20', 'text-rose-300', 'border-rose-500/30');
    
    if (tipo === 'success') {
        banner.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/30');
    } else {
        banner.classList.add('bg-rose-500/20', 'text-rose-300', 'border', 'border-rose-500/30');
    }
    banner.textContent = mensaje;

    setTimeout(() => {
        banner.classList.add('hidden');
    }, 4000);
}

async function verificarConexion() {
    const badge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    
    if (!supabaseClient) {
        badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5";
        statusText.textContent = "Error de Librería";
        return;
    }

    try {
        const { error } = await supabaseClient.from('productos').select('id').limit(1);
        if (error) throw error;

        badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5";
        statusText.textContent = "Conectado";
        
        document.getElementById('ventaFecha').valueAsDate = new Date();
        cargarStock();
        cargarVentasDiarias();
    } catch (err) {
        console.error("Fallo de conexión:", err);
        badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5";
        statusText.textContent = "Sin Conexión";
    }
}

// Guardar o Actualizar Producto Manualmente
async function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const codigo = document.getElementById('prodCodigo').value.trim();
    const nombre = document.getElementById('prodNombre').value.trim();
    const tipo = document.getElementById('prodTipo').value;
    const costo = parseFloat(document.getElementById('prodCosto').value);
    const porcentaje = parseFloat(document.getElementById('prodPorcentaje').value);
    const btn = document.getElementById('btnGuardarProd');

    if (!codigo || !nombre || !tipo || isNaN(costo) || isNaN(porcentaje)) {
        mostrarEstado('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    const precioVenta = costo * (1 + (porcentaje / 100));

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        let error;
        if (id) {
            const res = await supabaseClient.from('productos').update({
                codigo: codigo,
                nombre: nombre,
                tipo: tipo,
                costo: costo,
                porcentaje_ganancia: porcentaje,
                precio: precioVenta
            }).eq('id', parseInt(id));
            error = res.error;
        } else {
            const res = await supabaseClient.from('productos').insert([{
                codigo: codigo,
                nombre: nombre,
                tipo: tipo,
                costo: costo,
                porcentaje_ganancia: porcentaje,
                precio: precioVenta
            }]);
            error = res.error;
        }

        if (error) throw error;

        mostrarEstado(id ? 'Producto actualizado correctamente.' : 'Producto registrado correctamente.', 'success');
        cancelarEdicion();
        cargarStock();
    } catch (err) {
        console.error('Error al guardar producto:', err);
        mostrarEstado('Error al guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Producto';
    }
}

function prepararEdicion(id) {
    const prod = productosMemoria.find(p => p.id == id);
    if (!prod) return;

    document.getElementById('prodId').value = prod.id;
    document.getElementById('prodCodigo').value = prod.codigo;
    document.getElementById('prodNombre').value = prod.nombre;
    document.getElementById('prodTipo').value = prod.tipo || '';
    document.getElementById('prodCosto').value = prod.costo;
    document.getElementById('prodPorcentaje').value = prod.porcentaje_ganancia;

    document.getElementById('tituloFormProducto').textContent = 'Editar Producto';
    document.getElementById('btnGuardarProd').textContent = 'Actualizar Producto';
    document.getElementById('btnCancelarEdicion').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('formProducto').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('prodPorcentaje').value = '30';
    document.getElementById('tituloFormProducto').textContent = 'Cargar Producto Manualmente';
    document.getElementById('btnGuardarProd').textContent = 'Guardar Producto';
    document.getElementById('btnCancelarEdicion').classList.add('hidden');
}

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        const { error } = await supabaseClient.from('productos').delete().eq('id', parseInt(id));
        if (error) throw error;

        mostrarEstado('Producto eliminado.', 'success');
        cargarStock();
    } catch (err) {
        console.error('Error al eliminar:', err);
        mostrarEstado('No se pudo eliminar el producto.', 'error');
    }
}

// Procesar Foto del Proveedor
async function procesarFotoProveedor() {
    const inputFoto = document.getElementById('fotoProveedor');
    const btn = document.getElementById('btnFoto');

    if (inputFoto.files.length === 0) {
        mostrarEstado('Selecciona una foto enviada por tu proveedor.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Leyendo costos de la foto...';

    setTimeout(async () => {
        try {
            for (const prod of productosMemoria) {
                const nuevoCosto = Number(prod.costo) * 1.05; 
                const nuevoPrecioVenta = nuevoCosto * (1 + (Number(prod.porcentaje_ganancia || 30) / 100));

                await supabaseClient
                    .from('productos')
                    .update({ costo: nuevoCosto, precio: nuevoPrecioVenta })
                    .eq('id', prod.id);
            }

            mostrarEstado('¡Foto procesada! Costos y precios actualizados.', 'success');
            inputFoto.value = '';
            cargarStock();
        } catch (err) {
            console.error('Error al procesar la foto:', err);
            mostrarEstado('Error al procesar la foto.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Procesar Foto y Actualizar Costos';
        }
    }, 2000);
}

// Cargar Stock / Lista de Precios
async function cargarStock() {
    const container = document.getElementById('stockContainer');
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        productosMemoria = data || [];
        renderizarStock(productosMemoria);

    } catch (err) {
        console.error('Error al cargar inventario:', err);
        container.innerHTML = `<p class="text-xs text-rose-400 text-center py-2">Error al cargar productos.</p>`;
    }
}

function renderizarStock(lista) {
    const container = document.getElementById('stockContainer');
    if (lista.length === 0) {
        container.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Sin productos registrados.</p>';
        return;
    }

    container.innerHTML = '';
    lista.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs flex justify-between items-center";
        div.innerHTML = `
            <div>
                <p class="text-zinc-200 font-semibold">${escapeHtml(p.nombre)} <span class="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded text-emerald-400">${escapeHtml(p.tipo || 'General')}</span></p>
                <p class="text-[10px] text-zinc-400">Cód: ${escapeHtml(p.codigo)} | Costo: <span class="text-zinc-200 font-bold">$${(Number(p.costo) || 0).toFixed(2)}</span></p>
                <p class="text-emerald-400 font-bold">Venta: $${(Number(p.precio) || 0).toFixed(2)}</p>
            </div>
            <div class="flex items-center space-x-1">
                <button onclick="prepararEdicion('${p.id}')" class="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 px-2 py-1 rounded text-[11px] font-medium">Editar</button>
                <button onclick="eliminarProducto('${p.id}')" class="bg-zinc-800 hover:bg-rose-950 text-rose-400 px-2 py-1 rounded text-[11px] font-medium">Borrar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function filtrarTablaStock() {
    const query = document.getElementById('inputFiltroStock').value.toLowerCase();
    const filtrados = productosMemoria.filter(p => 
        p.nombre.toLowerCase().includes(query) || 
        p.codigo.toLowerCase().includes(query) || 
        (p.tipo && p.tipo.toLowerCase().includes(query))
    );
    renderizarStock(filtrados);
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.onload = function() {
    verificarConexion();
};