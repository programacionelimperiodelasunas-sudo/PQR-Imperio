document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:8787"; // Cambiar por tu URL de Cloudflare Worker en producción

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

    // 2. SIGNATURE CANVAS PAD
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

            this.canvas.addEventListener("touchend", () => {
                const mouseEvent = new MouseEvent("mouseup", {});
                this.canvas.dispatchEvent(mouseEvent);
            });
        }

        getMousePos(e) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
                y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
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

    const contractorPad = new SignaturePad("canvas-contractor");

    // Clear buttons
    document.querySelectorAll(".btn-clear-sig").forEach(button => {
        button.addEventListener("click", () => {
            const canvasId = button.getAttribute("data-canvas");
            if (canvasId === "canvas-contractor" && contractorPad) {
                contractorPad.clear();
            }
        });
    });

    // 3. VALIDATIONS & PRINT TRIGGER
    const btnPrint = document.getElementById("btn-print");
    const consentForm = document.getElementById("consent-form");

    if (btnPrint && consentForm) {
        btnPrint.addEventListener("click", async () => {
            // Check form validations (HTML5 required attributes)
            if (!consentForm.checkValidity()) {
                consentForm.reportValidity();
                return;
            }

            // Verify signature validation
            if (contractorPad && !contractorPad.hasSigned) {
                alert("Por favor, el contratista o manicurista debe firmar el documento.");
                return;
            }

            btnPrint.disabled = true;
            const originalText = btnPrint.innerHTML;
            btnPrint.innerText = "Guardando vinculación...";

            try {
                const payload = {
                    tipo_pqr: "Contratistas y Manicuristas",
                    nombre_cliente: document.getElementById("contratista-nombre").value,
                    tipo_documento: document.getElementById("contratista-tipo-doc").value,
                    documento: document.getElementById("contratista-numero-doc").value,
                    ciudad_expedicion: document.getElementById("contratista-expedicion").value,
                    telefono: document.getElementById("contratista-telefono").value,
                    es_menor_edad: false,
                    tiene_enfermedad: false,
                    sede: "Sede Administrativa",
                    nombre_prof: "Lizeth Valeria Chacón Sánchez",
                    firma_profesional: "CEO Stamp", // Constant CEO signature indicator
                    firma_cliente: contractorPad.canvas.toDataURL("image/png"),
                    observaciones_prof: {
                        patologia_detectada: "N/A",
                        recomendaciones: "Vinculación contractual y tratamiento de datos.",
                        adicionales: `Email: ${document.getElementById("contratista-email").value}`
                    }
                };

                const res = await fetch(`${API_URL}/api/registros`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "Error al guardar el registro");
                }

                alert("¡Vinculación guardada con éxito en la base de datos!");
                window.print();

                // Reset form and UI states
                consentForm.reset();
                if (contractorPad) contractorPad.clear();

                // Re-initialize date
                if (dateInput) {
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    let mm = today.getMonth() + 1;
                    let dd = today.getDate();
                    if (dd < 10) dd = '0' + dd;
                    if (mm < 10) mm = '0' + mm;
                    dateInput.value = `${yyyy}-${mm}-${dd}`;
                }
            } catch (err) {
                console.error(err);
                alert("Ocurrió un error al guardar en la base de datos: " + err.message);
            } finally {
                btnPrint.disabled = false;
                btnPrint.innerHTML = originalText;
            }
        });
    }
});
