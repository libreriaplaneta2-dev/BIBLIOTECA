const STORAGE_KEYS = {
  books: "bpsf.books",
  config: "bpsf.config",
  suggestions: "bpsf.suggestions",
  loans: "bpsf.loans"
};

const state = {
  books: [],
  suggestions: [],
  loans: [],
  config: {
    whatsapp: "",
    googleBooksKey: ""
  },
  filters: {
    q: "",
    category: "",
    estado: ""
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", init);

async function init() {
  loadLocalState();
  if (!state.books.length) {
    await loadCatalog();
  }
  bindEvents();
  renderAll();
  openBookFromHash();
  window.addEventListener("hashchange", openBookFromHash);
}

async function loadCatalog() {
  try {
    let response = await fetch("data/catalogo.json", { cache: "no-store" });
    if (!response.ok) {
      response = await fetch("catalogo.json", { cache: "no-store" });
    }
    if (!response.ok) {
      throw new Error("Catalogo no encontrado");
    }
    state.books = normalizeBooks(await response.json());
    saveBooks();
  } catch (error) {
    state.books = [];
    setStatus("No se pudo cargar data/catalogo.json. Importa un Excel para comenzar.");
  }
}

function loadLocalState() {
  state.books = readJson(STORAGE_KEYS.books, []);
  state.config = { ...state.config, ...readJson(STORAGE_KEYS.config, {}) };
  state.suggestions = readJson(STORAGE_KEYS.suggestions, []);
  state.loans = readJson(STORAGE_KEYS.loans, []);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function bindEvents() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));
  $("#searchInput").addEventListener("input", (event) => {
    state.filters.q = event.target.value.trim().toLowerCase();
    renderCatalog();
  });
  $("#categoryFilter").addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderCatalog();
  });
  $("#stateFilter").addEventListener("change", (event) => {
    state.filters.estado = event.target.value;
    renderCatalog();
  });
  $("#downloadTemplate").addEventListener("click", downloadTemplate);
  $("#importExcel").addEventListener("click", importExcel);
  $("#enrichAll").addEventListener("click", enrichMissingBooks);
  $("#exportJson").addEventListener("click", exportCatalog);
  $("#clearLocal").addEventListener("click", clearLocalChanges);
  $("#saveConfig").addEventListener("click", saveConfig);
  $("#suggestionForm").addEventListener("submit", saveSuggestion);
  $("#markLoan").addEventListener("click", markLoaned);
  $("#markReturn").addEventListener("click", markReturned);
  $("#closeDialog").addEventListener("click", () => $("#bookDialog").close());
  $("#downloadVisibleQr").addEventListener("click", downloadSearchQr);
}

function showView(view) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === view));
}

function renderAll() {
  $("#whatsappNumber").value = state.config.whatsapp || "";
  $("#googleBooksKey").value = state.config.googleBooksKey || "";
  renderFilters();
  renderCatalog();
  renderAdminSelects();
  renderLoans();
}

function renderFilters() {
  const categories = unique(state.books.map((book) => book.categoria).filter(Boolean));
  $("#categoryFilter").innerHTML = `<option value="">Todas las categorias</option>${categories.map((cat) => `<option>${escapeHtml(cat)}</option>`).join("")}`;
}

function renderCatalog() {
  const visible = filteredBooks();
  renderFeatured();
  renderStats(visible);
  $("#booksGrid").innerHTML = visible.map(renderBookCard).join("") || `<p class="muted">No hay libros para mostrar.</p>`;
  $$(".book-card [data-detail]").forEach((button) => button.addEventListener("click", () => openBook(button.dataset.detail)));
  $$(".book-card [data-whatsapp]").forEach((button) => button.addEventListener("click", () => openWhatsapp(button.dataset.whatsapp)));
}

function renderFeatured() {
  const book = state.books.find((item) => item.destacado) || state.books[0];
  if (!book) {
    $("#featured").innerHTML = "";
    return;
  }
  $("#featured").innerHTML = `
    <article class="featured-card">
      <div class="cover">${coverImage(book)}</div>
      <div>
        <p class="tag">Libro destacado</p>
        <h2>${escapeHtml(book.titulo)}</h2>
        <p class="meta">${escapeHtml(book.autor || "Autor sin cargar")}</p>
        <p>${escapeHtml(book.sinopsis || book.notas || "Sinopsis pendiente de completar.")}</p>
        <button data-feature-detail="${book.id}">Ver ficha</button>
      </div>
    </article>
  `;
  $("[data-feature-detail]").addEventListener("click", () => openBook(book.id));
}

