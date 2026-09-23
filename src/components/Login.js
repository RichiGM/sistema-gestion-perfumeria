import { useEffect, useRef, useState } from "react";
import { verificarUsuario } from "../services/autenticacion.js";

const MAX_INTENTOS = 3;
const SEGUNDOS_BLOQUEO = 10;

const CUENTAS_DEMO = [
  { usuario: "admin", password: "admin123", rol: "Administrador" },
  { usuario: "vendedor", password: "venta123", rol: "Vendedora" },
];

function Login({ onIngresar }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState("");
  const [intentos, setIntentos] = useState(0);
  const [tiempoBloqueo, setTiempoBloqueo] = useState(0);
  const intervaloRef = useRef(null);

  useEffect(() => () => clearInterval(intervaloRef.current), []);

  const bloqueado = tiempoBloqueo > 0;

  const iniciarBloqueo = () => {
    let tiempo = SEGUNDOS_BLOQUEO;
    setTiempoBloqueo(tiempo);

    intervaloRef.current = setInterval(() => {
      tiempo--;
      setTiempoBloqueo(tiempo);

      if (tiempo <= 0) {
        clearInterval(intervaloRef.current);
        setIntentos(0);
        setError("");
      }
    }, 1000);
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    if (bloqueado || verificando) return;

    if (!usuario.trim() || !password) {
      setError("Escribe tu usuario y contraseña");
      return;
    }

    setVerificando(true);
    setError("");

    verificarUsuario(usuario, password)
      .then((datosUsuario) => {
        onIngresar(datosUsuario);
      })
      .catch((mensaje) => {
        const nuevosIntentos = intentos + 1;
        setIntentos(nuevosIntentos);
        setPassword("");

        if (nuevosIntentos >= MAX_INTENTOS) {
          setError("Demasiados intentos fallidos.");
          iniciarBloqueo();
        } else {
          setError(`${mensaje}. Te quedan ${MAX_INTENTOS - nuevosIntentos} intento(s).`);
        }
      })
      .finally(() => {
        setVerificando(false);
      });
  };

  const usarCuentaDemo = ({ usuario, password }) => {
    if (bloqueado) return;
    setUsuario(usuario);
    setPassword(password);
    setError("");
  };

  return (
    <div className="login">
      <div className="login__caja">
        <img src="/img/portada.jpg" alt="Frascos de perfume" className="login__foto" />

        <form className="login__formulario" onSubmit={manejarEnvio}>
          <div>
            <h1 className="login__titulo">Perfumería Aroma</h1>
            <p className="texto-suave">Sistema de compras, inventario y ventas</p>
          </div>

          <label className="campo">
            Usuario
            <input
              type="text"
              value={usuario}
              onChange={(evento) => setUsuario(evento.target.value)}
              autoComplete="username"
              disabled={bloqueado}
            />
          </label>

          <label className="campo">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              autoComplete="current-password"
              disabled={bloqueado}
            />
          </label>

          {error && (
            <div className="aviso aviso--error">
              {error}
              {bloqueado && ` Intenta de nuevo en ${tiempoBloqueo} s.`}
            </div>
          )}

          <button type="submit" className="boton boton--bloque" disabled={verificando || bloqueado}>
            {verificando ? "Verificando..." : bloqueado ? `Bloqueado (${tiempoBloqueo})` : "Entrar"}
          </button>

          <div className="login__demo">
            <span className="texto-suave">Usuarios de prueba (clic para llenar):</span>
            <table>
              <tbody>
                {CUENTAS_DEMO.map((cuenta) => (
                  <tr key={cuenta.usuario}>
                    <td>
                      <button type="button" className="enlace" onClick={() => usarCuentaDemo(cuenta)}>
                        {cuenta.usuario}
                      </button>
                    </td>
                    <td>{cuenta.password}</td>
                    <td className="texto-suave">{cuenta.rol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
