// ============================================================
// app.js — Clima con Open-Meteo
// Funciones:
//   - getWeather(ciudad)          -> una ciudad (con caché)
//   - getWeatherVarias(ciudades)  -> varias en UNA petición
//   - Caché en localStorage para funcionar sin conexión.
// ============================================================

// NORMALIZAR NOMBRES: "Bogotá" y "bogota" son la MISMA clave.
function normalizar(texto) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")                  // separa acentos
    .replace(/[\u0300-\u036f]/g, "");  // quita los acentos
}

// ============================================================
// CACHÉ (localStorage) — aguanta recargas y modo sin conexión
// ============================================================
const CACHE_KEY = "app-clima-cache-v2";      // v2: guarda nombre/pais/zona
const CACHE_TTL = 10 * 60 * 1000;      // 10 minutos = "fresco"

// Limpiar caché de la versión anterior (no tenía nombre/zona -> datos incompletos)
try { localStorage.removeItem("app-clima-cache"); } catch (e) {}

function leerCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
  catch (e) { return {}; }
}

function guardarCache(ciudad, datos) {
  const cache = leerCache();
  cache[ciudad] = Object.assign({ guardadoEn: Date.now() }, datos);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
}

function cacheFresca(ciudad) {
  const cache = leerCache();
  const e = cache[ciudad];
  if (!e) return null;
  if (Date.now() - e.guardadoEn > CACHE_TTL) return null; // viejo -> no cuenta como fresco
  return e;
}

// ============================================================
// CODIGOS WMO -> texto + emoji
// ============================================================
const CODIGOS_CLIMA = {
  0:  { texto: "Despejado",            icono: "☀️" },
  1:  { texto: "Mayormente despejado", icono: "🌤️" },
  2:  { texto: "Parcialmente nublado", icono: "⛅" },
  3:  { texto: "Nublado",              icono: "☁️" },
  45: { texto: "Niebla",               icono: "🌫️" },
  48: { texto: "Niebla con escarcha",  icono: "🌫️" },
  51: { texto: "Llovizna ligera",      icono: "🌦️" },
  53: { texto: "Llovizna moderada",    icono: "🌦️" },
  55: { texto: "Llovizna intensa",     icono: "🌧️" },
  61: { texto: "Lluvia ligera",        icono: "🌧️" },
  63: { texto: "Lluvia moderada",      icono: "🌧️" },
  65: { texto: "Lluvia intensa",       icono: "🌧️" },
  80: { texto: "Chubascos ligeros",    icono: "🌦️" },
  81: { texto: "Chubascos moderados",  icono: "🌧️" },
  82: { texto: "Chubascos violentos",  icono: "⛈️" },
  95: { texto: "Tormenta",             icono: "⛈️" },
  96: { texto: "Tormenta con granizo", icono: "⛈️" }
};

const API_GEO   = "https://geocoding-api.open-meteo.com/v1/search";
const API_CLIMA = "https://api.open-meteo.com/v1/forecast";

// ============================================================
// GEOCODIFICAR: nombre de ciudad -> lat/lon
// ============================================================
async function geocodificar(ciudad) {
  // Y si ya la tengo en caché COMPLETA? no vuelvo a la red.
  const fresca = cacheFresca(ciudad);
  if (fresca && fresca.lat != null && fresca.lon != null &&
      fresca.nombre != null && fresca.zona != null) {
    return { lat: fresca.lat, lon: fresca.lon, nombre: fresca.nombre, zona: fresca.zona, pais: fresca.pais, deCache: true };
  }

  const url =
    API_GEO +
    "?name=" + encodeURIComponent(ciudad) +
    "&count=1&language=es&format=json";

  const res = await fetch(url);            // puede fallar si NO hay red
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No se encontró la ciudad: " + ciudad);
  }
  const lugar = data.results[0];
  return {
    lat: lugar.latitude,
    lon: lugar.longitude,
    nombre: lugar.name,
    zona: lugar.timezone,     // ej. "America/Bogota" -> para la hora local
    pais: lugar.country
  };
}

// ============================================================
// getWeather(ciudad) — UNA ciudad, con caché y sin conexión
// ============================================================
async function getWeather(ciudad) {
  const clave = normalizar(ciudad);

  // 1) ¿Tengo una copia FRESCA guardada? -> devuelvo al instante.
  const fresca = cacheFresca(clave);
  if (fresca && fresca.temperatura != null) {
    return Object.assign({ deCache: true, cacheFresca: true }, fresca);
  }

  try {
    const pos = await geocodificar(clave);
    const datos = await pedirClima(pos);

    // 2) Guardo para la próxima vez (y para el modo sin conexión).
    guardarCache(clave, datos);
    return Object.assign({ deCache: false }, datos);
  } catch (error) {
    // 3) Falló la red -> busco lo que haya guardado, aunque sea viejo.
    const vieja = leerCache()[clave];
    if (vieja && vieja.temperatura != null) {
      return Object.assign({ deCache: true, cacheFresca: false }, vieja);
    }
    throw new Error("Sin conexión y sin datos guardados para: " + ciudad);
  }
}

