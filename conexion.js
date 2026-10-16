// Credenciales de Supabase
const SUPABASE_URL = 'https://qlzvgyvvmtcswmivdrjx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SkVwbvAmpEvUYq83uEnJfw_nxo8txGG';

// Variable global única inicializada de manera segura
let supabaseClient = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error("Librería de Supabase no encontrada en window.");
    }
} catch (e) {
    console.error("Error al inicializar cliente:", e);
}