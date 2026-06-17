CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    contraseña TEXT NOT NULL,
    rol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_pqr TEXT NOT NULL,
    nombre_cliente TEXT NOT NULL,
    tipo_documento TEXT NOT NULL,
    documento TEXT NOT NULL,
    ciudad_expedicion TEXT,
    telefono TEXT NOT NULL,
    es_menor_edad INTEGER DEFAULT 0,
    acudiente_autorizacion TEXT,
    tiene_enfermedad INTEGER DEFAULT 0,
    enfermedad_detalle TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    sede TEXT NOT NULL,
    nombre_prof TEXT NOT NULL,
    firma_profesional TEXT NOT NULL,
    firma_cliente TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS detalles_unas (
    registro_id INTEGER PRIMARY KEY,
    proc_manicura_rusa INTEGER DEFAULT 0,
    proc_acrilico INTEGER DEFAULT 0,
    proc_polygel INTEGER DEFAULT 0,
    proc_rubber INTEGER DEFAULT 0,
    proc_retoques INTEGER DEFAULT 0,
    proc_retiro INTEGER DEFAULT 0,
    proc_onicofagia INTEGER DEFAULT 0,
    uñas_otro_lado INTEGER DEFAULT 0,
    retiro_otro_lado INTEGER DEFAULT 0,
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS detalles_cejas (
    registro_id INTEGER PRIMARY KEY,
    proc_depilacion INTEGER DEFAULT 0,
    proc_pestañas INTEGER DEFAULT 0,
    proc_laminado INTEGER DEFAULT 0,
    proc_lifting INTEGER DEFAULT 0,
    proc_micropigmentacion INTEGER DEFAULT 0,
    proc_retiro_de_pestañas INTEGER DEFAULT 0,
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS detalles_pedicure (
    registro_id INTEGER PRIMARY KEY,
    proc_esmalte INTEGER DEFAULT 0,
    proc_reconstruccion INTEGER DEFAULT 0,
    proc_onicocriptosis INTEGER DEFAULT 0,
    proc_posible_onicomicosis INTEGER DEFAULT 0,
    oni_leve_criterios TEXT,
    oni_medio_criterios TEXT,
    onico_tipo_criterios TEXT,
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS anomalias_unas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_id INTEGER NOT NULL,
    tipo_anomalia TEXT NOT NULL, 
    mano TEXT NOT NULL,          
    dedo TEXT NOT NULL,          
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS condiciones_especiales (
   registro_id INTEGER PRIMARY KEY,
   posible_condicion_piel INTEGER DEFAULT 0,
   especifique_condicion_piel TEXT NOT NULL,
   posible_condicion_pestañas INTEGER DEFAULT 0,
   especifique_condicion_pestañas TEXT NOT NULL,
   FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS observaciones_prof (
    registro_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patologia_detectada TEXT NOT NULL,
    recomendaciones TEXT NOT NULL,
    adicionales TEXT NOT NULL,
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anamnesis_pedicure (
    registro_id INTEGER PRIMARY KEY,
    origen_condicion TEXT NOT NULL DEFAULT 'Persona sana',
    alergias TEXT,
    alergia_otra TEXT,
    historial_cirugias TEXT,
    hab_fuma INTEGER DEFAULT 0,
    hab_drogas INTEGER DEFAULT 0,
    hab_alcohol INTEGER DEFAULT 0,
    hab_embarazo INTEGER DEFAULT 0,
    medicamentos_actuales TEXT,
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patologias_pedicure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_id INTEGER NOT NULL,
    patologia TEXT NOT NULL,
    presenta_personal INTEGER DEFAULT 0,
    presenta_familiar INTEGER DEFAULT 0,
    FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE
);
