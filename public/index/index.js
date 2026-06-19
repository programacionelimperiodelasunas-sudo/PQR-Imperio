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

document.addEventListener("DOMContentLoaded", () => {
    const userStr = localStorage.getItem("adminUser");
    let isAdmin = false;
    let isProfessional = false;

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (user && user.rol === "administrador") {
                isAdmin = true;
            } else if (user && user.rol === "cajero") {
                isProfessional = true;
            }
        } catch (e) {
            console.error("Error parsing adminUser:", e);
        }
    }

    if (!isAdmin && !isProfessional) {
        // Public/Client view: hide Personal y Control tab and section
        const personalTabBtn = document.getElementById("personal-tab-btn");
        if (personalTabBtn) {
            personalTabBtn.style.display = "none";
        }
        const personalSection = document.getElementById("personal-section");
        if (personalSection) {
            personalSection.remove();
        }
        // Hide the tabs container completely so it looks clean
        const tabsContainer = document.querySelector(".tabs-container");
        if (tabsContainer) {
            tabsContainer.style.display = "none";
        }
    } else if (isProfessional) {
        // Professional (cajero) view: hide admin-only cards in personal-section
        const cardContratistas = document.getElementById("card-contratistas");
        if (cardContratistas) {
            cardContratistas.remove();
        }
        const cardMarketing = document.getElementById("card-marketing");
        if (cardMarketing) {
            cardMarketing.remove();
        }
    }
});
