let productosMemoria = [];
let carritoVenta = [];

// Mostrar notificaciones flotantes
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

// Verificar conexión a Supabase
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
        
        cargarStock();
        cargarReportes();
    } catch (err) {
        console.error("Fallo de conexión:", err);
        badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5";
        statusText.textContent = "Sin Conexión / Tablas Faltantes";
    }
}

// 1. Guardar/Cargar Producto
async function guardarProducto(e) {
    e.preventDefault();
    const codigo = document.getElementById('prodCodigo').value.trim();
    const nombre = document.getElementById('prodNombre').value.trim();
    const precio = parseFloat(document.getElementById('prodPrecio').value);
    const stock = parseInt(document.getElementById('prodStock').value);
    const btn = document.getElementById('btnGuardarProd');

    if (!codigo || !nombre || isNaN(precio) || isNaN(stock)) {
        mostrarEstado('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const { error } = await supabaseClient.from('productos').upsert([{
            codigo: codigo,
            nombre: nombre,
            precio: precio,
            stock: stock
        }], { onConflict: 'codigo' });

        if (error) throw error;

        mostrarEstado('Producto registrado/actualizado correctamente.', 'success');
        document.getElementById('formProducto').reset();
        cargarStock();
    } catch (err) {
        console.error('Error al guardar producto:', err);
        mostrarEstado('Error al guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Producto';
    }
}

