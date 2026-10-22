/* ---------- Precios ---------- */

function parsearPrecioMoneda(textoPrecio) {
    if (!textoPrecio) return 0;
    let limpio = String(textoPrecio).replace(/[^0-9.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
    if (!limpio) return 0;

    const ultimoPunto = limpio.lastIndexOf('.');
    const ultimaComa = limpio.lastIndexOf(',');

    if (ultimoPunto !== -1 && ultimaComa !== -1) {
        if (ultimaComa > ultimoPunto) {
            limpio = limpio.replace(/\./g, '').replace(',', '.');
        } else {
            limpio = limpio.replace(/,/g, '');
        }
    } else if (ultimoPunto !== -1) {
        if (/\.\d{3}$/.test(limpio)) limpio = limpio.replace(/\./g, '');
    } else if (ultimaComa !== -1) {
        if (/,\d{3}$/.test(limpio)) limpio = limpio.replace(/,/g, '');
        else limpio = limpio.replace(',', '.');
    }
    return parseFloat(limpio) || 0;
}

function parsearLista(texto) {
    const filas = [];
    let ignoradas = 0;

    for (let linea of String(texto || '').split('\n')) {
        linea = linea.trim();
        if (!linea) continue;

        const coincidencias = linea.match(/\$?\s*\d[\d.,]*/g);
        if (!coincidencias) { ignoradas++; continue; }

        const crudo = coincidencias[coincidencias.length - 1];
        const costo = parsearPrecioMoneda(crudo);
        if (costo <= 0) { ignoradas++; continue; }

        const idx = linea.lastIndexOf(crudo);
        let nombre = (linea.slice(0, idx) + ' ' + linea.slice(idx + crudo.length))
            .replace(/[$|_]+/g, ' ')
            .replace(/[.\-:·,]{2,}/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[\s.\-:,]+$/, '')
            .trim();

        if (!nombre) { ignoradas++; continue; }
        filas.push({ nombre, costo });
    }
    return { filas, ignoradas };
}

function pctDefault() {
    const v = parseFloat($('pctDefault').value);
    return isNaN(v) || v < 0 ? 30 : v;
}

function guardarPctDefault() {
    try { localStorage.setItem('pctDefault', $('pctDefault').value); } catch (e) {}
}

function cargarPctDefault() {
    try {
        const v = localStorage.getItem('pctDefault');
        if (v !== null && v !== '') $('pctDefault').value = v;
    } catch (e) {}
}

/* ---------- Productos BD ---------- */

async function cargarProductosBD() {
    if (!supabaseClient) return;
    try {
        let todos = [];
        let desde = 0;
        const paso = 1000;
        while (true) {
            const { data, error } = await supabaseClient
                .from('productos').select('*')
                .order('nombre', { ascending: true }).order('id', { ascending: true })
                .range(desde, desde + paso - 1);
            if (error) throw error;
            todos = todos.concat(data || []);
            if (!data || data.length < paso) break;
            desde += paso;
        }
        productosMemoria = todos;
        indiceNombres = new Map(todos.map(p => [normalizar(p.nombre), p]));
        buscarProductos();
    } catch (err) {
        console.error('Error al cargar productos:', err);
        mostrarEstado('No se pudieron cargar los productos.', 'error');
    }
}

function prepararFilas(items, porcentajeNuevo) {
    const codigosUsados = new Map(productosMemoria.map(p => [p.codigo, normalizar(p.nombre)]));
    const porClave = new Map();

    for (const it of items) {
        const clave = normalizar(it.nombre);
        const existente = indiceNombres.get(clave);
        const previo = porClave.get(clave);
        let codigo;

        if (existente) {
            codigo = existente.codigo;
        } else if (previo) {
            codigo = previo.codigo;
        } else {
            const base = 'COD-' + (slug(it.nombre) || 'producto');
            codigo = base;
            let n = 2;
            while (codigosUsados.has(codigo) && codigosUsados.get(codigo) !== clave) {
                codigo = base + '-' + n++;
            }
            codigosUsados.set(codigo, clave);
        }

        const porcentaje = existente ? Number(existente.porcentaje_ganancia) : porcentajeNuevo;
        const costo = redondear(it.costo);

        porClave.set(clave, {
            codigo,
            nombre: existente ? existente.nombre : it.nombre.trim(),
            rubro: it.rubro || (existente ? existente.rubro : 'General'),
            costo,
            porcentaje_ganancia: porcentaje,
            precio_venta: redondear(costo * (1 + porcentaje / 100))
        });
    }
    return Array.from(porClave.values());
}

/* ---------- Revisión de Lista ---------- */

function armarRevision(texto) {
    const { filas, ignoradas } = parsearLista(texto);
    if (filas.length === 0) {
        mostrarEstado('No encontré productos con precio en ese texto.', 'error');
        return;
    }
    revision = filas.map(f => {
        const existente = indiceNombres.get(normalizar(f.nombre));
        return { nombre: f.nombre, costo: f.costo, rubro: existente ? existente.rubro : 'General', activo: true };
    });
    $('revisionResumen').textContent = filas.length + ' producto(s) detectado(s)' + (ignoradas ? ' · ' + ignoradas + ' línea(s) sin precio ignorada(s)' : '');
    renderRevision();
    $('panelRevision').classList.remove('hidden');
    $('panelRevision').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderRevision() {
    const campo = 'bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 w-full';
    $('revisionFilas').innerHTML = revision.map((r, i) => `
        <div class="grid grid-cols-12 gap-2 items-center bg-zinc-900 border border-zinc-800 rounded p-2">
            <input type="checkbox" ${r.activo ? 'checked' : ''} onchange="editarRevision(${i}, 'activo', this.checked)" class="col-span-1 accent-emerald-500">
            <input type="text" value="${escapeHtml(r.nombre)}" oninput="editarRevision(${i}, 'nombre', this.value)" class="${campo} col-span-11 md:col-span-4">
            <select onchange="editarRevision(${i}, 'rubro', this.value)" class="${campo} col-span-6 md:col-span-2">
                ${RUBROS.map(x => `<option value="${escapeHtml(x)}" ${x === r.rubro ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('')}
            </select>
            <input type="number" step="0.01" min="0" value="${r.costo}" oninput="editarRevision(${i}, 'costo', this.value)" class="${campo} col-span-6 md:col-span-2">
            <span id="estado-${i}" class="col-span-12 md:col-span-3 text-[10px]"></span>
        </div>
    `).join('');
    revision.forEach((_, i) => actualizarEstadoFila(i));
}

function actualizarEstadoFila(i) {
    const celda = $('estado-' + i);
    if (!celda) return;
    const r = revision[i];
    const existente = indiceNombres.get(normalizar(r.nombre));
    if (existente) {
        celda.className = 'col-span-12 md:col-span-3 text-[10px] text-amber-400';
        celda.textContent = 'Actualiza: ' + fmt(existente.costo) + ' → ' + fmt(r.costo);
    } else {
        celda.className = 'col-span-12 md:col-span-3 text-[10px] text-emerald-400';
        celda.textContent = 'Producto nuevo';
    }
}

function editarRevision(i, campo, valor) {
    if (!revision[i]) return;
    if (campo === 'costo') revision[i].costo = parseFloat(valor) || 0;
    else revision[i][campo] = valor;
    if (campo === 'nombre' || campo === 'costo') actualizarEstadoFila(i);
}

function descartarRevision() {
    revision = [];
    $('panelRevision').classList.add('hidden');
    $('revisionFilas').innerHTML = '';
}

async function guardarRevision() {
    const seleccion = revision.filter(r => r.activo && r.nombre.trim() && r.costo > 0);
    if (seleccion.length === 0) {
        mostrarEstado('No hay filas válidas seleccionadas (nombre y costo mayor a 0).', 'error');
        return;
    }

    const btn = $('btnGuardarRevision');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const filas = prepararFilas(seleccion, pctDefault());
    let guardados = 0;
    let fallidos = 0;
    let ultimoError = '';

    for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
        const lote = filas.slice(i, i + TAMANO_LOTE);
        const { error } = await supabaseClient.from('productos').upsert(lote, { onConflict: 'codigo' });
        if (error) {
            console.error('Error al guardar lote:', error);
            fallidos += lote.length;
            ultimoError = error.message || '';
        } else {
            guardados += lote.length;
        }
    }

    btn.disabled = false;
    btn.textContent = '💾 Guardar seleccionados';

    if (fallidos === 0) {
        mostrarEstado('Se guardaron ' + guardados + ' productos correctamente.', 'success');
        $('inputListaTexto').value = '';
        $('inputFotoLista').value = '';
        descartarRevision();
    } else {
        mostrarEstado('Se guardaron ' + guardados + ' y fallaron ' + fallidos + '. ' + ultimoError, 'error');
    }
    await cargarProductosBD();
}

function procesarTextoLista() {
    const texto = $('inputListaTexto').value.trim();
    if (!texto) {
        mostrarEstado('Pegá una lista de precios válida.', 'error');
        return;
    }
    armarRevision(texto);
}

function cargarScript(src) {
    return new Promise((resolve, reject) => {
        if (window.Tesseract) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar el lector de texto (OCR).'));
        document.head.appendChild(s);
    });
}

async function procesarFotoLista() {
    const inputFoto = $('inputFotoLista');
    const btn = $('btnAnalizarFoto');

    if (inputFoto.files.length === 0) {
        mostrarEstado('Seleccioná una imagen de lista de precios.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Cargando lector...';

    try {
        await cargarScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
        const worker = await Tesseract.createWorker('spa', 1, {
            logger: m => {
                if (m.status === 'recognizing text') btn.textContent = 'Leyendo foto... ' + Math.round(m.progress * 100) + '%';
            }
        });
        const resultado = await worker.recognize(inputFoto.files[0]);
        await worker.terminate();

        const texto = (resultado.data.text || '').trim();
        if (!texto) {
            mostrarEstado('No pude leer texto en la foto. Probá con una imagen más nítida.', 'error');
            return;
        }
        $('inputListaTexto').value = texto;
        armarRevision(texto);
        mostrarEstado('Foto leída. Revisá los precios.', 'success');
    } catch (err) {
        console.error('Error de OCR:', err);
        mostrarEstado('No se pudo leer la foto: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📷 Leer foto y revisar precios';
    }
}

/* ---------- Buscador ---------- */

function buscarProductos() {
    const query = normalizar($('inputBuscador').value);
    const contenedor = $('resultadosBusqueda');
    const nota = $('busquedaNota');
    const MAX = 200;

    if (productosMemoria.length === 0) {
        contenedor.innerHTML = '<p class="text-xs text-zinc-500 text-center col-span-full py-4">No hay productos cargados en el inventario.</p>';
        nota.textContent = '';
        return;
    }

    const filtrados = query === ''
        ? productosMemoria
        : productosMemoria.filter(p =>
            normalizar(p.nombre).includes(query) ||
            normalizar(p.codigo).includes(query) ||
            normalizar(p.rubro).includes(query));

    if (filtrados.length === 0) {
        contenedor.innerHTML = '<p class="text-xs text-rose-400 text-center col-span-full py-4">No se encontraron coincidencias.</p>';
        nota.textContent = '';
        return;
    }

    const visibles = filtrados.slice(0, MAX);
    nota.textContent = filtrados.length > MAX
        ? 'Mostrando ' + MAX + ' de ' + filtrados.length + ' productos. Afiná la búsqueda para ver el resto.'
        : filtrados.length + ' producto(s).';

    contenedor.innerHTML = visibles.map(p => {
        const costoReal = Number(p.costo) || 0;
        const gananciaPct = Number(p.porcentaje_ganancia);
        const pct = isNaN(gananciaPct) ? 30 : gananciaPct;
        const precio = Number(p.precio_venta) || costoReal * (1 + pct / 100);
        return `
        <div class="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col justify-between space-y-3">
            <div class="flex justify-between items-start gap-2">
                <div>
                    <p class="text-sm font-semibold text-zinc-100">${escapeHtml(p.nombre)}</p>
                    <span class="text-[10px] bg-zinc-900 border border-zinc-800 text-emerald-400 px-2 py-0.5 rounded">${escapeHtml(p.rubro || 'General')}</span>
                    <span class="text-[10px] text-zinc-500 ml-1">${escapeHtml(p.codigo)}</span>
                </div>
                <button onclick="eliminarProducto(${Number(p.id)})" title="Eliminar producto" class="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-1 rounded transition-all">
                    🗑️ Borrar
                </button>
            </div>
            <div class="pt-2 border-t border-zinc-900 grid grid-cols-2 gap-2 text-xs">
                <div>
                    <p class="text-[10px] text-zinc-400">Costo real:</p>
                    <p class="font-bold text-zinc-300">${fmt(costoReal)}</p>
                </div>
                <div>
                    <p class="text-[10px] text-emerald-400 font-semibold">Precio sugerido (+${pct}%):</p>
                    <p class="font-bold text-emerald-400 text-base">${fmt(precio)}</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function eliminarProducto(id) {
    if (!confirm('¿Querés eliminar este producto del inventario?')) return;
    const { error } = await supabaseClient.from('productos').delete().eq('id', id);
    if (error) {
        console.error('Error al eliminar producto:', error);
        mostrarEstado('Error al eliminar el producto.', 'error');
        return;
    }
    mostrarEstado('Producto eliminado del inventario.', 'success');
    await cargarProductosBD();
}

async function borrarTodoElInventario() {
    if (!confirm('¿Querés eliminar TODOS los productos cargados? Esta acción no se puede deshacer.')) return;
    const { error } = await supabaseClient.from('productos').delete().neq('id', 0);
    if (error) {
        console.error('Error al vaciar inventario:', error);
        mostrarEstado('Error al vaciar el inventario.', 'error');
        return;
    }
    mostrarEstado('Inventario vaciado correctamente.', 'success');
    await cargarProductosBD();
}