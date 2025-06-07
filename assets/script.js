// assets/script.js

// 1) Leer parámetros de URL
function getQueryParams() {
  const params = {};
  window.location.search
    .substring(1)
    .split("&")
    .forEach(pair => {
      const [k, v] = pair.split("=");
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
  return params;
}

// 2) Cargar config_locations.json
async function fetchConfig() {
  const res = await fetch("data/config_locations.json");
  return await res.json();
}

// 3) Generar menú dinámico (locaciones, canchas, lados)… (igual que antes)
//    (omito aquí populateLocaciones, populateCanchas y populateLados por brevedad)

// 4) Mostrar videos en lado.html
async function populateVideos() {
  const params = getQueryParams();
  const locId  = params.loc;
  const canId  = params.can;
  const ladoId = params.lado;

  // Cargamos la configuración completa
  const { locaciones } = await fetchConfig();
  const loc  = locaciones.find(l => l.id === locId);
  if (!loc) return console.error("Locación no encontrada");
  const can  = loc.cancha.find(c => c.id === canId);
  if (!can) return console.error("Cancha no encontrada");
  const lado = can.lados.find(x => x.id === ladoId);
  if (!lado) return console.error("Lado no encontrado");

  // Construir URL al JSON de Dropbox
  const jsonUrl = 
    `https://dl.dropboxusercontent.com/s/${lado.dropbox_folder_id}/videos_recientes.json` +
    `?rlkey=${lado.rlkey}&st=${lado.st}&dl=1`;

  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) throw new Error("No se pudo cargar JSON");
    const data = await res.json();

    // Actualizar título de página
    document.getElementById("nombre-club").textContent        = loc.nombre.toUpperCase();
    document.getElementById("nombre-cancha-lado").textContent = 
      `${can.nombre} – ${lado.nombre}`;

    // Ordenar videos del más nuevo al más antiguo
    data.videos.sort((a, b) => {
      const t1 = a.nombre.match(/\d+/g).join("");
      const t2 = b.nombre.match(/\d+/g).join("");
      return parseInt(t2) - parseInt(t1);
    });

    // Vaciar contenedor y crear tarjetas
    const container = document.getElementById("videos-container");
    container.innerHTML = "";

    data.videos.forEach(entry => {
      // Convertir share URL a raw
      let rawUrl = entry.url
        .replace(/^https:\/\/www\.dropbox\.com/, "https://dl.dropboxusercontent.com")
        .replace(/([\?&])dl=0$/, "$1dl=1");

      // Extraer hora: video_final_YYYYMMDD_HHMMSS.mp4 → HH:MM:SS
      const m = entry.nombre.match(/_(\d{2})(\d{2})(\d{2})\.mp4$/);
      const displayTime = m ? `${m[1]}:${m[2]}:${m[3]}` : entry.nombre;

      // Construir tarjeta
      const card = document.createElement("div");
      card.className = "video-card";

      const title = document.createElement("div");
      title.className = "video-title";
      title.textContent = displayTime;
      card.appendChild(title);

      const video = document.createElement("video");
      video.controls = true;
      video.src = rawUrl;
      card.appendChild(video);

      const btn = document.createElement("button");
      btn.className = "btn-download";
      btn.textContent = "Descargar";
      btn.onclick = () => window.open(rawUrl, "_blank");
      card.appendChild(btn);

      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    document.getElementById("videos-container").innerHTML =
      "<p class='no-videos'>No hay videos disponibles.</p>";
  }
}

// 5) Arrancar
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path.endsWith("lado.html")) {
    populateVideos();
  } 
  // …y tus llamadas a populateLocaciones, populateCanchas, populateLados…
});
