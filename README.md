# 🌤️ App del Clima

App web del clima hecha con **HTML, CSS y JavaScript puro**, usando la API de [Open-Meteo](https://open-meteo.com) (gratuita, sin API key).

Consulta el clima de **una o varias ciudades** a la vez y obtén temperatura, humedad, viento, precipitación y la **hora local** de cada ciudad.

---

## Deploy

https://marthajcaro.github.io/Clima-App-IA/

## ✨ Funciones

- 🌍 **Varias ciudades en una sola petición**: escribe `Bogotá, Madrid, Tokio` separadas por comas.
- 🌡️ Muestra **temperatura** (°C).
- 💧 **Humedad** (%).
- 🌬️ **Viento** (km/h).
- 🌧️ **Precipitación** (mm).
- 🕒 **Hora local** de cada ciudad consultada.
- 📶 **Funciona sin conexión**: guarda los datos en `localStorage` y si no hay internet devuelve los datos guardados con un aviso.
- 🎨 Diseño "vidrio esmerilado" (`backdrop-filter`) que combina con la imagen de fondo.

---

## 🚀 Cómo usarla

1. Abre `index.html` con doble clic en tu navegador. **(No necesitas servidor ni instalar nada.)**
2. Escribe una ciudad o varias separadas por comas, por ejemplo: `Bogotá, Madrid, Tokio`.
3. Pulsa **Consultar**.

---

## 📁 Estructura

```
app-clima/
├── index.html    → estructura (formulario + tarjetas de resultado)
├── styles.css    → estilos (fondo, vidrio esmerilado, métricas, hora)
└── app.js        → lógica (API, caché, renderizado)
```

---

## 🔑 Cómo funciona (código)

### `normalizar(texto)`

Convierte "Bogotá" y "bogotá" en la misma clave (`bogota`) para que la caché no se duplique.

### `getWeather(ciudad)`

Devuelve el clima de **una** ciudad, revisando primero la caché fresca (10 min). Si la red falla, responde con lo guardado (`deCache: true`).

### `getWeatherVarias(ciudades)`

Geocodifica todas las ciudades en paralelo y hace **UNA sola petición** de clima (la API acepta `lat,lon` separados por coma y devuelve un array).

### `pedirClimaVarias(posiciones)`

Llamada real a la API:

```
https://api.open-meteo.com/v1/forecast
  ?latitude=<lat,lat,…>
  &longitude=<lon,lon,…>
  &current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code
```

### Caché (`localStorage`)

- Clave: `app-clima-cache`
- TTL: **10 minutos** (se considera "fresco").
- Sin conexión → se devuelven los datos guardados aunque sean viejos, con la nota `caché (sin conexión)`.

### `horaLocal(d)`

Usa la zona horaria que devuelve la geocodificación (`timezone`, ej. `America/Bogota`) y `Intl.DateTimeFormat` para mostrar **la hora de la ciudad**, no la de tu PC.

---

## 🌦️ Códigos de clima (WMO)

| Código | Clima     | Emoji    |
| ------ | --------- | -------- |
| 0      | Despejado | ☀️       |
| 1–3    | Nubes     | 🌤️ ⛅ ☁️ |
| 45–48  | Niebla    | 🌫️       |
| 51–55  | Llovizna  | 🌦️ 🌧️    |
| 61–65  | Lluvia    | 🌧️       |
| 80–82  | Chubascos | 🌦️ 🌧️ ⛈️ |
| 95–96  | Tormenta  | ⛈️       |

---

## 🛠️ Notas técnicas

- **Sin frameworks ni librerías** (solo `fetch`, `Intl.DateTimeFormat` y `localStorage`).
- **Sin API key**: Open-Meteo es gratis y de código abierto.
- Funciona abriendo el archivo local sin servidor, pero también en cualquier hosting estático.
