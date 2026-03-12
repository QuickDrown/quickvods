const streamsUrl = window.STREAMS_URL || "streams_public.json";
const DISCORD_CONTACT = "Quick_Drown";

let streams = [];
let currentStream = null;

fetch(streamsUrl)
  .then(response => response.json())
  .then(data => {
    streams = data;

    updateVodStats();

    initYears();
    initStreamers();

    const hasUrlFilters = window.location.search.length > 1;
    if (hasUrlFilters) {
      applyFiltersFromUrl();
    } else {
      applyFiltersFromLocalStorage();
    }

    render();
    openStreamFromUrl();

    if (typeof renderMissingVodPage === "function") {
      renderMissingVodPage();
    }
  });

function initYears() {
  const years = [...new Set(streams.map(s => s.year))].sort((a, b) => b.localeCompare(a));
  const select = document.getElementById("yearFilter");

  select.innerHTML = "<option value=''>Todos</option>";

  years.forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    select.appendChild(opt);
  });
}

function initStreamers() {
  const streamerNames = [...new Set(streams.map(s => s.streamer))].sort();
  const select = document.getElementById("streamerFilter");

  select.innerHTML = "<option value=''>Todos</option>";

  streamerNames.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function getRelatedPOVs(stream) {
  if (!stream.collabId) return [];

  return streams.filter(s =>
    s.collabId === stream.collabId &&
    s.streamKey !== stream.streamKey
  );
}

function getLongStreamBadge(stream) {
  if (stream.durationMinutes >= 300) {
    return `<span class="badge-long-stream danger">🔴 5h+</span>`;
  }

  if (stream.durationMinutes >= 180) {
    return `<span class="badge-long-stream">⏱ 3h+</span>`;
  }

  return "";
}

function getCollabBadge(stream) {
  const relatedPOVs = getRelatedPOVs(stream);
  const totalPovs = relatedPOVs.length + 1;

  if (relatedPOVs.length > 0) {
    return `<span class="badge-collab">👥 ${totalPovs} ${totalPovs === 1 ? "POV" : "POVs"}</span>`;
  }

  return "";
}

function getHighlightBadge(stream) {
  if (stream.highlightCount > 0) {
    return `<span class="badge-highlight">⭐ ${stream.highlightCount}</span>`;
  }

  return `<span class="badge-muted">Sin destacados</span>`;
}

function getModalPovBadges(stream) {
  return `
    <div class="related-pov-badges">
      <span class="badge-streamer">
        ${
          stream.avatar
            ? `<img class="badge-streamer-avatar" src="${stream.avatar}" alt="${escapeHtml(stream.streamer)}">`
            : `<span class="badge-streamer-avatar-fallback">${escapeHtml(stream.streamer.charAt(0).toUpperCase())}</span>`
        }
        <span class="badge-streamer-text">${escapeHtml(stream.streamer)}</span>
      </span>
      ${getCollabBadge(stream)}
      ${getHighlightBadge(stream)}
      ${getLongStreamBadge(stream)}
    </div>
  `;
}

function render() {
  const year = document.getElementById("yearFilter").value;
  const month = document.getElementById("monthFilter").value;
  const streamer = document.getElementById("streamerFilter").value;
  const search = document.getElementById("search").value.toLowerCase().trim();

  const grid = document.getElementById("grid");
  const counter = document.getElementById("counter");

  grid.innerHTML = "";

  const filtered = streams
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(s => {
      if (year && s.year !== year) return false;
      if (month && s.month !== month) return false;
      if (streamer && s.streamer !== streamer) return false;

      let displayDate = `${s.day}-${s.month}-${s.year}`

        if(
        search &&
        !s.title.toLowerCase().includes(search) &&
        !s.streamer.toLowerCase().includes(search) &&
        !s.date.includes(search) &&
        !displayDate.includes(search)
        ) return false;

      return true;
    });

  counter.textContent = `Mostrando ${filtered.length} stream${filtered.length === 1 ? "" : "s"}`;

  filtered.forEach(s => {
    const relatedPOVs = getRelatedPOVs(s);
    const totalPovs = relatedPOVs.length + 1;
    const collabBadge = relatedPOVs.length > 0
    ? `<span class="badge-collab">👥 ${totalPovs} ${totalPovs === 1 ? "POV" : "POVs"}</span>`
    : "";

    let povColumnHtml = "";

    if (relatedPOVs.length > 0) {
      const povListHtml = relatedPOVs.map(pov => `
        <button
          class="pov-bubble"
          data-stream-key="${escapeHtml(pov.streamKey)}"
          data-name="${escapeHtml(pov.streamer)}"
          aria-label="${escapeHtml(pov.streamer)}"
        >
          ${
            pov.avatar
              ? `<img class="pov-avatar-img" 
                  src="${pov.avatar}" 
                  alt="${escapeHtml(pov.streamer)}" 
                  loading="lazy" 
                  decoding="async"
                  >`
              : `<span class="pov-avatar">${escapeHtml(pov.streamer.charAt(0).toUpperCase())}</span>`
          }
        </button>
      `).join("");

      povColumnHtml = `
        <div class="card-povs">
          <div class="povs-title">POVs</div>
          <div class="povs-list">
            ${povListHtml}
          </div>
        </div>
      `;
    }

    const card = document.createElement("div");
    card.className = "card";

    if (s.event === "special") {
      card.classList.add("card-event");
    }

    const eventBadge = s.event === "special"
      ? `<div class="card-event-badge">⭐</div>`
      : "";

    card.innerHTML = `
      <div class="card-layout">
        <div class="card-main" data-open-stream="${escapeHtml(s.streamKey)}">
          ${(() => {
            const status = getStatusInfo(s);
            return `
              <div class="thumb-wrap">
                ${eventBadge}
                <img src="${s.image}" alt="${escapeHtml(s.title)}">
                ${
                  status.icon
                    ? `<div class="vod-status-badge ${status.className}" title="${status.label}">${status.icon}</div>`
                    : ""
                }
              </div>
            `;
          })()}
          <div class="fecha">${s.day}-${s.month}-${s.year}</div>
          <div class="hora">${s.startTime} → ${s.endTime} · ${s.durationText}</div>
          <div class="titulo">${escapeHtml(s.title)}</div>
          <div class="mini-meta">
          <span class="badge-streamer">
            ${
              s.avatar
                ? `<img class="badge-streamer-avatar" src="${s.avatar}" alt="${escapeHtml(s.streamer)}">`
                : `<span class="badge-streamer-avatar-fallback">${escapeHtml(s.streamer.charAt(0).toUpperCase())}</span>`
            }
            <span class="badge-streamer-text">${escapeHtml(s.streamer)}</span>
          </span>
            ${collabBadge}
            ${s.highlightCount > 0 ? `<span class="badge-highlight">⭐ ${s.highlightCount}</span>` : `<span class="badge-muted">Sin destacados</span>`}
            ${getLongStreamBadge(s)}
          </div>
        </div>

        ${povColumnHtml}
      </div>
    `;

    grid.appendChild(card);
  });

  bindCardEvents();
  updateUrlFromFilters();
  saveFiltersToLocalStorage();
  
}

function bindCardEvents() {
  document.querySelectorAll("[data-open-stream]").forEach(el => {
    el.onclick = () => {
      const key = el.getAttribute("data-open-stream");
      const stream = streams.find(s => s.streamKey === key);
      if (stream) openModal(stream);
    };
  });
  document.querySelectorAll(".pov-bubble").forEach(button => {
    button.onclick = (e) => {
      e.stopPropagation();

      const streamKey = button.dataset.streamKey;
      const povStream = streams.find(s => s.streamKey === streamKey);

      if (povStream) {
        openModal(povStream);
      }
    };
  });
}

function openModal(stream) {
  currentStream = stream;

  const modal = document.getElementById("modal");
  const modalContent = document.querySelector(".modal-content");
  const modalTitle = document.getElementById("modalTitle");
  const modalInfo = document.getElementById("modalInfo");
  const modalMainImage = document.getElementById("modalMainImage");
  const modalHighlights = document.getElementById("modalHighlights");
  const modalRelatedPovs = document.getElementById("modalRelatedPovs");
  const modalStatus = document.getElementById("modalStatus");

  modalContent.classList.remove("modal-event");

  if (stream.event === "special") {
    modalContent.classList.add("modal-event");
  }

  modalTitle.textContent = stream.title;





  modalTitle.textContent = stream.title;
  modalInfo.innerHTML = `
    <span class="modal-streamer badge-streamer">
      ${
        stream.avatar
          ? `<img class="modal-streamer-avatar" src="${stream.avatar}" alt="${escapeHtml(stream.streamer)}">`
          : `<span class="modal-streamer-avatar-fallback">${escapeHtml(stream.streamer.charAt(0).toUpperCase())}</span>`
      }
      <span class="badge-streamer-text">${escapeHtml(stream.streamer)}</span>
    </span>
    · ${stream.day}-${stream.month}-${stream.year}
    · ${stream.startTime} → ${stream.endTime}
    · ${stream.durationText}
  `;
  modalMainImage.src = stream.image;
  modalMainImage.alt = stream.title;
  modalStatus.innerHTML = getStatusBlock(stream);
  const copyBtn = modalStatus.querySelector("[data-copy-missing]");
  if (copyBtn) {
    copyBtn.onclick = () => copyMissingVodMessage(stream, copyBtn);
  }

  modalHighlights.innerHTML = "";

  if (stream.highlights.length === 0) {
    modalHighlights.innerHTML = `<div class="sin-destacados">No hay momentos destacados.</div>`;
  } else {
    stream.highlights.forEach(path => {
      const img = document.createElement("img");
      img.src = path;
      img.alt = "Momento destacado";
      img.className = "highlight-thumb";
      img.onclick = () => {
        modalMainImage.src = path;
      };
      modalHighlights.appendChild(img);
    });
  }

  const relatedPOVs = getRelatedPOVs(stream);
  modalRelatedPovs.innerHTML = "";

  if (relatedPOVs.length === 0) {
    modalRelatedPovs.innerHTML = `<div class="sin-destacados">Solo POV de ${escapeHtml(stream.streamer)}.</div>`;
  } else {
    relatedPOVs.forEach(pov => {
      const item = document.createElement("button");
      item.className = "related-pov-card";
      item.innerHTML = `
        <img src="${pov.image}" alt="${escapeHtml(pov.title)}">
        <div class="related-pov-header">
          ${
            pov.avatar
              ? `<img class="related-pov-avatar" src="${pov.avatar}" alt="${escapeHtml(pov.streamer)}">`
              : `<span class="related-pov-avatar-fallback">${escapeHtml(pov.streamer.charAt(0).toUpperCase())}</span>`
          }
          <div class="related-pov-name">${escapeHtml(pov.streamer)}</div>
        </div>
        <div class="related-pov-meta">${pov.startTime} → ${pov.endTime} · ${pov.durationText}</div>
        ${getModalPovBadges(pov)}
      `;
      item.onclick = () => openModal(pov);
      modalRelatedPovs.appendChild(item);
    });

  const params = new URLSearchParams(window.location.search);
  params.set("stream", stream.streamKey);
  history.pushState({ streamKey: stream.streamKey }, "", `${window.location.pathname}?${params.toString()}`);
  }


  modal.classList.add("open");
}

function closeModal() {
  document.getElementById("modal").classList.remove("open");
  document.querySelector(".modal-content").classList.remove("modal-event");

  const params = new URLSearchParams(window.location.search);
  params.delete("stream");

  const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
  history.pushState({}, "", newUrl);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateUrlFromFilters() {
  const params = new URLSearchParams();

  const year = document.getElementById("yearFilter").value;
  const month = document.getElementById("monthFilter").value;
  const streamer = document.getElementById("streamerFilter").value;
  const search = document.getElementById("search").value.trim();

  if (year) params.set("year", year);
  if (month) params.set("month", month);
  if (streamer) params.set("streamer", streamer);
  if (search) params.set("search", search);

  const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
  history.replaceState({}, "", newUrl);
}

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const year = params.get("year") || "";
  const month = params.get("month") || "";
  const streamer = params.get("streamer") || "";
  const search = params.get("search") || "";

  document.getElementById("yearFilter").value = year;
  document.getElementById("monthFilter").value = month;
  document.getElementById("streamerFilter").value = streamer;
  document.getElementById("search").value = search;
}

function saveFiltersToLocalStorage() {
  const filters = {
    year: document.getElementById("yearFilter").value,
    month: document.getElementById("monthFilter").value,
    streamer: document.getElementById("streamerFilter").value,
    search: document.getElementById("search").value
  };

  localStorage.setItem("streamArchiveFilters", JSON.stringify(filters));
}

function applyFiltersFromLocalStorage() {
  const raw = localStorage.getItem("streamArchiveFilters");
  if (!raw) return;

  try {
    const filters = JSON.parse(raw);

    document.getElementById("yearFilter").value = filters.year || "";
    document.getElementById("monthFilter").value = filters.month || "";
    document.getElementById("streamerFilter").value = filters.streamer || "";
    document.getElementById("search").value = filters.search || "";
  } catch (e) {}
}

function openStreamFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const streamKey = params.get("stream");
  if (!streamKey) return;

  const stream = streams.find(s => s.streamKey === streamKey);
  if (stream) {
    openModal(stream);
  }
}

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const streamKey = params.get("stream");

  if (streamKey) {
    const stream = streams.find(s => s.streamKey === streamKey);
    if (stream) {
      openModal(stream);
    }
  } else {
    document.getElementById("modal").classList.remove("open");
  }
});

