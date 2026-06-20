const API_URL = "http://localhost:8787";

function switchTab(tabId, btn) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    // Deactivate all tab buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(button => button.classList.remove('active'));

    // Show current active tab and set active button
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function checkAuth() {
    const userStr = localStorage.getItem("adminUser");
    const loginContainer = document.getElementById("login-container");
    const mainContent = document.getElementById("main-content");
    const loggedUserArea = document.getElementById("logged-user-area");
    const loggedUserName = document.getElementById("logged-user-name");

    if (userStr) {
        let user;
        try {
            user = JSON.parse(userStr);
        } catch (e) {
            console.error("Error parsing adminUser:", e);
            localStorage.removeItem("adminUser");
            location.reload();
            return;
        }

        if (loginContainer) loginContainer.style.display = "none";
        if (mainContent) mainContent.style.display = "block";
        if (loggedUserArea) loggedUserArea.style.display = "flex";
        if (loggedUserName) loggedUserName.innerText = `${user.nombre} (${user.rol.toUpperCase()})`;

        const isAdmin = user.rol === "administrador";
        const isStaff = user.rol === "cajero" || user.rol === "profesional";

        if (!isAdmin && !isStaff) {
            hidePersonalSection();
        } else if (isStaff) {
            // Cajero & Profesional: hide admin-only cards in personal-section
            const cardContratistas = document.getElementById("card-contratistas");
            if (cardContratistas) cardContratistas.remove();
            const cardMarketing = document.getElementById("card-marketing");
            if (cardMarketing) cardMarketing.remove();
        }
    } else {
        if (loginContainer) loginContainer.style.display = "flex";
        if (mainContent) mainContent.style.display = "none";
    }
}

function hidePersonalSection() {
    const personalTabBtn = document.getElementById("personal-tab-btn");
    if (personalTabBtn) {
        personalTabBtn.style.display = "none";
    }
    const personalSection = document.getElementById("personal-section");
    if (personalSection) {
        personalSection.remove();
    }
    // Hide the tabs container completely so it looks clean since only Clientes is available
    const tabsContainer = document.querySelector(".tabs-container");
    if (tabsContainer) {
        tabsContainer.style.display = "none";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const correo = document.getElementById("login-email").value;
    const contraseña = document.getElementById("login-password").value;
    const errorDiv = document.getElementById("login-error");
    errorDiv.style.display = "none";

    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, contraseña })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Credenciales incorrectas");

        localStorage.setItem("adminUser", JSON.stringify(data.user));
        checkAuth();
    } catch (err) {
        errorDiv.innerText = err.message;
        errorDiv.style.display = "block";
    }
}

function logout() {
    localStorage.removeItem("adminUser");
    location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
});