function renderStats(visible) {
  const total = state.books.length;
  const disponibles = state.books.filter((book) => normalizeText(book.estado) === "disponible").length;
  const prestados = state.books.filter((book) => normalizeText(book.estado) === "prestado").length;
  $("#stats").innerHTML = `
    <span class="pill">Total: <strong>${total}</strong></span>
    <span class="pill">Disponibles: <strong>${disponibles}</strong></span>
    <span class="pill">Prestados: <strong>${prestados}</strong></span>
    <span class="pill">Resultados: <strong>${visible.length}</strong></span>
  `;
}

function renderBookCard(book) {
  const statusClass = normalizeText(book.estado).replace(/\s+/g, "-") || "disponible";
  return `
    <article class="book-card">
      <div class="cover">${coverImage(book)}</div>
      <div class="book-body">
        <div class="book-title-row">
          <h3>${escapeHtml(book.titulo)}</h3>
          <span class="badge ${statusClass}">${escapeHtml(book.estado || "Disponible")}</span>
        </div>
        <p class="meta">${escapeHtml(book.autor || "Autor sin cargar")}</p>
        <div class="tags">
          ${book.categoria ? `<span class="tag">${escapeHtml(book.categoria)}</span>` : ""}
          ${book.anio ? `<span class="tag">${escapeHtml(book.anio)}</span>` : ""}
          ${book.estante ? `<span class="tag">${escapeHtml(book.estante)}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="secondary" data-detail="${book.id}">Ficha</button>
          <button data-whatsapp="${book.id}">WhatsApp</button>
        </div>
      </div>
    </article>
  `;
}

function coverImage(book) {
  if (book.imagen) {
    return `<img src="${escapeAttribute(book.imagen)}" alt="Tapa de ${escapeAttribute(book.titulo)}" loading="lazy">`;
  }
  return `<div class="placeholder-cover" aria-label="Sin tapa"></div>`;
}

function filteredBooks() {
  return state.books.filter((book) => {
    const haystack = normalizeText([book.titulo, book.autor, book.isbn, book.categoria, book.estante, book.tematica].join(" "));
    const matchesText = !state.filters.q || haystack.includes(normalizeText(state.filters.q));
    const matchesCategory = !state.filters.category || book.categoria === state.filters.category;
    const matchesState = !state.filters.estado || normalizeText(book.estado) === normalizeText(state.filters.estado);
    return matchesText && matchesCategory && matchesState;
  });
}

function openBook(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;
  const loans = state.loans.filter((loan) => loan.bookId === id);
  $("#bookDetail").innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="cover">${coverImage(book)}</div>
        <canvas class="qr" id="bookQr"></canvas>
      </div>
      <div>
        <h2>${escapeHtml(book.titulo)}</h2>
        <p class="meta">${escapeHtml(book.autor || "Autor sin cargar")}</p>
        <p><strong>Estado:</strong> ${escapeHtml(book.estado || "Disponible")}</p>
        <p><strong>ISBN:</strong> ${escapeHtml(book.isbn || "Sin ISBN")}</p>
        <p><strong>Estante:</strong> ${escapeHtml(book.estante || "Sin estante")}</p>
        <p>${escapeHtml(book.sinopsis || book.notas || "Sinopsis pendiente de completar.")}</p>
        <button data-whatsapp-detail="${book.id}">Pedir por WhatsApp</button>
        <h3>Historial</h3>
        <p class="meta">${loans.length ? `Prestado ${loans.length} vez/veces.` : "Sin prestamos registrados en este navegador."}</p>
      </div>
    </div>
  `;
  $("#bookDialog").showModal();
  $("#bookDetail [data-whatsapp-detail]").addEventListener("click", () => openWhatsapp(book.id));
  makeQr($("#bookQr"), bookUrl(book));
}

