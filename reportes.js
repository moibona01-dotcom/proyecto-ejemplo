async function guardarVentaDiaria(e) {
    e.preventDefault();
    const fecha = document.getElementById('ventaFecha').value;
    const rubro = document.getElementById('ventaRubro').value;
    const totalVendido = parseFloat(document.getElementById('ventaTotal').value);
    const porcentaje = parseFloat(document.getElementById('ventaPorcentaje').value);

    if (!fecha || !rubro || isNaN(totalVendido) || isNaN(porcentaje)) {
        mostrarEstado('Completa todos los campos de la venta diaria.', 'error');
        return;
    }

    // Cálculo de la ganancia neta: el porcentaje ingresado aplicado sobre el total vendido (Ej: $400.000 * 30% = $120.000)
    const gananciaNeta = totalVendido * (porcentaje / 100);

    try {
        const { error } = await supabaseClient
            .from('ventas_diarias')
            .insert([{
                fecha: fecha,
                rubro: rubro,
                total_vendido: totalVendido,
                porcentaje_aplicado: porcentaje,
                ganancia_neta: gananciaNeta
            }]);

        if (error) throw error;

        mostrarEstado('Venta diaria registrada con éxito.', 'success');
        document.getElementById('formVentaDiaria').reset();
        document.getElementById('ventaFecha').valueAsDate = new Date();
        document.getElementById('ventaPorcentaje').value = '30';
        cargarVentasDiarias();
    } catch (err) {
        console.error('Error al registrar venta diaria:', err);
        mostrarEstado('Error al guardar: ' + err.message, 'error');
    }
}

async function cargarVentasDiarias() {
    const container = document.getElementById('ventasDiariasContainer');
    if (!supabaseClient) return;

    try {
        const { data: ventas, error } = await supabaseClient
            .from('ventas_diarias')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;

        if (!ventas || ventas.length === 0) {
            container.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Sin datos de ventas diarios.</p>';
            actualizarMetricasMensuales(0, 0);
            return;
        }

        let totalVentasMes = 0;
        let gananciaNetaMes = 0;
        const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM

        ventas.forEach(v => {
            const totalV = Number(v.total_vendido || 0);
            const gananciaV = Number(v.ganancia_neta || 0);

            if (v.fecha && v.fecha.startsWith(mesActual)) {
                totalVentasMes += totalV;
                gananciaNetaMes += gananciaV;
            }
        });

        actualizarMetricasMensuales(totalVentasMes, gananciaNetaMes);

        container.innerHTML = '';
        ventas.slice(0, 15).forEach(v => {
            const div = document.createElement('div');
            div.className = "bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 text-xs flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <p class="text-zinc-200 font-medium">${v.fecha} - Rubro: <span class="text-emerald-400">${escapeHtml(v.rubro)}</span></p>
                    <p class="text-[10px] text-zinc-400">Total Vendido: $${Number(v.total_vendido).toFixed(2)} (${v.porcentaje_aplicado}%)</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-emerald-400">Ganancia: +$${Number(v.ganancia_neta || 0).toFixed(2)}</p>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (err) {
        console.error('Error al cargar reportes:', err);
        container.innerHTML = `<p class="text-xs text-rose-400 text-center py-2">No se pudieron cargar los registros.</p>`;
    }
}

function actualizarMetricasMensuales(totalVentas, gananciaMensual) {
    document.getElementById('reporteTotalVentasMes').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('reporteGananciaMensual').textContent = `$${gananciaMensual.toFixed(2)}`;
}