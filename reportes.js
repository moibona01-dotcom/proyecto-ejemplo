/* ---------- Registro de Ventas y Reportes ---------- */

async function guardarVentaDiaria(e) {
    e.preventDefault();
    const fecha = $('ventaFecha').value;
    const rubro = $('ventaRubro').value;
    const total = parseFloat($('ventaTotal').value);
    const porcentaje = parseFloat($('ventaPorcentaje').value);

    if (!fecha || !rubro || isNaN(total) || isNaN(porcentaje) || total < 0 || porcentaje < 0) {
        mostrarEstado('Completá todos los campos de la venta con valores válidos.', 'error');
        return;
    }

    const dineroReponer = redondear(total / (1 + porcentaje / 100));
    const gananciaNeta = redondear(total - dineroReponer);

    const { error } = await supabaseClient.from('ventas_diarias').insert([{
        fecha: fecha,
        rubro: rubro,
        total_vendido: total,
        porcentaje_ganancia: porcentaje,
        dinero_reponer: dineroReponer,
        ganancia_neta: gananciaNeta
    }]);

    if (error) {
        console.error('Error al guardar venta:', error);
        mostrarEstado('Error al registrar la venta.', 'error');
        return;
    }

    mostrarEstado('Venta registrada con éxito.', 'success');
    $('ventaTotal').value = '';
    $('ventaMesFiltro').value = fecha.slice(0, 7);
    await cargarVentasDiarias();
}

function rangoDelMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    const p = n => String(n).padStart(2, '0');
    const desde = y + '-' + p(m) + '-01';
    const hasta = m === 12 ? (y + 1) + '-01-01' : y + '-' + p(m + 1) + '-01';
    return { desde, hasta };
}

async function cargarVentasDiarias() {
    const container = $('ventasDiariasContainer');
    if (!supabaseClient) return;

    const mes = $('ventaMesFiltro').value || hoyLocal().slice(0, 7);
    const { desde, hasta } = rangoDelMes(mes);

    const { data, error } = await supabaseClient
        .from('ventas_diarias').select('*')
        .gte('fecha', desde).lt('fecha', hasta)
        .order('fecha', { ascending: false }).order('id', { ascending: false });

    if (error) {
        console.error('Error al cargar ventas:', error);
        container.innerHTML = '<p class="text-xs text-rose-400 text-center py-2">Error al cargar el historial.</p>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Sin registros de ventas en este mes.</p>';
        $('reporteTotalVentasMes').textContent = fmt(0);
        $('reporteReponerMensual').textContent = fmt(0);
        $('reporteGananciaMensual').textContent = fmt(0);
        return;
    }

    let totalVentas = 0, totalReponer = 0, totalGanancia = 0;

    container.innerHTML = data.map(v => {
        const vendido = Number(v.total_vendido) || 0;
        const ganancia = Number(v.ganancia_neta) || 0;
        const reponer = Number(v.dinero_reponer) || (vendido - ganancia);
        totalVentas += vendido;
        totalReponer += reponer;
        totalGanancia += ganancia;
        return `
        <div class="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-xs flex justify-between items-center gap-2">
            <div>
                <span class="font-semibold text-zinc-200">${escapeHtml(v.fecha)}</span>
                <span class="text-[10px] bg-zinc-950 px-1.5 py-0.5 rounded text-emerald-400 border border-zinc-800 ml-1">${escapeHtml(v.rubro)}</span>
                <p class="text-[10px] text-zinc-400 mt-0.5">Vendido: <strong>${fmt(vendido)}</strong> (${escapeHtml(v.porcentaje_ganancia)}% recargo)</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right space-y-0.5">
                    <p class="text-[10px] text-amber-400">Reponer: <strong>${fmt(reponer)}</strong></p>
                    <p class="text-[10px] text-emerald-400">Ganancia: <strong>${fmt(ganancia)}</strong></p>
                </div>
                <button onclick="eliminarVenta(${Number(v.id)})" title="Eliminar registro" class="text-rose-400 hover:text-rose-300 text-xs">🗑️</button>
            </div>
        </div>`;
    }).join('');

    $('reporteTotalVentasMes').textContent = fmt(totalVentas);
    $('reporteReponerMensual').textContent = fmt(totalReponer);
    $('reporteGananciaMensual').textContent = fmt(totalGanancia);
}

async function eliminarVenta(id) {
    if (!confirm('¿Eliminar este registro de venta?')) return;
    const { error } = await supabaseClient.from('ventas_diarias').delete().eq('id', id);
    if (error) {
        console.error('Error al eliminar venta:', error);
        mostrarEstado('Error al eliminar el registro.', 'error');
        return;
    }
    mostrarEstado('Registro eliminado.', 'success');
    await cargarVentasDiarias();
}

async function borrarHistorialVentas() {
    if (!confirm('¿Estás seguro de que querés eliminar TODO el historial de ventas (de todos los meses)?')) return;
    const { error } = await supabaseClient.from('ventas_diarias').delete().neq('id', 0);
    if (error) {
        console.error('Error al eliminar historial:', error);
        mostrarEstado('Error al eliminar el historial.', 'error');
        return;
    }
    mostrarEstado('Historial de ventas eliminado correctamente.', 'success');
    await cargarVentasDiarias();
}