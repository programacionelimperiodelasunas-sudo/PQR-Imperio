document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "https://pqr-imperio.pqr-imperio.workers.dev"; // Cambiar por tu URL de Cloudflare Worker en producción

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

    // 1.5. AUTO-FILL PROFESSIONAL DATA IF LOGGED IN
    const userStr = localStorage.getItem("adminUser");
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (user && user.nombre) {
                const nombreProfInput = document.getElementById("nombre-profesional");
                if (nombreProfInput) {
                    nombreProfInput.value = user.nombre;
                }
            }
            if (user && user.sede) {
                const sedeSelect = document.getElementById("documento-sede");
                if (sedeSelect) {
                    sedeSelect.value = user.sede;
                }
            }
        } catch (e) {
            console.error("Error parsing adminUser from localStorage:", e);
        }
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
    const clienteTipoDoc = document.getElementById("cliente-tipo-doc");
    const clienteOtroDoc = document.getElementById("cliente-otro-doc");

    function toggleOtroDocumento() {
        if (clienteTipoDoc && clienteOtroDoc) {
            if (clienteTipoDoc.value === "Otro") {
                clienteOtroDoc.disabled = false;
                clienteOtroDoc.required = true;
            } else {
                clienteOtroDoc.disabled = true;
                clienteOtroDoc.required = false;
                clienteOtroDoc.value = "";
            }
        }
    }
    if (clienteTipoDoc) {
        clienteTipoDoc.addEventListener("change", toggleOtroDocumento);
    }

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

    const menorSi = document.getElementById("menor-si");
    const menorNo = document.getElementById("menor-no");
    const condAcudiente = document.getElementById("conditional-acudiente");
    const acudienteAutorizacion = document.getElementById("acudiente-autorizacion");
    const acudienteNombre = document.getElementById("acudiente-nombre");
    const acudienteDocumento = document.getElementById("acudiente-documento");

    function updateAcudienteVal() {
        if (acudienteNombre && acudienteDocumento && acudienteAutorizacion) {
            const nombre = acudienteNombre.value.trim();
            const doc = acudienteDocumento.value.trim();
            if (nombre || doc) {
                acudienteAutorizacion.value = `${nombre} - C.C. ${doc}`;
            } else {
                acudienteAutorizacion.value = "";
            }
        }
    }

    if (acudienteNombre && acudienteDocumento) {
        acudienteNombre.addEventListener("input", updateAcudienteVal);
        acudienteDocumento.addEventListener("input", updateAcudienteVal);
    }

    function toggleAcudiente() {
        if (menorSi && menorSi.checked) {
            condAcudiente.classList.add("active");
            if (acudienteNombre) acudienteNombre.required = true;
            if (acudienteDocumento) acudienteDocumento.required = true;
        } else {
            condAcudiente.classList.remove("active");
            if (acudienteNombre) {
                acudienteNombre.required = false;
                acudienteNombre.value = "";
            }
            if (acudienteDocumento) {
                acudienteDocumento.required = false;
                acudienteDocumento.value = "";
            }
            if (acudienteAutorizacion) {
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

            this.ctx.strokeStyle = "#1a1a1a";
            this.ctx.lineJoin = "round";
            this.ctx.lineCap = "round";
            this.ctx.lineWidth = 2.5;

            this.initEvents();
        }

        initEvents() {
            this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
            this.canvas.addEventListener("mousemove", (e) => this.draw(e));
            this.canvas.addEventListener("mouseup", () => this.stopDrawing());
            this.canvas.addEventListener("mouseout", () => this.stopDrawing());

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

    const professionalPad = new SignaturePad("canvas-professional");
    const clientPad = new SignaturePad("canvas-client");

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
        btnPrint.addEventListener("click", async () => {
            if (!consentForm.checkValidity()) {
                consentForm.reportValidity();
                return;
            }

            const checkedProcs = Array.from(procedureCheckboxes).filter(cb => cb.checked);
            if (checkedProcs.length === 0) {
                alert("Por favor, seleccione al menos un procedimiento a realizar.");
                return;
            }

            if (professionalPad && !professionalPad.hasSigned) {
                alert("Por favor, la profesional manicurista debe firmar el documento.");
                return;
            }

            if (clientPad && !clientPad.hasSigned) {
                alert("Por favor, el cliente o acudiente debe firmar el documento.");
                return;
            }

            // Disable button during saving to prevent double submission
            btnPrint.disabled = true;
            const originalText = btnPrint.innerHTML;
            btnPrint.innerText = "Guardando en base de datos...";

            try {
                // Parse anomalies
                const anomalias_unas = [];
                const anomalyRows = document.querySelectorAll(".anomalies-table tbody tr");
                anomalyRows.forEach(row => {
                    const tipo = row.getAttribute("data-anomaly");
                    const manos = Array.from(row.querySelectorAll('input[name$="-mano"]:checked')).map(cb => cb.value);
                    const dedos = Array.from(row.querySelectorAll('input[name$="-dedos"]:checked')).map(cb => cb.value);
                    
                    if (manos.length > 0 && dedos.length > 0) {
                        manos.forEach(mano => {
                            dedos.forEach(dedo => {
                                anomalias_unas.push({ tipo_anomalia: tipo, mano, dedo });
                            });
                        });
                    }
                });

                // Construct full API payload
                const payload = {
                    tipo_pqr: "Uñas Artificiales",
                    nombre_cliente: document.getElementById("cliente-nombre").value,
                    tipo_documento: document.getElementById("cliente-tipo-doc").value,
                    documento: document.getElementById("cliente-numero-doc").value,
                    ciudad_expedicion: document.getElementById("cliente-expedicion").value,
                    telefono: document.getElementById("cliente-telefono").value,
                    es_menor_edad: document.querySelector('input[name="menor-edad"]:checked')?.value === "SI",
                    acudiente_autorizacion: document.getElementById("acudiente-autorizacion")?.value || null,
                    tiene_enfermedad: document.querySelector('input[name="enfermedad-base"]:checked')?.value === "SI",
                    enfermedad_detail: document.getElementById("enfermedad-detail")?.value || null, // API handles fallback
                    enfermedad_detalle: document.getElementById("enfermedad-detalle")?.value || null,
                    sede: document.getElementById("documento-sede").value,
                    nombre_prof: document.getElementById("nombre-profesional").value,
                    firma_profesional: professionalPad.canvas.toDataURL("image/png"),
                    firma_cliente: clientPad.canvas.toDataURL("image/png"),
                    
                    detalles_unas: {
                        proc_manicura_rusa: document.getElementById("proc-manicura-rusa").checked,
                        proc_acrilico: document.getElementById("proc-acrilico").checked,
                        proc_polygel: document.getElementById("proc-polygel").checked,
                        proc_rubber: document.getElementById("proc-rubber").checked,
                        proc_retoques: document.getElementById("proc-retoques").checked,
                        proc_retiro: document.getElementById("proc-retiro").checked,
                        proc_onicofagia: document.getElementById("proc-onicofagia").checked,
                        uñas_otro_lado: document.querySelector('input[name="uñas-otro-lado"]:checked')?.value === "SI",
                        retiro_otro_lado: document.querySelector('input[name="retiro-otro-lado"]:checked')?.value === "SI"
                    },
                    anomalias_unas,
                    observaciones_prof: {
                        patologia_detectada: document.getElementById("prof-observaciones").value || "Ninguna",
                        recomendaciones: document.getElementById("prof-recomendaciones").value || "Ninguna",
                        adicionales: document.getElementById("prof-resultados").value || "Ninguna"
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

                alert("¡Registro guardado con éxito en la base de datos!");
                window.print();

                // Reset form and UI states
                consentForm.reset();
                if (professionalPad) professionalPad.clear();
                if (clientPad) clientPad.clear();

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

                // Reset procedure items active state
                document.querySelectorAll(".procedure-item").forEach(item => {
                    item.classList.remove("active");
                    const nestedConfirm = item.querySelector(".proc-confirm");
                    if (nestedConfirm) {
                        nestedConfirm.required = false;
                    }
                });

                // Reset conditional sections
                toggleEnfermedad();
                toggleAcudiente();
                toggleOtroDocumento();
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