// ============================================================
// Petición de CLIMA en lote: varias ciudades en UNA llamada.
// La API acepta lat/lon separados por coma y devuelve un ARRAY.
// ============================================================
async function pedirClimaVarias(posiciones) {
  const lat = posiciones.map(p => p.lat).join(",");
  const lon = posiciones.map(p => p.lon).join(",");

  const url =
    API_CLIMA +
    "?latitude=" + lat +
    "&longitude=" + lon +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code";

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  // Con UNA ciudad la API devuelve un OBJETO; con varias, un ARRAY.
  const json = await res.json();
  const lista = Array.isArray(json) ? json : [json];

  // Emparejar cada resultado con SU ciudad.
  return posiciones.map((pos, i) => {
    const c = lista[i].current;
    return {
      ciudad: pos.nombre,
      zona: pos.zona,
      pais: pos.pais,
      lat: pos.lat,
      lon: pos.lon,
      temperatura: c.temperature_2m,          // °C
      humedad: c.relative_humidity_2m,        // %
      viento: c.wind_speed_10m,               // km/h
      precipitacion: c.precipitation,         // mm
      codigo: c.weather_code
    };
  });
}

async function pedirClima(pos) {
  const [unico] = await pedirClimaVarias([pos]);
  return unico;
}

// ============================================================
// getWeatherVarias(ciudades) — TODO en UNA petición de red
// ============================================================
async function getWeatherVarias(ciudades) {
  const claves = ciudades.map(normalizar);

  try {
    // Geocodificar todas (en paralelo) -> luego UNA llamada de clima.
    const posiciones = await Promise.all(claves.map(geocodificar));
    const datos = await pedirClimaVarias(posiciones);

    // Guardar todas en caché.
    datos.forEach((d, i) => guardarCache(claves[i], d));
    return datos;
  } catch (error) {
    // Sin conexión: responder con lo guardado.
    const cache = leerCache();
    const datos = claves
      .map(c => cache[c])
      .filter(e => e && e.temperatura != null)
      .map(e => Object.assign({ deCache: true, cacheFresca: false }, e));

    if (datos.length === 0) {
      throw new Error("Sin conexión y sin datos guardados.");
    }
    return datos;
  }
}

// ============================================================
// Renderizar en pantalla
// ============================================================

// Hora local de la ciudad (según su zona horaria, e.g. America/Bogota)
function horaLocal(d) {
  const zona = d.zona || undefined; // si no hay zona, usa la del navegador
  const formateador = new Intl.DateTimeFormat([], {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    day: "numeric",
    month: "short"
  });
  return formateador.format(new Date());
}

function pintarClima(datos) {
  const destino = document.getElementById("resultado");
  const estado  = document.getElementById("estado");

  if (datos.length === 0) {
    estado.textContent = "No se encontró ninguna ciudad.";
    return;
  }

  estado.textContent = datos.some(d => d.deCache)
    ? "⚠ Sin conexión: mostrando datos guardados."
    : "";

  destino.innerHTML = datos
    .map(d => {
      const clima = CODIGOS_CLIMA[d.codigo] || { texto: "Desconocido", icono: "❓" };
      const nota = d.deCache
        ? (d.cacheFresca ? "<p class='origen'>caché (recién guardado)</p>"
                         : "<p class='origen'>caché (sin conexión)</p>")
        : "";
      return (
        "<article class='card'>" +
          "<p class='ciudad'>" + d.ciudad + "</p>" +
          "<p class='hora'>🕒 " + horaLocal(d) + "</p>" +
          "<p class='icono'>" + clima.icono + "</p>" +
          "<p class='texto'>" + clima.texto + "</p>" +
          "<p class='temp'>" + d.temperatura + " °C</p>" +
          "<div class='metricas'>" +
            "<div class='metrica'><span class='met-num'>" + d.humedad + "%</span><span class='met-lab'>Humedad</span></div>" +
            "<div class='metrica'><span class='met-num'>" + d.viento + " km/h</span><span class='met-lab'>Viento</span></div>" +
            "<div class='metrica'><span class='met-num'>" + d.precipitacion + " mm</span><span class='met-lab'>Precipitación</span></div>" +
          "</div>" +
          nota +
        "</article>"
      );
    })
    .join("");
}

// ============================================================
// Formulario
// ============================================================
document.getElementById("formulario").addEventListener("submit", async (event) => {
  event.preventDefault();

  const valor   = document.getElementById("ciudad").value.trim();
  const estado  = document.getElementById("estado");

  if (!valor) { estado.textContent = "Escribe al menos una ciudad."; return; }

  const ciudades = valor
    .split(",")                  // separa por comas
    .map(c => c.trim())          // quita espacios
    .filter(c => c.length > 0);  // descarta vacíos

  estado.textContent = "Consultando…";
  document.getElementById("resultado").innerHTML = "";

  try {
    const datos = ciudades.length === 1
      ? [await getWeather(ciudades[0])]      // una ciudad
      : await getWeatherVarias(ciudades);    // varias a la vez
    pintarClima(datos);
  } catch (error) {
    estado.textContent = error.message;
  }
});