function openBookFromHash() {
  const match = location.hash.match(/^#libro=(.+)$/);
  if (!match) return;
  const id = decodeURIComponent(match[1]);
  if (state.books.some((book) => book.id === id)) {
    openBook(id);
  }
}

function renderAdminSelects() {
  $("#loanBook").innerHTML = state.books.map((book) => `<option value="${escapeAttribute(book.id)}">${escapeHtml(book.titulo)} - ${escapeHtml(book.autor || "")}</option>`).join("");
}

function renderLoans() {
  const today = new Date();
  $("#loanList").innerHTML = state.loans.map((loan) => {
    const book = state.books.find((item) => item.id === loan.bookId);
    const days = daysBetween(new Date(loan.date), today);
    const overdue = !loan.returnedAt && days > 30;
    return `
      <article class="${overdue ? "overdue" : ""}">
        <strong>${escapeHtml(book?.titulo || "Libro eliminado")}</strong>
        <span class="meta">${escapeHtml(loan.person || "Socio sin nombre")} · ${days} dias · ${loan.returnedAt ? "Devuelto" : overdue ? "Vencido" : "Prestado"}</span>
      </article>
    `;
  }).join("") || `<p class="muted">Todavia no hay prestamos registrados.</p>`;
}

async function importExcel() {
  const file = $("#excelFile").files[0];
  if (!file) {
    setStatus("Selecciona un archivo Excel primero.");
    return;
  }
  if (!window.XLSX) {
    setStatus("No se pudo cargar el lector de Excel. Revisa la conexion a internet y recarga la pagina.");
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  state.books = normalizeBooks(rows);
  saveBooks();
  renderAll();
  setStatus(`Importados ${state.books.length} libros. Ahora podes exportar catalogo.json.`);
}

async function enrichMissingBooks() {
  const targets = state.books.filter((book) => (book.isbn || book.titulo) && (!book.imagen || !book.sinopsis));
  if (!targets.length) {
    setStatus("No hay libros pendientes para buscar.");
    return;
  }
  setStatus(`Buscando datos en Google Books para ${targets.length} libros...`);
  let updated = 0;
  for (const book of targets) {
    const before = `${book.imagen || ""}|${book.sinopsis || ""}`;
    const data = await fetchGoogleBook(book);
    if (data) {
      book.titulo = book.titulo || data.titulo;
      book.autor = book.autor || data.autor;
      book.categoria = book.categoria || data.categoria;
      book.anio = book.anio || data.anio;
      book.imagen = book.imagen || data.imagen;
      book.sinopsis = book.sinopsis || data.sinopsis;
      const after = `${book.imagen || ""}|${book.sinopsis || ""}`;
      if (after !== before) updated += 1;
    }
    setStatus(`Google Books: ${updated} actualizados de ${targets.length}.`);
    await wait(450);
  }
  saveBooks();
  renderAll();
  setStatus(`Listo. Se actualizaron ${updated} libros con tapa y/o sinopsis.`);
}

async function fetchGoogleBook(book) {
  const key = state.config.googleBooksKey ? `&key=${encodeURIComponent(state.config.googleBooksKey)}` : "";
  const queries = [];
  const isbn = cleanIsbn(book.isbn);
  if (isbn) queries.push(`isbn:${isbn}`);
  if (book.titulo) {
    const titleQuery = `intitle:${book.titulo}${book.autor ? ` inauthor:${book.autor}` : ""}`;
    queries.push(titleQuery);
  }

  for (const query of queries) {
    const data = await fetchGoogleBookQuery(query, key);
    if (data) return data;
  }
  if (isbn) {
    const data = await fetchOpenLibrary(isbn);
    if (data) return data;
  }
  return null;
}

async function fetchGoogleBookQuery(query, key) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}${key}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const volume = data.items?.[0]?.volumeInfo;
    if (!volume) return null;
    const image = volume.imageLinks?.thumbnail || volume.imageLinks?.smallThumbnail || "";
    return {
      titulo: volume.title || "",
      autor: (volume.authors || []).join(", "),
      categoria: (volume.categories || [])[0] || "",
      anio: (volume.publishedDate || "").slice(0, 4),
      imagen: image ? image.replace("http://", "https://") : "",
      sinopsis: volume.description || ""
    };
  } catch {
    return null;
  }
}

async function fetchOpenLibrary(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const info = data[`ISBN:${isbn}`];
    if (!info) return null;
    return {
      titulo: info.title || "",
      autor: (info.authors || []).map((author) => author.name).join(", "),
      categoria: (info.subjects || [])[0]?.name || "",
      anio: (info.publish_date || "").match(/\d{4}/)?.[0] || "",
      imagen: info.cover?.large || info.cover?.medium || info.cover?.small || "",
      sinopsis: info.excerpts?.[0]?.text || ""
    };
  } catch {
    return null;
  }
}

function cleanIsbn(value) {
  return String(value || "").replace(/[^0-9Xx]/g, "");
}

