const API_URL = "http://localhost:8787"; // Cambiar por tu URL de Cloudflare Worker en producción
let allRecords = [];
let currentRecordId = null;

// Elements
const tableBody = document.getElementById("table-body");
const searchInput = document.getElementById("filter-search");
const serviceSelect = document.getElementById("filter-servicio");
const sedeSelect = document.getElementById("filter-sede");
const detailsModal = document.getElementById("details-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const deleteRecordBtn = document.getElementById("modal-btn-delete");

// Auth Logic
function checkAuth() {
    const userStr = localStorage.getItem("adminUser");
    const dashboardContainer = document.getElementById("dashboard-container");
    const loggedUserArea = document.getElementById("logged-user-area");
    const loggedUserName = document.getElementById("logged-user-name");

    if (userStr) {
        const user = JSON.parse(userStr);
        if (dashboardContainer) dashboardContainer.style.display = "block";
        if (loggedUserArea) loggedUserArea.style.display = "flex";
        if (loggedUserName) loggedUserName.innerText = `${user.nombre} (${user.rol.toUpperCase()})`;

        const isAdmin = user.rol === "administrador";
        const dashboardTabs = document.getElementById("dashboard-tabs");
        if (dashboardTabs) {
            dashboardTabs.style.display = isAdmin ? "flex" : "none";
        }

        // Display delete option only for admin
        const statCards = document.querySelectorAll(".stat-card");
        const filterServicio = document.getElementById("filter-servicio");

        if (user.rol === "administrador") {
            deleteRecordBtn.style.display = "flex";
            if (statCards[4]) statCards[4].style.display = "block";
            if (statCards[5]) statCards[5].style.display = "block";
            Array.from(filterServicio.options).forEach(opt => {
                opt.style.display = "block";
            });
        } else {
            deleteRecordBtn.style.display = "none";
            if (statCards[4]) statCards[4].style.display = "none";
            if (statCards[5]) statCards[5].style.display = "none";
            Array.from(filterServicio.options).forEach(opt => {
                if (opt.value === "Contratistas y Manicuristas" || opt.value === "Uso de Imagen y Voz") {
                    opt.style.display = "none";
                }
            });
        }

        // Restrict filters and labels for cashiers
        const refText = document.getElementById("dashboard-reference-text");
        const filterSedeGroup = document.getElementById("filter-sede-group");
        
        if ((user.rol === "cajero" || user.rol === "profesional") && user.sede) {
            refText.innerText = user.rol === "profesional"
                ? `Mis Consentimientos Registrados - Sede: ${user.sede.toUpperCase()}`
                : `Consulta de Consentimientos para: ${user.sede.toUpperCase()}`;
            filterSedeGroup.style.display = "none"; // Hide branch selector for cashiers/professionals
        } else {
            refText.innerText = "Consulta y Auditoría General de Consentimientos";
            filterSedeGroup.style.display = "block";
        }

        fetchRecords();
    } else {
        // Redirect to index portal login if not authenticated
        window.location.href = "../index/index.html";
    }
}

function logout() {
    localStorage.removeItem("adminUser");
    checkAuth();
}

// Load data from API with Role and Sede filters
async function fetchRecords() {
    const userStr = localStorage.getItem("adminUser");
    if (!userStr) return;
    const user = JSON.parse(userStr);

    try {
        // Fetch sending parameters for backend level filtering
        const urlParams = new URLSearchParams();
        if (user.rol) urlParams.append("rol", user.rol);
        if (user.sede) urlParams.append("sede", user.sede);
        if (user.nombre) urlParams.append("nombre", user.nombre);

        const res = await fetch(`${API_URL}/api/registros?${urlParams.toString()}`);
        if (!res.ok) throw new Error("Error al consultar la base de datos");
        allRecords = await res.json();
        applyFilters();
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #d81b60; padding: 30px;">Error al conectar con la API: ${err.message}</td></tr>`;
    }
}

// Populate Table
function renderTable(records) {
    tableBody.innerHTML = "";
    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--gray-text); padding: 30px;">No se encontraron registros.</td></tr>`;
        return;
    }

    records.forEach(rec => {
        const tr = document.createElement("tr");
        let badgeClass = "badge-unas";
        if (rec.tipo_pqr === "Cejas y Pestañas") badgeClass = "badge-cejas";
        if (rec.tipo_pqr === "Pedicura Especializada") badgeClass = "badge-pedi";
        if (rec.tipo_pqr === "Contratistas y Manicuristas") badgeClass = "badge-contra";
        if (rec.tipo_pqr === "Uso de Imagen y Voz") badgeClass = "badge-mkt";

        const dateStr = rec.fecha_registro && !rec.fecha_registro.includes("T") && !rec.fecha_registro.includes("Z")
            ? rec.fecha_registro.replace(" ", "T") + "Z"
            : rec.fecha_registro;
        const rawDate = new Date(dateStr);
        const formattedDate = isNaN(rawDate) ? rec.fecha_registro : rawDate.toLocaleDateString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        // Set friendly names for contractor and marketing signatures
        let signatureStatusText = rec.nombre_prof;
        if (rec.tipo_pqr === "Contratistas y Manicuristas" || rec.tipo_pqr === "Uso de Imagen y Voz") {
            signatureStatusText = "Suscrito (CEO & Colaborador)";
        }

        tr.innerHTML = `
            <td><strong>#${rec.id}</strong></td>
            <td>${formattedDate}</td>
            <td>${rec.nombre_cliente}</td>
            <td>${rec.documento}</td>
            <td><span class="badge ${badgeClass}">${rec.tipo_pqr}</span></td>
            <td>${signatureStatusText}</td>
            <td>${rec.sede}</td>
        `;

        tr.addEventListener("click", () => fetchAndShowDetails(rec.id));
        tableBody.appendChild(tr);
    });
}

