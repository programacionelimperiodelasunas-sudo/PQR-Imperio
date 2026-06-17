document.addEventListener("DOMContentLoaded", () => {
    // 1. AUTO-SET DATE
    const dateInput = document.getElementById("documento-fecha");
    if (dateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();

        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;

        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    // 2. PROCEDURES INTERACTIVITY (SHOW/HIDE EXPLANATIONS)
    const procedureCheckboxes = document.querySelectorAll(".procedure-checkbox");
    procedureCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            const item = e.target.closest(".procedure-item");
            const nestedConfirm = item.querySelector(".proc-confirm");
            if (e.target.checked) {
                item.classList.add("active");
                if (nestedConfirm) nestedConfirm.required = true;
            } else {
                item.classList.remove("active");
                if (nestedConfirm) {
                    nestedConfirm.required = false;
                    nestedConfirm.checked = false; // Reset if unchecked
                }
            }
        });
    });

    // 3. CONDITIONAL INPUTS
    // base diseases conditional
    const enfSi = document.getElementById("enf-si");
    const enfNo = document.getElementById("enf-no");
    const condEnfermedad = document.getElementById("conditional-enfermedad");
    const enfermedadDetalle = document.getElementById("enfermedad-detalle");

    function toggleEnfermedad() {
        if (enfSi && enfSi.checked) {
            condEnfermedad.classList.add("active");
            if (enfermedadDetalle) enfermedadDetalle.required = true;
        } else {
            condEnfermedad.classList.remove("active");
            if (enfermedadDetalle) {
                enfermedadDetalle.required = false;
                enfermedadDetalle.value = "";
            }
        }
    }
    if (enfSi && enfNo) {
        enfSi.addEventListener("change", toggleEnfermedad);
        enfNo.addEventListener("change", toggleEnfermedad);
    }

    // minor age conditional
    const menorSi = document.getElementById("menor-si");
    const menorNo = document.getElementById("menor-no");
    const condAcudiente = document.getElementById("conditional-acudiente");
    const acudienteAutorizacion = document.getElementById("acudiente-autorizacion");

    function toggleAcudiente() {
        if (menorSi && menorSi.checked) {
            condAcudiente.classList.add("active");
            if (acudienteAutorizacion) acudienteAutorizacion.required = true;
        } else {
            condAcudiente.classList.remove("active");
            if (acudienteAutorizacion) {
                acudienteAutorizacion.required = false;
                acudienteAutorizacion.value = "";
            }
        }
    }
    if (menorSi && menorNo) {
        menorSi.addEventListener("change", toggleAcudiente);
        menorNo.addEventListener("change", toggleAcudiente);
    }

    // 4. SIGNATURE CANVAS PADS
    class SignaturePad {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext("2d");
            this.drawing = false;
            this.hasSigned = false;

            // Setup line style
            this.ctx.strokeStyle = "#1a1a1a";
            this.ctx.lineJoin = "round";
            this.ctx.lineCap = "round";
            this.ctx.lineWidth = 2.5;

            this.initEvents();
        }

        initEvents() {
            // Mouse events
            this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
            this.canvas.addEventListener("mousemove", (e) => this.draw(e));
            this.canvas.addEventListener("mouseup", () => this.stopDrawing());
            this.canvas.addEventListener("mouseout", () => this.stopDrawing());

            // Touch events
            this.canvas.addEventListener("touchstart", (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent("mousedown", {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            }, { passive: false });

            this.canvas.addEventListener("touchmove", (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent("mousemove", {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            }, { passive: false });

            this.canvas.addEventListener("touchend", (e) => {
                const mouseEvent = new MouseEvent("mouseup", {});
                this.canvas.dispatchEvent(mouseEvent);
            });
        }

        getMousePos(e) {
            const rect = this.canvas.getBoundingClientRect();
            // Accounts for client coordinates vs canvas viewport
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        startDrawing(e) {
            this.drawing = true;
            const pos = this.getMousePos(e);
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        }

        draw(e) {
            if (!this.drawing) return;
            const pos = this.getMousePos(e);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
            this.hasSigned = true;
        }

        stopDrawing() {
            this.drawing = false;
        }

        clear() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.hasSigned = false;
        }
    }

    const professionalPad = new SignaturePad("canvas-professional");
    const clientPad = new SignaturePad("canvas-client");

    // Clear buttons
    document.querySelectorAll(".btn-clear-sig").forEach(button => {
        button.addEventListener("click", () => {
            const canvasId = button.getAttribute("data-canvas");
            if (canvasId === "canvas-professional" && professionalPad) {
                professionalPad.clear();
            } else if (canvasId === "canvas-client" && clientPad) {
                clientPad.clear();
            }
        });
    });

    // 5. VALIDATIONS & PRINT TRIGGER
    const btnPrint = document.getElementById("btn-print");
    const consentForm = document.getElementById("consent-form");

    if (btnPrint && consentForm) {
        btnPrint.addEventListener("click", () => {
            // Check form validations (HTML5 required attributes)
            if (!consentForm.checkValidity()) {
                consentForm.reportValidity();
                return;
            }

            // Check if at least one procedure is checked
            const checkedProcs = Array.from(procedureCheckboxes).filter(cb => cb.checked);
            if (checkedProcs.length === 0) {
                alert("Por favor, seleccione al menos un procedimiento a realizar.");
                return;
            }

            // Verify signature validations
            if (professionalPad && !professionalPad.hasSigned) {
                alert("Por favor, la profesional manicurista debe firmar el documento.");
                return;
            }

            if (clientPad && !clientPad.hasSigned) {
                alert("Por favor, el cliente o acudiente debe firmar el documento.");
                return;
            }

            // Save record to localStorage for Cashier Panel
            try {
                const record = {
                    id: Date.now(),
                    tipo_pqr: "Uñas Artificiales",
                    nombre_cliente: document.getElementById("cliente-nombre").value,
                    tipo_documento: document.getElementById("cliente-tipo-doc").value,
                    documento: document.getElementById("cliente-numero-doc").value,
                    telefono: document.getElementById("cliente-telefono").value,
                    es_menor_edad: document.querySelector('input[name="menor-edad"]:checked')?.value === "SI" ? 1 : 0,
                    acudiente_autorizacion: document.getElementById("acudiente-autorizacion")?.value || "",
                    tiene_enfermedad: document.querySelector('input[name="enfermedad-base"]:checked')?.value === "SI" ? 1 : 0,
                    enfermedad_detalle: document.getElementById("enfermedad-detalle")?.value || "",
                    fecha_registro: document.getElementById("documento-fecha").value,
                    sede: document.getElementById("documento-sede").value,
                    nombre_prof: document.getElementById("nombre-profesional").value,
                    procedimientos: checkedProcs.map(cb => cb.closest(".procedure-item").querySelector(".procedure-title").innerText),
                    resultados: document.getElementById("prof-resultados").value,
                    recomendaciones: document.getElementById("prof-recomendaciones").value,
                    observaciones: document.getElementById("prof-observaciones").value
                };
                const records = JSON.parse(localStorage.getItem("pqrs_records") || "[]");
                records.push(record);
                localStorage.setItem("pqrs_records", JSON.stringify(records));
            } catch (err) {
                console.error("Error saving record to localStorage:", err);
            }

            // All validation passed, trigger native print view
            window.print();
        });
    }
});