function downloadTemplate() {
  const rows = [
    ["titulo", "autor", "categoria", "anio", "isbn", "estado", "notas", "estante", "imagen", "sinopsis", "destacado", "tematica"],
    ["Rayuela", "Julio Cortazar", "Literatura", "1963", "9788437604572", "Disponible", "Novela argentina", "Narrativa argentina", "", "", "si", "Autores argentinos"]
  ];
  if (window.XLSX) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Catalogo");
    XLSX.writeFile(book, "plantilla-catalogo-biblioteca.xlsx");
    return;
  }
  downloadFile("plantilla-catalogo-biblioteca.csv", rows.map((row) => row.join(",")).join("\n"), "text/csv");
}

function exportCatalog() {
  downloadFile("catalogo.json", JSON.stringify(state.books, null, 2), "application/json");
  setStatus("Descargado catalogo.json. Subilo a la carpeta data del repositorio.");
}

function clearLocalChanges() {
  if (!confirm("Esto borra los cambios guardados en este navegador. El archivo publicado no se modifica.")) return;
  localStorage.removeItem(STORAGE_KEYS.books);
  localStorage.removeItem(STORAGE_KEYS.loans);
  location.reload();
}

function saveSuggestion(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  state.suggestions.push({
    titulo: form.get("titulo"),
    nombre: form.get("nombre"),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEYS.suggestions, JSON.stringify(state.suggestions));
  event.target.reset();
  alert("Sugerencia guardada en este navegador.");
}

function saveConfig() {
  state.config.whatsapp = $("#whatsappNumber").value.trim();
  state.config.googleBooksKey = $("#googleBooksKey").value.trim();
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(state.config));
  setStatus("Configuracion guardada.");
}

function markLoaned() {
  const bookId = $("#loanBook").value;
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  book.estado = "Prestado";
  state.loans.push({
    bookId,
    person: $("#loanPerson").value.trim(),
    date: $("#loanDate").value || new Date().toISOString().slice(0, 10),
    returnedAt: ""
  });
  persistActivity();
}

function markReturned() {
  const bookId = $("#loanBook").value;
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  book.estado = "Disponible";
  const activeLoan = [...state.loans].reverse().find((loan) => loan.bookId === bookId && !loan.returnedAt);
  if (activeLoan) activeLoan.returnedAt = new Date().toISOString().slice(0, 10);
  persistActivity();
}

function persistActivity() {
  saveBooks();
  localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(state.loans));
  renderAll();
}

function openWhatsapp(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;
  const phone = state.config.whatsapp;
  const text = `Hola! Me interesa reservar el libro "${book.titulo}" de ${book.autor || "la biblioteca"}.`;
  const url = phone
    ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}

function downloadSearchQr() {
  const query = new URLSearchParams();
  if (state.filters.q) query.set("q", state.filters.q);
  if (state.filters.category) query.set("categoria", state.filters.category);
  const url = `${location.origin}${location.pathname}${query.toString() ? `?${query}` : ""}`;
  const canvas = document.createElement("canvas");
  makeQr(canvas, url, () => {
    const link = document.createElement("a");
    link.download = "qr-catalogo.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

function makeQr(canvas, text, done) {
  if (!window.QRCode) return;
  QRCode.toCanvas(canvas, text, { width: 160, margin: 1 }, done || (() => {}));
}

function bookUrl(book) {
  return `${location.origin}${location.pathname}#libro=${encodeURIComponent(book.id)}`;
}

function normalizeBooks(rows) {
  return rows.map((row) => {
    const book = mapRow(row);
    book.id = book.id || slug([book.titulo, book.autor, book.isbn].filter(Boolean).join("-"));
    book.estado = book.estado || "Disponible";
    book.destacado = ["si", "true", "1", "x"].includes(normalizeText(book.destacado));
    return book;
  }).filter((book) => book.titulo || book.isbn);
}

function mapRow(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeHeader(key)] = String(value ?? "").trim();
  });
  return {
    id: normalized.id || "",
    titulo: normalized.titulo || normalized.title || "",
    autor: normalized.autor || normalized.author || "",
    categoria: normalized.categoria || normalized.category || "",
    anio: normalized.anio || normalized.año || normalized.year || "",
    isbn: normalized.isbn || "",
    estado: normalized.estado || normalized.status || "",
    notas: normalized.notas || normalized.notes || "",
    estante: normalized.estante || normalized.ubicacion || "",
    imagen: normalized.imagen || normalized.tapa || normalized.portada || normalized.cover || "",
    sinopsis: normalized.sinopsis || normalized.descripcion || "",
    destacado: normalized.destacado || "",
    tematica: normalized.tematica || normalized.tema || ""
  };
}

function normalizeHeader(value) {
  return normalizeText(String(value)).replace(/\s+/g, "_");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function slug(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(state.books));
}

function setStatus(message) {
  $("#adminStatus").textContent = message;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
