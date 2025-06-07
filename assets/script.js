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
  // 1) Obtener params de URL
  const { loc, can, lado } = getQueryParams();

  // 2) Cargar configuración
  const { locaciones } = await fetch("data/config_locations.json").then(r => r.json());
  const locObj = locaciones.find(l => l.id === loc);
  if (!locObj) return console.error("Locación no encontrada");
  const canObj = locObj.cancha.find(c => c.id === can);
  if (!canObj) return console.error("Cancha no encontrada");
  const ladoObj = canObj.lados.find(x => x.id === lado);
  if (!ladoObj) return console.error("Lado no encontrado");

  // 3) Montar URL raw al JSON en Dropbox
  const jsonUrl = 
    `https://dl.dropboxusercontent.com/s/${ladoObj.dropbox_folder_id}/videos_recientes.json` +
    `?rlkey=${ladoObj.rlkey}&st=${ladoObj.st}&dl=1`;

  try {
    // 4) Fetch y parse
    const data = await fetch(jsonUrl).then(r => {
      if (!r.ok) throw new Error("JSON no encontrado");
      return r.json();
    });

    // 5) Actualizar encabezados
    document.getElementById("nombre-club").textContent        = locObj.nombre.toUpperCase();
    document.getElementById("nombre-cancha-lado").textContent = `${canObj.nombre} – ${ladoObj.nombre}`;

    // 6) Ordenar y renderizar tarjetas
    const container = document.getElementById("videos-container");
    container.innerHTML = "";

    data.videos
      .sort((a, b) => {
        const t1 = a.nombre.match(/\d+/g).join("");
        const t2 = b.nombre.match(/\d+/g).join("");
        return parseInt(t2) - parseInt(t1);
      })
      .forEach(entry => {
        // Convertir share → raw
        let rawUrl = entry.url
          .replace(/^https:\/\/www\.dropbox\.com/, "https://dl.dropboxusercontent.com")
          .replace(/([\?&])dl=0$/, "$1dl=1");

        // Extraer hora
        const m = entry.nombre.match(/_(\d{2})(\d{2})(\d{2})\.mp4$/);
        const displayTime = m ? `${m[1]}:${m[2]}:${m[3]}` : entry.nombre;

        // Crear tarjeta
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
