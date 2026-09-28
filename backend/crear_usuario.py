import sqlite3,os,getpass
from datetime import datetime
from werkzeug.security import generate_password_hash
DB=os.path.join(os.path.dirname(__file__),"app_data.db")
print("\nCELULAR STAR - CREAR / ACTUALIZAR USUARIO\n")
usuario=input("Usuario: ").strip()
nombre=input("Nombre del responsable: ").strip()
rol=input("Rol [SUPERVISOR/ADMIN]: ").strip().upper()
if rol not in ("SUPERVISOR","ADMIN"): raise SystemExit("Rol invalido.")
almacen=None if rol=="ADMIN" else input("Codigo de almacen (ej. 02): ").strip()
pw=getpass.getpass("Contrasena: ")
pw2=getpass.getpass("Repite contrasena: ")
if not usuario or not nombre or not pw or pw!=pw2: raise SystemExit("Datos invalidos o contrasenas no coinciden.")
c=sqlite3.connect(DB)
c.execute("""CREATE TABLE IF NOT EXISTS usuarios(id INTEGER PRIMARY KEY AUTOINCREMENT,usuario TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,nombre TEXT NOT NULL,rol TEXT NOT NULL,codigo_almacen TEXT,activo INTEGER NOT NULL DEFAULT 1,fecha_creacion TEXT NOT NULL)""")
exists=c.execute("SELECT id FROM usuarios WHERE usuario=?",(usuario,)).fetchone()
if exists:c.execute("UPDATE usuarios SET password_hash=?,nombre=?,rol=?,codigo_almacen=?,activo=1 WHERE usuario=?",(generate_password_hash(pw),nombre,rol,almacen,usuario))
else:c.execute("INSERT INTO usuarios(usuario,password_hash,nombre,rol,codigo_almacen,fecha_creacion) VALUES(?,?,?,?,?,?)",(usuario,generate_password_hash(pw),nombre,rol,almacen,datetime.now().isoformat(timespec="seconds")))
c.commit();c.close();print("\nUsuario guardado correctamente.\n")
