// assets/script.js

// Función para parsear parámetros de query string
function getQueryParams() {
  const params = {};
  window.location.search
    .substring(1)
    .split("&")
    .forEach(pair => {
      const [key, value] = pair.split("=");
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });
  return params;
}

// Cargar config_locations.json
async function fetchConfig() {
  const res = await fetch("data/config_locations.json");
  return await res.json();
}

// Construir listado de locaciones en index.html
async function populateLocaciones() {
  const config = await fetchConfig();
  const ul = document.getElementById("locaciones-lista");
  config.locaciones.forEach(loc => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `locacion.html?loc=${loc.id}`;
    a.textContent = loc.nombre;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// Construir listado de canchas en locacion.html
async function populateCanchas() {
  const params = getQueryParams();
  const locId = params.loc;
  const config = await fetchConfig();
  const loc = config.locaciones.find(l => l.id === locId);

  if (!loc) {
    document.getElementById("canchas-lista").innerHTML = "<li>Locación no encontrada</li>";
    return;
  }

  document.getElementById("nombre-locacion").textContent = loc.nombre;
  const ul = document.getElementById("canchas-lista");
  loc.cancha.forEach(can => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `cancha.html?loc=${locId}&can=${can.id}`;
    a.textContent = can.nombre;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// Construir listado de lados en cancha.html
async function populateLados() {
  const params = getQueryParams();
  const locId = params.loc, canId = params.can;
  const config = await fetchConfig();
  const loc = config.locaciones.find(l => l.id === locId);
  if (!loc) return;
  const can = loc.cancha.find(c => c.id === canId);
  if (!can) {
    document.getElementById("lados-lista").innerHTML = "<li>Cancha no encontrada</li>";
    return;
  }

  document.getElementById("nombre-cancha").textContent = can.nombre;
  const ul = document.getElementById("lados-lista");
  can.lados.forEach(lado => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `lado.html?loc=${locId}&can=${canId}&lado=${lado}`;
    a.textContent = lado;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// Mostrar listado de videos en lado.html
async function populateVideos() {
  const params = getQueryParams();
  const locId = params.loc, canId = params.can, ladoId = params.lado;
  document.getElementById("nombre-lado").textContent =
    `Videos: ${locId} / ${canId} / ${ladoId}`;

  // Aquí va tu URL completa al JSON en Dropbox, incluyendo rlkey y st, y dl=1:
  const jsonUrl = "https://dl.dropboxusercontent.com/s/6eftuej2gbti8roord6oe/videos_recientes.json?rlkey=zh5qs2l8jsl3odyc8zifb52t8&st=to7j0lv7&dl=1";

  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) throw new Error("JSON no encontrado en Dropbox");
    const data = await res.json();
    const container = document.getElementById("videos-container");

    data.videos.sort((a, b) => {
      const t1 = a.nombre.match(/\d+/g).join("");
      const t2 = b.nombre.match(/\d+/g).join("");
      return parseInt(t2) - parseInt(t1);
    });

    data.videos.forEach(entry => {
      // entry.url viene con la forma:
      // "https://www.dropbox.com/scl/fi/o0or0mobpuw34uj9pgg3w/video_final_20250604_143344.mp4?rlkey=okhl6akjy4omo1x319a4j42gp&st=y2ykfq33&dl=0"

      // 1. Cambiamos el dominio:
      let rawUrl = entry.url.replace(
        /^https:\/\/www\.dropbox\.com/,
        "https://dl.dropboxusercontent.com"
      );
      // 2. Cambiamos dl=0 a dl=1 (sin tocar rlkey ni st)
      rawUrl = rawUrl.replace(/([\?&])dl=0$/, "$1dl=1");

      const card = document.createElement("div");
      card.className = "video-container";

      const video = document.createElement("video");
      video.controls = true;
      video.src = rawUrl;
      card.appendChild(video);

      const linkDesc = document.createElement("a");
      linkDesc.className = "btn-descarga";
      linkDesc.href = rawUrl;
      linkDesc.textContent = "Descargar video";
      card.appendChild(linkDesc);

      const pName = document.createElement("p");
      pName.className = "video-nombre";
      pName.textContent = entry.nombre;
      card.appendChild(pName);

      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error en populateVideos():", err);
    const container = document.getElementById("videos-container");
    container.innerHTML = "<p>No hay videos disponibles en este momento.</p>";
  }
}


// Detectar en qué página estamos y llamar a la función adecuada:
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path.endsWith("index.html") || path.endsWith("/")) {
    populateLocaciones();
  } else if (path.endsWith("locacion.html")) {
    populateCanchas();
  } else if (path.endsWith("cancha.html")) {
    populateLados();
  } else if (path.endsWith("lado.html")) {
    populateVideos();
  }
});