// Apply filters
function applyFilters() {
    const query = searchInput.value.toLowerCase();
    const service = serviceSelect.value;
    const userStr = localStorage.getItem("adminUser");
    const user = userStr ? JSON.parse(userStr) : null;
    
    // If cajero, branch is restricted in API, otherwise respect selected filter
    const sede = (user && user.rol === "cajero") ? user.sede : sedeSelect.value;

    const filtered = allRecords.filter(rec => {
        const matchQuery = (rec.nombre_cliente || "").toLowerCase().includes(query) ||
            (rec.documento || "").includes(query) ||
            (rec.nombre_prof || "").toLowerCase().includes(query);
        const matchService = service === "todos" || rec.tipo_pqr === service;
        const matchSede = (sede === "todos" || !sede) || rec.sede.toLowerCase() === sede.toLowerCase();

        return matchQuery && matchService && matchSede;
    });

    renderTable(filtered);
    updateStats(filtered);
}

function updateStats(records) {
    document.getElementById("stat-total").innerText = records.length;
    document.getElementById("stat-unas").innerText = records.filter(r => r.tipo_pqr === "Uñas Artificiales").length;
    document.getElementById("stat-cejas").innerText = records.filter(r => r.tipo_pqr === "Cejas y Pestañas").length;
    document.getElementById("stat-pedicura").innerText = records.filter(r => r.tipo_pqr === "Pedicura Especializada").length;
    document.getElementById("stat-contratistas").innerText = records.filter(r => r.tipo_pqr === "Contratistas y Manicuristas").length;
    document.getElementById("stat-marketing").innerText = records.filter(r => r.tipo_pqr === "Uso de Imagen y Voz").length;
}

// Fetch detailed record and show Modal
async function fetchAndShowDetails(id) {
    try {
        currentRecordId = id;
        const res = await fetch(`${API_URL}/api/registros/${id}`);
        if (!res.ok) throw new Error("No se pudo obtener el detalle de la PQR");
        const rec = await res.json();
        showRecordDetails(rec);
    } catch (err) {
        alert("Error al cargar detalles: " + err.message);
    }
}

