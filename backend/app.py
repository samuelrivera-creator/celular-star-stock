import os,sqlite3,secrets
from datetime import datetime,timedelta
from functools import wraps
from flask import Flask,jsonify,request
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash,check_password_hash
import pyodbc

load_dotenv()
app=Flask(__name__)
CORS(app,allow_headers=["Content-Type","Authorization"])
APP_DB=os.path.join(os.path.dirname(__file__),"app_data.db")
SQL="""SELECT W.ItemCode Codigo,I.ItemName Modelo,W.WhsCode Codigo_Almacen,H.WhsName Sucursal,
CAST(W.OnHand AS INT) Stock FROM OITW W
INNER JOIN OITM I ON I.ItemCode=W.ItemCode
INNER JOIN OWHS H ON H.WhsCode=W.WhsCode
WHERE W.ItemCode LIKE 'TL-%' AND W.OnHand>0 AND H.WhsName LIKE 'Sucursal%'
ORDER BY H.WhsName,I.ItemName"""

def sap():
 d=os.getenv("DB_DRIVER","ODBC Driver 17 for SQL Server");srv=os.getenv("DB_SERVER");dbn=os.getenv("DB_DATABASE")
 if os.getenv("DB_TRUSTED_CONNECTION","no").lower() in ("yes","true","1"):
  cs=f"DRIVER={{{d}}};SERVER={srv};DATABASE={dbn};Trusted_Connection=yes;TrustServerCertificate=yes;"
 else:
  cs=f"DRIVER={{{d}}};SERVER={srv};DATABASE={dbn};UID={os.getenv('DB_USER')};PWD={os.getenv('DB_PASSWORD')};TrustServerCertificate=yes;"
 return pyodbc.connect(cs,timeout=10)

def local():
 c=sqlite3.connect(APP_DB);c.row_factory=sqlite3.Row;return c

def init():
 c=local();c.executescript("""
 CREATE TABLE IF NOT EXISTS usuarios(id INTEGER PRIMARY KEY AUTOINCREMENT,usuario TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,nombre TEXT NOT NULL,rol TEXT NOT NULL,codigo_almacen TEXT,activo INTEGER NOT NULL DEFAULT 1,fecha_creacion TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sesiones(token TEXT PRIMARY KEY,usuario_id INTEGER NOT NULL,expira TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS validaciones(id INTEGER PRIMARY KEY AUTOINCREMENT,codigo TEXT,codigo_almacen TEXT,sucursal TEXT,stock_sql INTEGER,stock_validado INTEGER,supervisor TEXT,fecha TEXT);
 CREATE INDEX IF NOT EXISTS ix_val ON validaciones(codigo,codigo_almacen,id DESC);
 CREATE TABLE IF NOT EXISTS solicitudes(id INTEGER PRIMARY KEY AUTOINCREMENT,codigo TEXT,modelo TEXT,codigo_almacen TEXT,sucursal TEXT,cantidad INTEGER,nombre TEXT,telefono TEXT,correo TEXT,mensaje TEXT,estado TEXT DEFAULT 'PENDIENTE',fecha TEXT);
 """);c.commit();c.close()

def sap_rows():
 cn=sap();q=cn.cursor();q.execute(SQL)
 a=[{"codigo":r.Codigo,"modelo":r.Modelo,"codigo_almacen":str(r.Codigo_Almacen),"sucursal":r.Sucursal,"stock":int(r.Stock or 0)} for r in q.fetchall()]
 cn.close();return a

def last_validation(code,whs):
 c=local();r=c.execute("SELECT * FROM validaciones WHERE codigo=? AND codigo_almacen=? ORDER BY id DESC LIMIT 1",(code,whs)).fetchone();c.close();return dict(r) if r else None

def current_user():
 h=request.headers.get("Authorization","")
 if not h.startswith("Bearer "):return None
 token=h[7:];c=local()
 r=c.execute("""SELECT u.* FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id
 WHERE s.token=? AND s.expira>? AND u.activo=1""",(token,datetime.now().isoformat())).fetchone();c.close()
 return dict(r) if r else None

def auth(fn):
 @wraps(fn)
 def wrap(*a,**k):
  u=current_user()
  if not u:return jsonify(ok=False,error="No autorizado"),401
  request.current_user=u
  return fn(*a,**k)
 return wrap

@app.get("/api/health")
def health():
 try:
  cn=sap();cn.cursor().execute("SELECT 1").fetchone();cn.close()
  return jsonify(ok=True,sql="conectado",app_db="sqlite conectado")
 except Exception as e:return jsonify(ok=False,detalle=str(e)),500

@app.get("/api/inventario")
def inventory():
 try:
  a=sap_rows()
  for x in a:
   v=last_validation(x["codigo"],x["codigo_almacen"])
   x["stock_sql"]=x["stock"];x["stock_validado"]=v["stock_validado"] if v else None
   # A validation is current only while SAP stock remains the same as when validated.
   valid_current=bool(v and int(v["stock_sql"])==int(x["stock"]))
   x["validacion_vigente"]=valid_current
   x["stock_mostrar"]=v["stock_validado"] if valid_current else x["stock"]
   x["fecha_validacion"]=v["fecha"] if v else None
  return jsonify(ok=True,inventario=a,total_registros=len(a))
 except Exception as e:return jsonify(ok=False,error=str(e)),500

