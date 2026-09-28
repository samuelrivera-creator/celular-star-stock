CELULAR STAR V6 — AUTENTICACION Y SUCURSAL AUTOMATICA

REGLA PRINCIPAL
SQL Server / SAP es SOLO LECTURA. app.py únicamente ejecuta SELECT contra SAP.
Usuarios, sesiones, validaciones y solicitudes se guardan en backend/app_data.db (SQLite).

ACTUALIZAR DESDE V5
1. Conserva tu archivo backend\.env que ya funciona.
2. Reemplaza la carpeta anterior por esta V6, PERO vuelve a copiar tu .env dentro de backend.
3. Ejecuta backend\iniciar_api.bat.
4. La primera vez crea usuarios con backend\crear_usuario.bat.

CREAR SUPERVISOR
- Usuario: el que quieras
- Nombre: nombre del responsable
- Rol: SUPERVISOR
- Codigo almacen: por ejemplo 02
- Contraseña: la eliges tú; no se muestra mientras escribes.
La contraseña se guarda como hash, no en texto plano.

CREAR ADMIN
- Ejecuta crear_usuario.bat otra vez.
- Rol: ADMIN
- No solicita almacén.
El admin entra por el MISMO supervisor.html. No existe botón Admin público.

ACCESO
Público: index.html
Interno: supervisor.html (se comparte directamente con responsables)
El catálogo público ya NO muestra botón de Supervisores.

PRUEBAS
http://127.0.0.1:5000/api/health
Debe devolver SQL conectado + SQLite conectado.

IMPORTANTE
- No publiques backend/.env.
- No publiques backend/app_data.db.
- Para producción cambiaremos la API de desarrollo por un servidor WSGI y una URL segura.