// 2. Cargar Stock de Productos
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
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Sin productos registrados.</p>';
        return;
    }

    container.innerHTML = '';
    lista.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs flex justify-between items-center";
        div.innerHTML = `
            <div>
                <p class="text-slate-200 font-semibold">${escapeHtml(p.nombre)}</p>
                <p class="text-[10px] text-slate-500">Cód: ${escapeHtml(p.codigo)}</p>
            </div>
            <div class="text-right">
                <p class="text-emerald-400 font-bold">$${p.precio.toFixed(2)}</p>
                <p class="${p.stock < 5 ? 'text-rose-400' : 'text-slate-400'} text-[11px]">Stock: ${p.stock}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function filtrarTablaStock() {
    const query = document.getElementById('inputFiltroStock').value.toLowerCase();
    const filtrados = productosMemoria.filter(p => 
        p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query)
    );
    renderizarStock(filtrados);
}

// 3. Añadir Aumentos Masivos
async function aplicarAumentoMasivo() {
    const porcentajeInput = document.getElementById('porcentajeAumento');
    const porcentaje = parseFloat(porcentajeInput.value);
    const btn = document.getElementById('btnAumento');

    if (isNaN(porcentaje) || porcentaje <= 0) {
        mostrarEstado('Ingresa un porcentaje de aumento válido.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Aplicando...';

    try {
        const factor = 1 + (porcentaje / 100);
        
        for (const prod of productosMemoria) {
            const nuevoPrecio = prod.precio * factor;
            await supabaseClient
                .from('productos')
                .update({ precio: nuevoPrecio })
                .eq('id', prod.id);
        }

        mostrarEstado(`Aumento del ${porcentaje}% aplicado a todos los productos.`, 'success');
        porcentajeInput.value = '';
        cargarStock();
    } catch (err) {
        console.error('Error al aplicar aumento:', err);
        mostrarEstado('Error al aplicar aumento: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Aplicar Aumento General';
    }
}

// 4. Venta y Selección de Productos
function filtrarProductosVenta() {
    const query = document.getElementById('inputBusquedaVenta').value.trim().toLowerCase();
    const resContainer = document.getElementById('resultadosBusqueda');

    if (!query) {
        resContainer.classList.add('hidden');
        return;
    }

    const coincidentes = productosMemoria.filter(p => 
        p.codigo.toLowerCase().includes(query) || p.nombre.toLowerCase().includes(query)
    );

    if (coincidentes.length === 0) {
        resContainer.innerHTML = '<p class="text-[11px] text-slate-500 py-1 text-center">Sin coincidencias</p>';
    } else {
        resContainer.innerHTML = '';
        coincidentes.forEach(p => {
            const item = document.createElement('div');
            item.className = "p-1.5 hover:bg-slate-800 rounded cursor-pointer text-xs flex justify-between";
            item.innerHTML = `<span>${escapeHtml(p.nombre)} (${escapeHtml(p.codigo)})</span> <span class="font-bold text-emerald-400">$${p.precio.toFixed(2)}</span>`;
            item.onclick = () => agregarAlCarrito(p);
            resContainer.appendChild(item);
        });
    }
    resContainer.classList.remove('hidden');
}

function agregarAlCarrito(producto) {
    if (producto.stock <= 0) {
        mostrarEstado('Producto sin stock suficiente.', 'error');
        return;
    }

    const existe = carritoVenta.find(item => item.id === producto.id);
    if (existe) {
        if (existe.cantidad + 1 > producto.stock) {
            mostrarEstado('No hay más stock disponible.', 'error');
            return;
        }
        existe.cantidad += 1;
    } else {
        carritoVenta.push({ ...producto, cantidad: 1 });
    }

    document.getElementById('inputBusquedaVenta').value = '';
    document.getElementById('resultadosBusqueda').classList.add('hidden');
    renderizarCarrito();
}

function renderizarCarrito() {
    const container = document.getElementById('carritoContainer');
    const totalLbl = document.getElementById('lblTotalVenta');

    if (carritoVenta.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">No hay productos cargados en la venta</p>';
        totalLbl.textContent = '$0.00';
        return;
    }

    container.innerHTML = '';
    let total = 0;

    carritoVenta.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-slate-900 p-2 rounded text-xs border border-slate-800";
        div.innerHTML = `
            <div>
                <p class="font-medium text-slate-200">${escapeHtml(item.nombre)}</p>
                <p class="text-[10px] text-slate-500">$${item.precio.toFixed(2)} x ${item.cantidad}</p>
            </div>
            <div class="flex items-center space-x-2">
                <span class="font-bold text-emerald-400">$${subtotal.toFixed(2)}</span>
                <button onclick="eliminarDelCarrito(${index})" class="text-rose-400 hover:text-rose-300 font-bold px-1">✕</button>
            </div>
        `;
        container.appendChild(div);
    });

    totalLbl.textContent = `$${total.toFixed(2)}`;
}

function eliminarDelCarrito(index) {
    carritoVenta.splice(index, 1);
    renderizarCarrito();
}

// 5. Procesar Venta y Generar Factura
async function procesarVenta() {
    if (carritoVenta.length === 0) {
        mostrarEstado('El carrito está vacío.', 'error');
        return;
    }

    const medioPago = document.getElementById('selectMedioPago').value;
    const btn = document.getElementById('btnProcesarVenta');
    const total = carritoVenta.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        // Registrar la venta en DB
        const { data: ventaData, error: ventaErr } = await supabaseClient
            .from('ventas')
            .insert([{ medio_pago: medioPago, total: total }])
            .select();

        if (ventaErr) throw ventaErr;

        const ventaId = ventaData[0].id;

        // Descontar stock y registrar ítems
        for (const item of carritoVenta) {
            await supabaseClient.from('venta_detalles').insert([{
                venta_id: ventaId,
                producto_id: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }]);

            const nuevoStock = item.stock - item.cantidad;
            await supabaseClient.from('productos').update({ stock: nuevoStock }).eq('id', item.id);
        }

        mostrarEstado('¡Venta realizada con éxito!', 'success');
        imprimirFactura(ventaId, medioPago, total, carritoVenta);

        carritoVenta = [];
        renderizarCarrito();
        cargarStock();
        cargarReportes();

    } catch (err) {
        console.error('Error al procesar la venta:', err);
        mostrarEstado('Error al registrar venta: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Procesar Venta y Generar Factura';
    }
}

// Generación e Impresión de Factura
function imprimirFactura(idVenta, medioPago, total, detalles) {
    const win = window.open('', '_blank', 'width=400,height=600');
    const fecha = new Date().toLocaleString();
    
    let itemsHTML = detalles.map(d => `
        <tr>
            <td style="text-align:left;">${escapeHtml(d.nombre)} x${d.cantidad}</td>
            <td style="text-align:right;">$${(d.precio * d.cantidad).toFixed(2)}</td>
        </tr>
    `).join('');

    win.document.write(`
        <html>
        <head>
            <title>Factura #${idVenta}</title>
            <style>
                body { font-family: monospace; padding: 20px; font-size: 12px; }
                h2 { text-align: center; margin-bottom: 5px; }
                p { margin: 3px 0; }
                table { width: 100%; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 10px 0; padding: 5px 0; }
                .total { text-align: right; font-size: 14px; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>COMPROBANTE DE VENTA</h2>
            <p>Nº Ticket: #${idVenta}</p>
            <p>Fecha: ${fecha}</p>
            <p>Medio de Pago: ${medioPago}</p>
            <table>
                ${itemsHTML}
            </table>
            <p class="total">TOTAL: $${total.toFixed(2)}</p>
            <p style="text-align:center; margin-top:20px;">¡Gracias por su compra!</p>
            <script>window.print();</script>
        </body>
        </html>
    `);
    win.document.close();
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.onload = function() {
    verificarConexion();
};