@app.post("/api/login")
def login():
 d=request.get_json(force=True);c=local()
 u=c.execute("SELECT * FROM usuarios WHERE usuario=? AND activo=1",(str(d.get("usuario","")).strip(),)).fetchone()
 if not u or not check_password_hash(u["password_hash"],str(d.get("password",""))):
  c.close();return jsonify(ok=False,error="Usuario o contraseña incorrectos"),401
 token=secrets.token_urlsafe(40);exp=(datetime.now()+timedelta(hours=12)).isoformat()
 c.execute("DELETE FROM sesiones WHERE expira<=?",(datetime.now().isoformat(),))
 c.execute("INSERT INTO sesiones(token,usuario_id,expira) VALUES(?,?,?)",(token,u["id"],exp));c.commit();c.close()
 return jsonify(ok=True,token=token,usuario={"nombre":u["nombre"],"rol":u["rol"],"codigo_almacen":u["codigo_almacen"]})

@app.get("/api/me")
@auth
def me():
 u=request.current_user
 return jsonify(ok=True,usuario={"nombre":u["nombre"],"rol":u["rol"],"codigo_almacen":u["codigo_almacen"]})

@app.post("/api/logout")
@auth
def logout():
 token=request.headers["Authorization"][7:];c=local();c.execute("DELETE FROM sesiones WHERE token=?",(token,));c.commit();c.close()
 return jsonify(ok=True)

@app.get("/api/inventario-supervisor")
@auth
def sup_inventory():
 u=request.current_user;a=sap_rows()
 if u["rol"]!="ADMIN":a=[x for x in a if x["codigo_almacen"]==str(u["codigo_almacen"])]
 for x in a:
  v=last_validation(x["codigo"],x["codigo_almacen"]);x["stock_sql"]=x["stock"];x["stock_validado"]=v["stock_validado"] if v else None
  x["validacion_vigente"]=bool(v and int(v["stock_sql"])==int(x["stock"]))
  x["fecha_validacion"]=v["fecha"] if v else None
 return jsonify(ok=True,inventario=a,usuario={"nombre":u["nombre"],"rol":u["rol"],"codigo_almacen":u["codigo_almacen"]})

@app.post("/api/validar")
@auth
def validate():
 u=request.current_user;d=request.get_json(force=True);code=str(d.get("codigo",""));whs=str(d.get("codigo_almacen",""));qty=max(0,int(d.get("stock_validado",0)))
 if u["rol"]!="ADMIN" and whs!=str(u["codigo_almacen"]):return jsonify(ok=False,error="Sucursal no autorizada"),403
 real=next((x for x in sap_rows() if x["codigo"]==code and x["codigo_almacen"]==whs),None)
 if not real:return jsonify(ok=False,error="Articulo/almacen no encontrado"),404
 c=local();c.execute("INSERT INTO validaciones(codigo,codigo_almacen,sucursal,stock_sql,stock_validado,supervisor,fecha) VALUES(?,?,?,?,?,?,?)",(code,whs,real["sucursal"],real["stock"],qty,u["nombre"],datetime.now().isoformat(timespec="seconds")));c.commit();c.close()
 return jsonify(ok=True)

@app.post("/api/solicitudes")
def request_item():
 d=request.get_json(force=True);code=str(d.get("codigo",""));whs=str(d.get("codigo_almacen",""))
 real=next((x for x in sap_rows() if x["codigo"]==code and x["codigo_almacen"]==whs),None)
 if not real:return jsonify(ok=False,error="Articulo/almacen no encontrado"),404
 qty=int(d.get("cantidad",0))
 if qty<1 or not str(d.get("nombre","")).strip() or not str(d.get("telefono","")).strip():return jsonify(ok=False,error="Datos invalidos"),400
 c=local();cur=c.execute("INSERT INTO solicitudes(codigo,modelo,codigo_almacen,sucursal,cantidad,nombre,telefono,correo,mensaje,fecha) VALUES(?,?,?,?,?,?,?,?,?,?)",(code,real["modelo"],whs,real["sucursal"],qty,str(d["nombre"])[:150],str(d["telefono"])[:30],str(d.get("correo",""))[:200],str(d.get("mensaje",""))[:1000],datetime.now().isoformat(timespec="seconds")));c.commit();sid=cur.lastrowid;c.close()
 return jsonify(ok=True,solicitud_id=sid)

@app.get("/api/solicitudes")
@auth
def requests():
 u=request.current_user;c=local()
 if u["rol"]=="ADMIN":rs=c.execute("SELECT * FROM solicitudes ORDER BY id DESC").fetchall()
 else:rs=c.execute("SELECT * FROM solicitudes WHERE codigo_almacen=? ORDER BY id DESC",(str(u["codigo_almacen"]),)).fetchall()
 a=[dict(x) for x in rs];c.close();return jsonify(ok=True,solicitudes=a)

init()
if __name__=="__main__":app.run(host="0.0.0.0",port=int(os.getenv("PORT","5000")),debug=False)
