import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import schemaSql from "../migration/schema.sql?raw";

describe("PQR Imperio API Tests", () => {
	// Initialize schema in test database before running tests
	beforeAll(async () => {
		const statements = schemaSql
			.split(";")
			.map(s => s.trim())
			.filter(s => s.length > 0);
		
		for (const stmt of statements) {
			try {
				await env.pqr_d1.prepare(stmt).run();
			} catch (err) {
				console.error("Failed to run statement:", stmt, err);
				throw err;
			}
		}
	});

	it("registers a new user and logins successfully", async () => {
		// 1. Register User
		const regRes = await SELF.fetch("http://example.com/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				nombre: "Admin",
				correo: "admin@imperio.com",
				contraseña: "securepassword",
				rol: "Administrador"
			})
		});
		
		if (regRes.status !== 201) {
			console.error("Register failed:", await regRes.text());
		}
		expect(regRes.status).toBe(201);
		
		const regData = await regRes.json();
		expect(regData.success).toBe(true);

		// 2. Login User
		const loginRes = await SELF.fetch("http://example.com/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				correo: "admin@imperio.com",
				contraseña: "securepassword"
			})
		});
		expect(loginRes.status).toBe(200);
		const loginData = await loginRes.json();
		expect(loginData.success).toBe(true);
		expect(loginData.user.nombre).toBe("Admin");
	});

	it("creates, lists, fetches and deletes a customer registry with nested tables", async () => {
		// Valid 1x1 transparent PNG base64 string
		const validBase64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

		// 1. Create Registry
		const payload = {
			tipo_pqr: "Reclamación",
			nombre_cliente: "Maria Lopez",
			tipo_documento: "Cédula",
			documento: "1098765432",
			ciudad_expedicion: "Bogotá",
			telefono: "3001234567",
			es_menor_edad: false,
			tiene_enfermedad: true,
			enfermedad_detalle: "Alergia a la acetona",
			sede: "Sede Norte",
			nombre_prof: "Johana Profesional",
			firma_profesional: validBase64Image,
			firma_cliente: validBase64Image,
			detalles_unas: {
				proc_manicura_rusa: true,
				proc_acrilico: false,
				proc_polygel: true,
				proc_rubber: false,
				proc_retoques: false,
				proc_retiro: false,
				proc_onicofagia: false,
				uñas_otro_lado: false,
				retiro_otro_lado: false
			},
			condiciones_especiales: {
				posible_condicion_piel: true,
				especifique_condicion_piel: "Piel seca alrededor de cutícula",
				posible_condicion_pestañas: false
			},
			observaciones_prof: {
				patologia_detectada: "Ninguna",
				recomendaciones: "Hidratar cutículas con aceite de almendras",
				adicionales: "Cita de control en 15 días"
			}
		};

		const createRes = await SELF.fetch("http://example.com/api/registros", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		
		if (createRes.status !== 201) {
			console.error("Create Registry failed:", await createRes.text());
		}
		expect(createRes.status).toBe(201);
		
		const createData = await createRes.json();
		expect(createData.success).toBe(true);
		const newId = createData.registro_id;
		expect(newId).toBeDefined();

		// 2. List Registries
		const listRes = await SELF.fetch("http://example.com/api/registros");
		expect(listRes.status).toBe(200);
		const listData = await listRes.json();
		expect(listData.length).toBeGreaterThan(0);
		expect(listData[0].nombre_cliente).toBe("Maria Lopez");

		// 3. Fetch Detailed Registry
		const getRes = await SELF.fetch(`http://example.com/api/registros/${newId}`);
		expect(getRes.status).toBe(200);
		const getData = await getRes.json();
		expect(getData.nombre_cliente).toBe("Maria Lopez");
		expect(getData.detalles_unas.proc_manicura_rusa).toBe(1);
		expect(getData.condiciones_especiales.especifique_condicion_piel).toBe("Piel seca alrededor de cutícula");
		expect(getData.observaciones_prof.recomendaciones).toBe("Hidratar cutículas con aceite de almendras");
		
		// Verify R2 URL paths
		expect(getData.firma_cliente).toContain("/api/signatures/client_");
		expect(getData.firma_profesional).toContain("/api/signatures/prof_");

		// 4. Delete Registry
		const delRes = await SELF.fetch(`http://example.com/api/registros/${newId}`, {
			method: "DELETE"
		});
		expect(delRes.status).toBe(200);
		const delData = await delRes.json();
		expect(delData.success).toBe(true);

		// 5. Try fetching again (should be 404)
		const getRes2 = await SELF.fetch(`http://example.com/api/registros/${newId}`);
		expect(getRes2.status).toBe(404);
	});
});
