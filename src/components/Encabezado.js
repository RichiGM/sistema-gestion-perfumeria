import { useEffect, useState } from "react";

function Encabezado({ modulos, moduloActivo, onCambiar, sesion, onCerrarSesion, pendientes }) {
  const [ahora, setAhora] = useState(new Date());
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);
    window.addEventListener("online", conectado);
    window.addEventListener("offline", desconectado);
    return () => {
      window.removeEventListener("online", conectado);
      window.removeEventListener("offline", desconectado);
    };
  }, []);

  const { nombre, rol } = sesion;

  return (
    <header>
      <div className="encabezado">
        <div className="encabezado__fila">
          <div className="marca">
            <img src="/icons/icon-192.svg" alt="" />
            Aroma
          </div>

          <nav className="menu">
            {modulos.map(({ id, titulo }) => (
              <button key={id} className={moduloActivo === id ? "menu--activo" : ""} onClick={() => onCambiar(id)}>
                {titulo}
              </button>
            ))}
          </nav>

          <div className="usuario">
            <span className="usuario__nombre">
              {nombre} ({rol})
            </span>
            <button onClick={onCerrarSesion}>Salir</button>
          </div>
        </div>
      </div>

      <div className="barra-estado">
        <div className="encabezado__fila">
          <span className={enLinea ? "conexion" : "conexion conexion--sin"}>
            {enLinea ? "● En línea" : "● Sin conexión"}
          </span>
          {pendientes > 0 && (
            <span className="pendientes">
              {pendientes} operación(es) por enviar {enLinea ? "(enviando...)" : "cuando vuelva el internet"}
            </span>
          )}
          <span className="barra-estado__fecha">
            {ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {ahora.toLocaleTimeString("es-MX")}
          </span>
        </div>
      </div>
    </header>
  );
}

export default Encabezado;