function showRecordDetails(rec) {
    document.getElementById("modal-client-name").innerText = rec.nombre_cliente;
    document.getElementById("modal-service-badge").innerText = rec.tipo_pqr;

    // Set service badge style
    const badge = document.getElementById("modal-service-badge");
    badge.className = "brand-badge";
    if (rec.tipo_pqr === "Uñas Artificiales") badge.style.background = "#fce4ec";
    if (rec.tipo_pqr === "Cejas y Pestañas") badge.style.background = "#e8eaf6";
    if (rec.tipo_pqr === "Pedicura Especializada") badge.style.background = "#e8f5e9";
    if (rec.tipo_pqr === "Contratistas y Manicuristas") badge.style.background = "#fff3e0";
    if (rec.tipo_pqr === "Uso de Imagen y Voz") badge.style.background = "#e0f7fa";

    const dateStr = rec.fecha_registro && !rec.fecha_registro.includes("T") && !rec.fecha_registro.includes("Z")
        ? rec.fecha_registro.replace(" ", "T") + "Z"
        : rec.fecha_registro;
    const rawDate = new Date(dateStr);
    const formattedDate = isNaN(rawDate) ? rec.fecha_registro : rawDate.toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    document.getElementById("modal-date-location").innerText = `${rec.sede} • Registrado el ${formattedDate}`;
    document.getElementById("modal-client-doc").innerText = `${rec.tipo_documento} ${rec.documento}`;
    document.getElementById("modal-client-phone").innerText = rec.telefono;
    document.getElementById("modal-prof-name").innerText = rec.nombre_prof;
    document.getElementById("modal-sede-name").innerText = rec.sede;

    // Label overrides for non-clients
    const clientRoleLabel = document.getElementById("modal-sig-role-client");
    const profRoleLabel = document.getElementById("modal-sig-role-prof");
    const obsTitle = document.getElementById("modal-observations-title");
    const procSection = document.getElementById("modal-procedures-section");

    if (rec.tipo_pqr === "Contratistas y Manicuristas") {
        clientRoleLabel.innerText = "Contratista / Manicurista";
        profRoleLabel.innerText = "Representante Legal";
        obsTitle.innerText = "Detalles y Estado del Contrato";
        procSection.style.display = "none";
    } else if (rec.tipo_pqr === "Uso de Imagen y Voz") {
        clientRoleLabel.innerText = "Colaborador / Autorizante";
        profRoleLabel.innerText = "Representante Legal";
        obsTitle.innerText = "Objeto de la Cesión de Derechos";
        procSection.style.display = "none";
    } else {
        clientRoleLabel.innerText = "Cliente / Acudiente";
        profRoleLabel.innerText = "Profesional Técnica";
        obsTitle.innerText = "Diagnóstico y Observaciones";
        procSection.style.display = "block";
    }

    // Health Condition details
    const healthAlert = document.getElementById("modal-health-alert");
    if (rec.tiene_enfermedad) {
        healthAlert.style.display = "block";
        document.getElementById("modal-health-detail").innerText = rec.enfermedad_detalle || "El cliente manifiesta enfermedades de base.";
    } else {
        healthAlert.style.display = "none";
    }

    // Procedures Mapping
    const proceduresList = document.getElementById("modal-procedures-list");
    proceduresList.innerHTML = "";
    const procedures = [];

    if (rec.tipo_pqr === "Uñas Artificiales" && rec.detalles_unas) {
        const du = rec.detalles_unas;
        if (du.proc_manicura_rusa) procedures.push("Manicura Rusa");
        if (du.proc_acrilico) procedures.push("Uñas en Acrílico");
        if (du.proc_polygel) procedures.push("Uñas en Polygel");
        if (du.proc_rubber) procedures.push("Uñas Base Rubber");
        if (du.proc_retoques) procedures.push("Retoque de Sistemas");
        if (du.proc_retiro) procedures.push("Retiro de Sistemas");
        if (du.proc_onicofagia) procedures.push("Uñas en Condición de Onicofagia");
    } else if (rec.tipo_pqr === "Cejas y Pestañas" && rec.detalles_cejas) {
        const dc = rec.detalles_cejas;
        if (dc.proc_depilacion) procedures.push("Depilación con Sombreado Bigen");
        if (dc.proc_pestañas) procedures.push("Aplicación de Pestañas Pelo a Pelo / Volumen");
        if (dc.proc_laminado) procedures.push("Laminado de Cejas");
        if (dc.proc_lifting) procedures.push("Lifting de Pestañas");
        if (dc.proc_micropigmentacion) procedures.push("Micropigmentación de Cejas");
        if (dc.proc_retiro_de_pestañas) procedures.push("Retiro de Pestañas Artificiales");
    } else if (rec.tipo_pqr === "Pedicura Especializada" && rec.detalles_pedicure) {
        const dp = rec.detalles_pedicure;
        if (dp.proc_esmalte) procedures.push("Pedicura con Esmalte Tradicional / Semipermanente");
        if (dp.proc_reconstruccion) procedures.push("Pedicura con Reconstrucción");
        if (dp.proc_onicocriptosis) procedures.push("Pedicura con Onicocriptosis");
        if (dp.proc_posible_onicomicosis) procedures.push("Pedicura con Posible Onicomicosis");
    }

    if (procedures.length === 0) {
        procedures.push("Ningún procedimiento específico registrado");
    }

    procedures.forEach(p => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${p}</strong> - Consentimiento y explicación de riesgos firmada y aceptada.`;
        proceduresList.appendChild(li);
    });

    // Observations & Diagnoses
    if (rec.observaciones_prof) {
        const op = rec.observaciones_prof;
        document.getElementById("modal-obs-results").innerText = op.adicionales || "Sin observaciones.";
        document.getElementById("modal-obs-recs").innerText = op.recomendaciones || "Sin recomendaciones.";
        document.getElementById("modal-obs-anom").innerText = op.patologia_detectada || "Sin anomalías.";
    } else {
        document.getElementById("modal-obs-results").innerText = "Sin diagnóstico registrado.";
        document.getElementById("modal-obs-recs").innerText = "Sin recomendaciones.";
        document.getElementById("modal-obs-anom").innerText = "Sin anomalías.";
    }

    // Signatures rendering
    const sigClient = document.getElementById("modal-sig-client");
    if (rec.firma_cliente) {
        if (rec.firma_cliente.startsWith("data:image/")) {
            sigClient.innerHTML = `<img src="${rec.firma_cliente}" style="max-height: 70px; max-width: 100%; object-fit: contain;" alt="Firma Cliente">`;
        } else if (rec.firma_cliente.startsWith("/api/signatures/")) {
            sigClient.innerHTML = `<img src="${API_URL}${rec.firma_cliente}" style="max-height: 70px; max-width: 100%; object-fit: contain;" alt="Firma Cliente">`;
        } else {
            sigClient.innerText = rec.nombre_cliente.split(' ')[0] || "Firma";
        }
    } else {
        sigClient.innerText = rec.nombre_cliente.split(' ')[0] || "Firma";
    }
    document.getElementById("modal-sig-client-name").innerText = rec.nombre_cliente;

    const sigProf = document.getElementById("modal-sig-prof");
    if (rec.firma_profesional === "CEO Stamp") {
        // Render elegant script or stamp for CEO signature
        sigProf.innerHTML = `<div style="text-align: center; color: #231f20;"><span style="font-family: 'Alex Brush', cursive; font-size: 1.8rem;">Lizeth Valeria C.</span><br><span style="font-size:0.6rem; letter-spacing:1px; text-transform:uppercase;">Representante Legal</span></div>`;
    } else if (rec.firma_profesional) {
        if (rec.firma_profesional.startsWith("data:image/")) {
            sigProf.innerHTML = `<img src="${rec.firma_profesional}" style="max-height: 70px; max-width: 100%; object-fit: contain;" alt="Firma Profesional">`;
        } else if (rec.firma_profesional.startsWith("/api/signatures/")) {
            sigProf.innerHTML = `<img src="${API_URL}${rec.firma_profesional}" style="max-height: 70px; max-width: 100%; object-fit: contain;" alt="Firma Profesional">`;
        } else {
            sigProf.innerText = rec.nombre_prof.split(' ')[0] || "Firma";
        }
    } else {
        sigProf.innerText = rec.nombre_prof.split(' ')[0] || "Firma";
    }
    document.getElementById("modal-sig-prof-name").innerText = rec.nombre_prof;

    if (rec.es_menor_edad) {
        document.getElementById("modal-sig-client-name").innerHTML = `${rec.nombre_cliente}<br><span style="font-size:0.75rem; color:var(--accent);">Tutor: ${rec.acudiente_autorizacion || 'N/A'}</span>`;
    }

    detailsModal.classList.add("active");
}

async function deleteCurrentRecord() {
    if (!currentRecordId) return;
    if (!confirm(`¿Está seguro de que desea eliminar el registro #${currentRecordId}? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/registros/${currentRecordId}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo eliminar el registro");

        alert("Registro eliminado con éxito.");
        closeModal();
        fetchRecords();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}

function closeModal() {
    detailsModal.classList.remove("active");
    currentRecordId = null;
}

// Export data to CSV
function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Fecha,Nombre,Documento,Servicio,Firma,Sede\n";

    allRecords.forEach(rec => {
        csvContent += `${rec.id},${rec.fecha_registro},"${rec.nombre_cliente}","${rec.documento}","${rec.tipo_pqr}","${rec.nombre_prof}","${rec.sede}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reporte_pqrs_cajero.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Listeners
searchInput.addEventListener("input", applyFilters);
serviceSelect.addEventListener("change", applyFilters);
sedeSelect.addEventListener("change", applyFilters);
closeModalBtn.addEventListener("click", closeModal);
deleteRecordBtn.addEventListener("click", deleteCurrentRecord);

window.onclick = function (event) {
    if (event.target === detailsModal) {
        closeModal();
    }
}

// Tab Switching inside Dashboard
function switchDashboardTab(tabId, btn) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.dashboard-tab-content');
    contents.forEach(content => content.style.display = 'none');

    // Deactivate all tab buttons
    const buttons = document.querySelectorAll('#dashboard-tabs .tab-btn');
    buttons.forEach(button => button.classList.remove('active'));

    // Show current active tab and set active button
    document.getElementById(tabId).style.display = 'block';
    btn.classList.add('active');

    if (tabId === 'users-view') {
        fetchUsers();
    }
}

// Fetch all users (Admin only)
async function fetchUsers() {
    try {
        const res = await fetch(`${API_URL}/api/users`);
        if (!res.ok) throw new Error("No se pudo obtener la lista de usuarios");
        const users = await res.json();
        renderUsersTable(users);
    } catch (err) {
        console.error(err);
        alert("Error al cargar usuarios: " + err.message);
    }
}

// Render Users Table
function renderUsersTable(users) {
    const usersTableBody = document.getElementById("users-table-body");
    usersTableBody.innerHTML = "";
    if (users.length === 0) {
        usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--gray-text); padding: 20px;">No hay usuarios registrados.</td></tr>`;
        return;
    }

    users.forEach(u => {
        const tr = document.createElement("tr");
        const roleBadge = u.rol === "administrador" ? "badge-unas" : (u.rol === "cajero" ? "badge-cejas" : "badge-pedi");
        tr.innerHTML = `
            <td><strong>#${u.id}</strong></td>
            <td>${u.nombre}</td>
            <td>${u.correo}</td>
            <td><span class="badge ${roleBadge}">${u.rol}</span></td>
            <td>${u.sede || 'N/A'}</td>
            <td>
                <button class="btn-logout" onclick="deleteUser(${u.id}, '${u.nombre}')" style="border-color: #c62828; color: #c62828; padding: 4px 8px; font-size: 0.7rem; margin: 0;">
                    Eliminar
                </button>
            </td>
        `;
        usersTableBody.appendChild(tr);
    });
}

// Delete User
async function deleteUser(id, name) {
    const loggedUser = JSON.parse(localStorage.getItem("adminUser"));
    if (loggedUser && loggedUser.id === id) {
        alert("No puedes eliminar tu propio usuario.");
        return;
    }
    if (!confirm(`¿Está seguro de que desea eliminar al usuario "${name}"?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/users/${id}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo eliminar el usuario");

        alert("Usuario eliminado con éxito.");
        fetchUsers();
    } catch (err) {
        alert("Error al eliminar usuario: " + err.message);
    }
}

// Handle role change in Admin User Registration form
function handleRegRoleChange(role) {
    const wrapper = document.getElementById("reg-sede-wrapper");
    const sedeSelectReg = document.getElementById("reg-sede");
    if (role === "cajero" || role === "profesional") {
        wrapper.style.display = "block";
        sedeSelectReg.required = true;
    } else {
        wrapper.style.display = "none";
        sedeSelectReg.required = false;
    }
}

// Register user via Admin Dashboard
async function handleAdminRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById("reg-name").value;
    const correo = document.getElementById("reg-email").value;
    const contraseña = document.getElementById("reg-password").value;
    const rol = document.getElementById("reg-role").value;
    const sede = (rol === "cajero" || rol === "profesional") ? document.getElementById("reg-sede").value : null;
    const errorDiv = document.getElementById("reg-error");
    const successDiv = document.getElementById("reg-success");

    errorDiv.style.display = "none";
    successDiv.style.display = "none";

    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, correo, contraseña, rol, sede })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al registrar");

        successDiv.innerText = "Usuario creado exitosamente.";
        successDiv.style.display = "block";
        document.getElementById("admin-register-form").reset();
        handleRegRoleChange("cajero"); // Reset sede visibility
        fetchUsers();
    } catch (err) {
        errorDiv.innerText = err.message;
        errorDiv.style.display = "block";
    }
}

// Init load with auth validation
checkAuth();
