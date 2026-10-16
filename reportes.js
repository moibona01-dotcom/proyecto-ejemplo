// Cargar y procesar Reportes
async function cargarReportes() {
    const container = document.getElementById('reportesContainer');
    if (!supabaseClient) return;

    try {
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!ventas || ventas.length === 0) {
            container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Sin datos de ventas acumulados.</p>';
            actualizarMetricas(0, 0, '-');
            return;
        }

        // Métricas
        let totalRecaudado = 0;
        const conteoMedios = {};

        ventas.forEach(v => {
            totalRecaudado += Number(v.total || 0);
            conteoMedios[v.medio_pago] = (conteoMedios[v.medio_pago] || 0) + 1;
        });

        // Determinar medio más usado
        let medioPopular = '-';
        let maxUso = 0;
        for (const [medio, cantidad] of Object.entries(conteoMedios)) {
            if (cantidad > maxUso) {
                maxUso = cantidad;
                medioPopular = medio;
            }
        }

        actualizarMetricas(totalRecaudado, ventas.length, medioPopular);

        // Renderizar lista de ventas
        container.innerHTML = '';
        ventas.slice(0, 15).forEach(v => {
            const fechaStr = v.created_at ? new Date(v.created_at).toLocaleString() : 'Fecha N/A';
            const div = document.createElement('div');
            div.className = "bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <p class="text-slate-200 font-medium">Venta #${v.id} - <span class="text-indigo-400">${escapeHtml(v.medio_pago)}</span></p>
                    <p class="text-[10px] text-slate-500">${fechaStr}</p>
                </div>
                <div class="text-right font-bold text-emerald-400">
                    +$${Number(v.total).toFixed(2)}
                </div>
            `;
            container.appendChild(div);
        });

    } catch (err) {
        console.error('Error al cargar reportes:', err);
        container.innerHTML = `<p class="text-xs text-rose-400 text-center py-2">No se pudieron cargar los reportes.</p>`;
    }
}

function actualizarMetricas(total, cantidad, medioPopular) {
    document.getElementById('reporteTotalVentas').textContent = `$${total.toFixed(2)}`;
    document.getElementById('reporteCantidadVentas').textContent = cantidad;
    document.getElementById('reporteMedioPopular').textContent = medioPopular;
}