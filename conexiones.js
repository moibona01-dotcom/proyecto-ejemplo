const SUPABASE_URL = 'https://qlzvgyvvmtcswmivdrjx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SkVwbvAmpEvUYq83uEnJfw_nxo8txGG';

const RUBROS = ['General', 'Kiosco', 'Almacén', 'Verdulería'];
const TAMANO_LOTE = 200;

let supabaseClient = null;
let productosMemoria = [];
let indiceNombres = new Map();
let revision = [];
let timerBanner = null;
let passwordGuardada = null;

try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.error('Error al inicializar Supabase:', e);
}

/* ---------- Utilidades Generales ---------- */

function $(id) { return document.getElementById(id); }

function fmt(n) {
    return '$' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function redondear(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function hoyLocal() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function normalizar(t) {
    return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function slug(t) {
    return normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function mostrarEstado(mensaje, tipo = 'success') {
    const banner = $('notificationBanner');
    banner.className = 'p-3 rounded-lg text-sm transition-all duration-300 ' + (
        tipo === 'success'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
    );
    banner.textContent = mensaje;
    banner.classList.remove('hidden');
    clearTimeout(timerBanner);
    timerBanner = setTimeout(() => banner.classList.add('hidden'), 6000);
}

function setBadge(tipo, texto) {
    const colores = {
        ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        error: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        espera: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    };
    $('statusBadge').className = 'px-3 py-1 rounded-full text-xs font-semibold border flex items-center space-x-1.5 ' + colores[tipo];
    $('statusText').textContent = texto;
}

/* ---------- Control de Acceso ---------- */

async function verificarPasswordBD() {
    try {
        const { data, error } = await supabaseClient.from('configuracion').select('valor').eq('clave', 'password_maestra').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data ? data.valor : null;
    } catch (e) {
        console.error("Error al consultar clave maestra:", e);
        return null;
    }
}

async function iniciar() {
    if (!supabaseClient) {
        setBadge('error', 'Error de cliente Supabase');
        return;
    }

    setBadge('espera', 'Verificando seguridad...');
    passwordGuardada = await verificarPasswordBD();

    if (!passwordGuardada) {
        $('tituloAcceso').textContent = 'Crear Contraseña Maestra';
        $('subtituloAcceso').textContent = 'Define la contraseña que protegerá el acceso al sistema.';
        $('btnAcceso').textContent = 'Guardar y Continuar';
        $('seccionAcceso').classList.remove('hidden');
    } else {
        $('tituloAcceso').textContent = 'Acceso al Sistema';
        $('subtituloAcceso').textContent = 'Ingresa la contraseña para acceder a la gestión.';
        $('btnAcceso').textContent = 'Ingresar';
        $('seccionAcceso').classList.remove('hidden');
    }
    setBadge('ok', 'Conectado');
}

async function procesarAcceso(e) {
    e.preventDefault();
    const inputVal = $('inputPassword').value.trim();

    if (!inputVal) return;

    if (!passwordGuardada) {
        const { error } = await supabaseClient.from('configuracion').upsert({ clave: 'password_maestra', valor: inputVal });
        if (error) {
            mostrarEstado('Error al guardar la contraseña.', 'error');
            return;
        }
        passwordGuardada = inputVal;
        mostrarEstado('Contraseña creada correctamente.', 'success');
        desbloquearApp();
    } else {
        if (inputVal === passwordGuardada) {
            desbloquearApp();
        } else {
            mostrarEstado('Contraseña incorrecta.', 'error');
        }
    }
}

async function desbloquearApp() {
    $('seccionAcceso').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('btnBloquear').classList.remove('hidden');
    $('inputPassword').value = '';

    cargarPctDefault();
    if (!$('ventaFecha').value) $('ventaFecha').value = hoyLocal();
    if (!$('ventaMesFiltro').value) $('ventaMesFiltro').value = hoyLocal().slice(0, 7);

    await cargarProductosBD();
    await cargarVentasDiarias();
}

async function bloquearOResetearAcceso() {
    const opcion = confirm("¿Deseas bloquear la pantalla?\n\n[Aceptar] Bloquear pantalla\n[Cancelar] Volver a la app");
    if (opcion) {
        const cambiar = confirm("¿Quieres también RESETEAR y CAMBIAR la contraseña actual?");
        if (cambiar) {
            await supabaseClient.from('configuracion').delete().eq('clave', 'password_maestra');
            mostrarEstado('Contraseña eliminada. Define una nueva.', 'success');
        }
        location.reload();
    }
}

window.onload = function () {
    iniciar();
};