const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme){
  document.body.classList.toggle("light", theme === "light");
  themeToggle.textContent = theme === "light" ? "☀️" : "🌙";
}

themeToggle.onclick = () => {
  const current = localStorage.getItem("theme") || "dark";
  const next = current === "dark" ? "light" : "dark";

  localStorage.setItem("theme", next);
  applyTheme(next);
};

const savedTheme = localStorage.getItem("theme") || "dark";
applyTheme(savedTheme);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") {
    closeModal();
  }
});

function getStatusInfo(stream) {
  switch (stream.status) {
    case "available":
      return { icon: "✅", label: "Disponible", className: "status-available" };
    case "missing":
      return { icon: "❌", label: "Missing", className: "status-missing" };
    case "searching":
      return { icon: "🔍", label: "Buscando", className: "status-searching" };
    case "trade":
      return { icon: "🤝", label: "Intercambio", className: "status-trade" };
    default:
      return { icon: "", label: "", className: "" };
  }
}

function getStatusBlock(stream) {
  const status = getStatusInfo(stream);

  if (!status.icon) return "";

  let extraText = "";

  if (stream.status === "missing") {
    extraText = `
      <div class="vod-status-help">
        ¿Tienes este VOD? Estoy intentando recuperar streams perdidos.
      </div>
      <div class="vod-status-actions">
        <button class="vod-copy-btn" data-copy-missing="${escapeHtml(stream.streamKey)}">
          Copiar mensaje para Discord
        </button>
        <div class="vod-contact-text">
          Discord: <span class="vod-discord">${DISCORD_CONTACT}</span>
        </div>
      </div>
    `;
  }

  if (stream.status === "searching") {
    extraText = `
      <div class="vod-status-help">
        Actualmente estoy intentando conseguir este VOD.
      </div>
      <div class="vod-status-actions">
        <button class="vod-copy-btn" data-copy-missing="${escapeHtml(stream.streamKey)}">
          Copiar mensaje para Discord
        </button>
        <div class="vod-contact-text">
          Discord: <span class="vod-discord">${DISCORD_CONTACT}</span>
        </div>
      </div>
    `;
  }

  if (stream.status === "trade") {
    extraText = `
      <div class="vod-status-help">
        Este VOD está marcado para intercambio.
      </div>
      <div class="vod-status-actions">
        <button class="vod-copy-btn" data-copy-missing="${escapeHtml(stream.streamKey)}">
          Copiar mensaje para Discord
        </button>
        <div class="vod-contact-text">
          Discord: <span class="vod-discord">${DISCORD_CONTACT}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="vod-status-panel ${status.className}">
      <div class="vod-status-line">
        <span class="vod-status-panel-icon">${status.icon}</span>
        <span class="vod-status-panel-text">${status.label}</span>
      </div>
      ${extraText}
    </div>
  `;
}

function buildMissingVodMessage(stream) {
  return `Hola, creo que tengo este VOD:

Título: ${stream.title}
Streamer: ${stream.streamer}
Fecha: ${stream.day}-${stream.month}-${stream.year}
Horario: ${stream.startTime} → ${stream.endTime}
Duración: ${stream.durationText}
Referencia: ${stream.slug}`;
}

async function copyMissingVodMessage(stream, button) {
  const message = buildMissingVodMessage(stream);

  try {
    await navigator.clipboard.writeText(message);

    const originalText = button.innerHTML;

    button.classList.add("copied");
    button.innerHTML = "✔ Copiado";

    setTimeout(() => {
      button.classList.remove("copied");
      button.innerHTML = originalText;
    }, 2000);

  } catch (err) {
    console.error("No se pudo copiar");
  }
}

function updateVodStats(){
  const stats = document.getElementById("vodStats");
  const progressFill = document.getElementById("vodProgressFill");
  const progressText = document.getElementById("vodProgressText");

  if (!stats || !progressFill || !progressText) return;

  const archived = streams.filter(s => s.status === "available").length;
  const missing = streams.filter(s => s.status === "missing").length;
  const searching = streams.filter(s => s.status === "searching").length;
  const trade = streams.filter(s => s.status === "trade").length;
  const total = streams.length;

  const percent = total > 0 ? Math.round((archived / total) * 100) : 0;

  stats.innerHTML = `
    <span class="stat archived">
      VODs archivados <b>${archived}</b>
    </span>

    <span class="stat missing">
      VODs faltantes <b>${missing}</b>
    </span>

    ${searching > 0 ? `
      <span class="stat searching">
        Buscando <b>${searching}</b>
      </span>` : ""}

    ${trade > 0 ? `
      <span class="stat trade">
        Intercambio <b>${trade}</b>
      </span>` : ""}
  `;

  progressText.innerHTML = `Progreso del archivo: <b>${archived}</b> / <b>${total}</b> (${percent}%)`;

  requestAnimationFrame(() => {
    progressFill.style.width = `${percent}%`;
  });
}

function renderMissingVodPage(){

  const grid = document.getElementById("missingGrid");

  if(!grid) return;

  const missing = streams.filter(s =>
    s.status === "missing" || s.status === "searching"
  );

  missing
    .sort((a,b)=> b.date.localeCompare(a.date))
    .forEach(s=>{

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <div class="card-main">
          <img 
          src="${s.image}" 
          loading="lazy"
          decoding="async"
          alt="${escapeHtml(s.title)}">
          <div class="fecha">${s.day}-${s.month}-${s.year}</div>
          <div class="hora">${s.startTime} → ${s.endTime}</div>
          <div class="titulo">${escapeHtml(s.title)}</div>
        </div>
      `;

      card.onclick = ()=> openModal(s);

      grid.appendChild(card);

    });

}

function updateArchiveProgress() {
  const stats = document.getElementById("vodStats");
  const fill = document.getElementById("vodProgressFill");
  const text = document.getElementById("vodProgressText");

  if (!stats || !fill || !text) return;

  const archived = streams.filter(s => s.status === "available").length;
  const missing = streams.filter(s => s.status === "missing").length;
  const searching = streams.filter(s => s.status === "searching").length;

  const total = streams.length;
  const percent = total > 0 ? Math.round((archived / total) * 100) : 0;

  stats.innerHTML = `Archivo completado: <b>${archived}</b> / <b>${total}</b> (${percent}%)`;

  text.innerHTML =
    `VODs faltantes: <b>${missing}</b>` +
    (searching > 0 ? ` · Buscando: <b>${searching}</b>` : "");

  requestAnimationFrame(() => {
    fill.style.width = percent + "%";
  });
}








































document.getElementById("yearFilter").onchange = render;
document.getElementById("monthFilter").onchange = render;
document.getElementById("streamerFilter").onchange = render;
document.getElementById("search").oninput = render;
document.getElementById("closeModal").onclick = closeModal;

window.onclick = function (event) {
  const modal = document.getElementById("modal");
  if (event.target === modal) {
    closeModal();
  }
};