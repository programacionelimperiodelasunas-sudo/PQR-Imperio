// Helper to handle CORS headers
function corsHeaders() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS, DELETE",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age": "86400",
	};
}

// Helper to respond with JSON
function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			...corsHeaders(),
		},
	});
}

// Helper to decode Base64 string to Uint8Array and upload to R2
async function uploadBase64ToR2(base64Str, prefix, env) {
	if (!base64Str || !base64Str.startsWith("data:image/")) {
		return base64Str; // Return as-is if it's already an R2 path or not base64
	}
	const parts = base64Str.split(",");
	const base64Data = parts[1];
	const contentType = parts[0].split(";")[0].split(":")[1] || "image/png";

	// Decode Base64 in JavaScript
	const binaryStr = atob(base64Data);
	const len = binaryStr.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}

	const randomSuffix = Math.floor(Math.random() * 10000);
	const filename = `${prefix}_${Date.now()}_${randomSuffix}.png`;

	// Upload to R2 Bucket
	await env.pqr_r2.put(filename, bytes, {
		httpMetadata: { contentType },
	});

	// Return relative path
	return `/api/signatures/${filename}`;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// Handle OPTIONS request for CORS preflight
		if (method === "OPTIONS") {
			return new Response(null, {
				headers: corsHeaders(),
			});
		}

		try {
			// ================= SIGNATURES SERVING ROUTE =================

			// GET /api/signatures/:filename
			if (path.startsWith("/api/signatures/") && method === "GET") {
				const filename = path.split("/").pop();
				if (!filename) {
					return jsonResponse({ error: "Nombre de archivo no especificado" }, 400);
				}

				const object = await env.pqr_r2.get(filename);
				if (!object) {
					return new Response("Firma no encontrada", { status: 404 });
				}

				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set("etag", object.httpEtag);
				headers.set("Access-Control-Allow-Origin", "*");
				headers.set("Access-Control-Allow-Methods", "GET");
				headers.set("Cache-Control", "public, max-age=31536000"); // Cache signatures for 1 year

				return new Response(object.body, { headers });
			}

			// ================= AUTH ROUTES =================

			// POST /api/auth/register
			if (path === "/api/auth/register" && method === "POST") {
				const { nombre, correo, contraseña, rol, sede } = await request.json();
				if (!nombre || !correo || !contraseña || !rol) {
					return jsonResponse({ error: "Todos los campos son obligatorios" }, 400);
				}

				// Insert user
				const result = await env.pqr_d1.prepare(
					"INSERT INTO users (nombre, correo, contraseña, rol, sede) VALUES (?, ?, ?, ?, ?)"
				)
					.bind(nombre, correo, contraseña, rol, roles_need_sede(rol) ? (sede || null) : null)
					.run();

				function roles_need_sede(r) {
					return r === "cajero" || r === "profesional";
				}

				return jsonResponse({ success: true, message: "Usuario registrado exitosamente" }, 201);
			}

			// POST /api/auth/login
			if (path === "/api/auth/login" && method === "POST") {
				const { correo, contraseña } = await request.json();
				if (!correo || !contraseña) {
					return jsonResponse({ error: "Correo y contraseña son obligatorios" }, 400);
				}

				const user = await env.pqr_d1.prepare(
					"SELECT id, nombre, correo, rol, sede FROM users WHERE correo = ? AND contraseña = ?"
				)
					.bind(correo, contraseña)
					.first();

				if (!user) {
					return jsonResponse({ error: "Credenciales incorrectas" }, 401);
				}

				return jsonResponse({ success: true, user });
			}

			// GET /api/users (List all registered users)
			if (path === "/api/users" && method === "GET") {
				const { results } = await env.pqr_d1.prepare("SELECT id, nombre, correo, rol, sede FROM users ORDER BY id DESC").all();
				return jsonResponse(results);
			}

			// DELETE /api/users/:id
			if (path.startsWith("/api/users/") && method === "DELETE") {
				const idStr = path.split("/").pop();
				const id = parseInt(idStr, 10);
				if (isNaN(id)) {
					return jsonResponse({ error: "ID no válido" }, 400);
				}

				const result = await env.pqr_d1.prepare("DELETE FROM users WHERE id = ?").run();
				if (result.meta.changes === 0) {
					return jsonResponse({ error: "Usuario no encontrado" }, 404);
				}

				return jsonResponse({ success: true, message: "Usuario eliminado exitosamente" });
			}

			// ================= REGISTROS ROUTES =================

			// GET /api/registros (List basic registry details)
			if (path === "/api/registros" && method === "GET") {
				const rolParam = url.searchParams.get("rol");
				const sedeParam = url.searchParams.get("sede");
				const nombreParam = url.searchParams.get("nombre");

				let query = "SELECT id, tipo_pqr, nombre_cliente, documento, fecha_registro, sede, nombre_prof FROM registros";
				let conditions = [];
				let params = [];

				if (rolParam === "profesional") {
					// Professionals only see their own records
					conditions.push("nombre_prof = ?");
					params.push(nombreParam || "");
				} else if (rolParam && rolParam !== "administrador") {
					// Cashiers only see records for nails, brows, and pedicure
					conditions.push("tipo_pqr IN ('Uñas Artificiales', 'Cejas y Pestañas', 'Pedicura Especializada')");
					if (sedeParam) {
						conditions.push("sede = ?");
						params.push(sedeParam);
					}
				}

				if (conditions.length > 0) {
					query += " WHERE " + conditions.join(" AND ");
				}

				query += " ORDER BY fecha_registro DESC";

				const { results } = await env.pqr_d1.prepare(query).bind(...params).all();
				return jsonResponse(results);
			}

			// GET /api/registros/:id (Get detailed registry with all sub-tables)
			if (path.startsWith("/api/registros/") && method === "GET") {
				const idStr = path.split("/").pop();
				const id = parseInt(idStr, 10);
				if (isNaN(id)) {
					return jsonResponse({ error: "ID no válido" }, 400);
				}

				// Fetch main record
				const registro = await env.pqr_d1.prepare("SELECT * FROM registros WHERE id = ?").bind(id).first();
				if (!registro) {
					return jsonResponse({ error: "Registro no encontrado" }, 404);
				}

				// Fetch child records
				const detalles_unas = await env.pqr_d1.prepare("SELECT * FROM detalles_unas WHERE registro_id = ?").bind(id).first() || null;
				const detalles_cejas = await env.pqr_d1.prepare("SELECT * FROM detalles_cejas WHERE registro_id = ?").bind(id).first() || null;
				const detalles_pedicure = await env.pqr_d1.prepare("SELECT * FROM detalles_pedicure WHERE registro_id = ?").bind(id).first() || null;
				const condiciones_especiales = await env.pqr_d1.prepare("SELECT * FROM condiciones_especiales WHERE registro_id = ?").bind(id).first() || null;
				const observaciones_prof = await env.pqr_d1.prepare("SELECT * FROM observaciones_prof WHERE registro_id = ?").bind(id).first() || null;
				const anamnesis_pedicure = await env.pqr_d1.prepare("SELECT * FROM anamnesis_pedicure WHERE registro_id = ?").bind(id).first() || null;

				const anomalias_unas_res = await env.pqr_d1.prepare("SELECT * FROM anomalias_unas WHERE registro_id = ?").bind(id).all();
				const anomalias_unas = anomalias_unas_res.results || [];

				const patologias_pedicure_res = await env.pqr_d1.prepare("SELECT * FROM patologias_pedicure WHERE registro_id = ?").bind(id).all();
				const patologias_pedicure = patologias_pedicure_res.results || [];

				return jsonResponse({
					...registro,
					detalles_unas,
					detalles_cejas,
					detalles_pedicure,
					condiciones_especiales,
					observaciones_prof,
					anamnesis_pedicure,
					anomalias_unas,
					patologias_pedicure
				});
			}

			// DELETE /api/registros/:id
			if (path.startsWith("/api/registros/") && method === "DELETE") {
				const idStr = path.split("/").pop();
				const id = parseInt(idStr, 10);
				if (isNaN(id)) {
					return jsonResponse({ error: "ID no válido" }, 400);
				}

				// ON DELETE CASCADE will handle the rest of the related tables
				const result = await env.pqr_d1.prepare("DELETE FROM registros WHERE id = ?").bind(id).run();
				if (result.meta.changes === 0) {
					return jsonResponse({ error: "Registro no encontrado" }, 404);
				}

				return jsonResponse({ success: true, message: "Registro eliminado exitosamente" });
			}

			// POST /api/registros (Create new registry and all its details in a transaction)
			if (path === "/api/registros" && method === "POST") {
				const data = await request.json();

				// Validate main registry fields
				const requiredFields = [
					"tipo_pqr", "nombre_cliente", "tipo_documento", "documento",
					"telefono", "sede", "nombre_prof", "firma_profesional", "firma_cliente"
				];
				for (const field of requiredFields) {
					if (data[field] === undefined || data[field] === null) {
						return jsonResponse({ error: `El campo '${field}' es obligatorio` }, 400);
					}
				}

				// Upload signatures to Cloudflare R2
				const firma_cliente_url = await uploadBase64ToR2(data.firma_cliente, "client", env);
				const firma_profesional_url = await uploadBase64ToR2(data.firma_profesional, "prof", env);

				// We will prepare all SQL statements and run them in a batch transaction
				const statements = [];

				// 1. Insert main registry
				statements.push(
					env.pqr_d1.prepare(`
						INSERT INTO registros (
							tipo_pqr, nombre_cliente, tipo_documento, documento, ciudad_expedicion, 
							telefono, es_menor_edad, acudiente_autorizacion, tiene_enfermedad, 
							enfermedad_detalle, sede, nombre_prof, firma_profesional, firma_cliente
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`).bind(
						data.tipo_pqr,
						data.nombre_cliente,
						data.tipo_documento,
						data.documento,
						data.ciudad_expedicion || null,
						data.telefono,
						data.es_menor_edad ? 1 : 0,
						data.acudiente_autorizacion || null,
						data.tiene_enfermedad ? 1 : 0,
						data.enfermedad_detalle || null,
						data.sede,
						data.nombre_prof,
						firma_profesional_url,
						firma_cliente_url
					)
				);

				// 2. Insert detalles_unas if provided
				if (data.detalles_unas) {
					const du = data.detalles_unas;
					statements.push(
						env.pqr_d1.prepare(`
							INSERT INTO detalles_unas (
								registro_id, proc_manicura_rusa, proc_acrilico, proc_polygel, proc_rubber, 
								proc_retoques, proc_retiro, proc_onicofagia, uñas_otro_lado, retiro_otro_lado
							) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
						`).bind(
							du.proc_manicura_rusa ? 1 : 0,
							du.proc_acrilico ? 1 : 0,
							du.proc_polygel ? 1 : 0,
							du.proc_rubber ? 1 : 0,
							du.proc_retoques ? 1 : 0,
							du.proc_retiro ? 1 : 0,
							du.proc_onicofagia ? 1 : 0,
							du.uñas_otro_lado ? 1 : 0,
							du.retiro_otro_lado ? 1 : 0
						)
					);
				}

				// 3. Insert detalles_cejas if provided
				if (data.detalles_cejas) {
					const dc = data.detalles_cejas;
					statements.push(
						env.pqr_d1.prepare(`
							INSERT INTO detalles_cejas (
								registro_id, proc_depilacion, proc_pestañas, proc_laminado, 
								proc_lifting, proc_micropigmentacion, proc_retiro_de_pestañas
							) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?)
						`).bind(
							dc.proc_depilacion ? 1 : 0,
							dc.proc_pestañas ? 1 : 0,
							dc.proc_laminado ? 1 : 0,
							dc.proc_lifting ? 1 : 0,
							dc.proc_micropigmentacion ? 1 : 0,
							dc.proc_retiro_de_pestañas ? 1 : 0
						)
					);
				}

				// 4. Insert detalles_pedicure if provided
				if (data.detalles_pedicure) {
					const dp = data.detalles_pedicure;
					statements.push(
						env.pqr_d1.prepare(`
							INSERT INTO detalles_pedicure (
								registro_id, proc_esmalte, proc_reconstruccion, proc_onicocriptosis, 
								proc_posible_onicomicosis, oni_leve_criterios, oni_medio_criterios, onico_tipo_criterios
							) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?)
						`).bind(
							dp.proc_esmalte ? 1 : 0,
							dp.proc_reconstruccion ? 1 : 0,
							dp.proc_onicocriptosis ? 1 : 0,
							dp.proc_posible_onicomicosis ? 1 : 0,
							dp.oni_leve_criterios || null,
							dp.oni_medio_criterios || null,
							dp.onico_tipo_criterios || null
						)
					);
				}

				// 5. Insert anomalias_unas if provided (Array)
				if (Array.isArray(data.anomalias_unas)) {
					for (const anomalia of data.anomalias_unas) {
						statements.push(
							env.pqr_d1.prepare(`
								INSERT INTO anomalias_unas (
									registro_id, tipo_anomalia, mano, dedo
								) VALUES (last_insert_rowid(), ?, ?, ?)
							`).bind(
								anomalia.tipo_anomalia,
								anomalia.mano,
								anomalia.dedo
							)
						);
					}
				}

				// 6. Insert condiciones_especiales if provided
				if (data.condiciones_especiales) {
					const ce = data.condiciones_especiales;
					statements.push(
						env.pqr_d1.prepare(`
							INSERT INTO condiciones_especiales (
								registro_id, posible_condicion_piel, especifique_condicion_piel, 
								posible_condicion_pestañas, especifique_condicion_pestañas
							) VALUES (last_insert_rowid(), ?, ?, ?, ?)
						`).bind(
							ce.posible_condicion_piel ? 1 : 0,
							ce.especifique_condicion_piel || null,
							ce.posible_condicion_pestañas ? 1 : 0,
							ce.especifique_condicion_pestañas || null
						)
					);
				}

				// 7. Insert observaciones_prof if provided
				if (data.observaciones_prof) {
					const op = data.observaciones_prof;
					statements.push(
						env.pqr_d1.prepare(`
							INSERT INTO observaciones_prof (
								registro_id, patologia_detectada, recomendaciones, adicionales
							) VALUES (last_insert_rowid(), ?, ?, ?)
						`).bind(
							op.patologia_detectada || "",
							op.recomendaciones || "",
							op.adicionales || ""
						)
					);
				}

				// 8. Insert anamnesis_pedicure if provided
				if (data.anamnesis_pedicure) {
					const ap = data.anamnesis_pedicure;
					statements.push(
						env.pqr_d1.prepare(`
							INSERT INTO anamnesis_pedicure (
								registro_id, origen_condicion, alergias, alergia_otra, 
								historial_cirugias, hab_fuma, hab_drogas, hab_alcohol, 
								hab_embarazo, medicamentos_actuales
							) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
						`).bind(
							ap.origen_condicion || "Persona sana",
							ap.alergias || null,
							ap.alergia_otra || null,
							ap.historial_cirugias || null,
							ap.hab_fuma ? 1 : 0,
							ap.hab_drogas ? 1 : 0,
							ap.hab_alcohol ? 1 : 0,
							ap.hab_embarazo ? 1 : 0,
							ap.medicamentos_actuales || null
						)
					);
				}

				// 9. Insert patologias_pedicure if provided (Array)
				if (Array.isArray(data.patologias_pedicure)) {
					for (const pato of data.patologias_pedicure) {
						statements.push(
							env.pqr_d1.prepare(`
								INSERT INTO patologias_pedicure (
									registro_id, patologia, presenta_personal, presenta_familiar
								) VALUES (last_insert_rowid(), ?, ?, ?)
							`).bind(
								pato.patologia,
								pato.presenta_personal ? 1 : 0,
								pato.presenta_familiar ? 1 : 0
							)
						);
					}
				}

				// Execute all statements transactionally
				const results = await env.pqr_d1.batch(statements);

				// The first result metadata will contain the last row id of the 'registros' table insert
				const registroId = results[0].meta.last_row_id;

				return jsonResponse({
					success: true,
					message: "Registro creado exitosamente con todos sus detalles",
					registro_id: registroId
				}, 201);
			}

			// Route not found
			return jsonResponse({ error: "Ruta no encontrada" }, 404);

		} catch (error) {
			return jsonResponse({ error: error.message || "Error interno del servidor" }, 500);
		}
	},
};
