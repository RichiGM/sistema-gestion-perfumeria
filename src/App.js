import { useEffect, useState } from "react";
import "./App.css";
import Login from "./components/Login.js";
import Encabezado from "./components/Encabezado.js";
import { Notificaciones } from "./components/Comunes.js";
import Inventario from "./modules/Inventario.js";
import Compras from "./modules/Compras.js";
import Ventas from "./modules/Ventas.js";
import { comprasIniciales, productosIniciales, proveedores, ventasIniciales } from "./data/datosIniciales.js";
import { borrarDatos, useEstadoPersistente } from "./services/almacenamiento.js";
import { consultarPendientes, enviarOperacion, escucharServiceWorker, sincronizarAhora } from "./services/sincronizacion.js";
import { calcularTotales, generarFolio, restar, sumar } from "./utils/calculos.js";

const MODULOS = [
  { id: "inventario", titulo: "Inventario", descripcion: "Existencias, precios y alertas de stock" },
  { id: "compras", titulo: "Compras", descripcion: "Órdenes de compra a proveedores" },
  { id: "ventas", titulo: "Ventas", descripcion: "Punto de venta e historial de ventas" },
];

const CLAVES_DATOS = ["productos", "compras", "ventas"];

const siguienteId = (lista) => lista.reduce((mayor, { id }) => Math.max(mayor, id), 0) + 1;

function Aplicacion() {
  const [sesion, setSesion] = useEstadoPersistente("sesion", null);
  const [productos, setProductos] = useEstadoPersistente("productos", productosIniciales);
  const [compras, setCompras] = useEstadoPersistente("compras", comprasIniciales);
  const [ventas, setVentas] = useEstadoPersistente("ventas", ventasIniciales);
  const [moduloActivo, setModuloActivo] = useState("inventario");
  const [notificaciones, setNotificaciones] = useState([]);
  const [eventoInstalacion, setEventoInstalacion] = useState(null);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const guardarEvento = (evento) => {
      evento.preventDefault();
      setEventoInstalacion(evento);
    };
    window.addEventListener("beforeinstallprompt", guardarEvento);
    return () => window.removeEventListener("beforeinstallprompt", guardarEvento);
  }, []);

  // Mensajes del Service Worker: cuántas operaciones faltan por enviar y
  // aviso cuando ya se mandaron las que se guardaron sin conexión.
  useEffect(() => {
    const dejarDeEscuchar = escucharServiceWorker(({ tipo, cantidad, enviadas }) => {
      if (tipo === "pendientes") setPendientes(cantidad);
      if (tipo === "sincronizado") {
        setPendientes(cantidad);
        notificar(`Conexión restablecida: se enviaron ${enviadas} operación(es) pendientes`);
      }
    });

    const alConectarse = () => sincronizarAhora();
    window.addEventListener("online", alConectarse);

    consultarPendientes();
    if (navigator.onLine) sincronizarAhora();

    return () => {
      dejarDeEscuchar();
      window.removeEventListener("online", alConectarse);
    };
  }, []);

  const cerrarNotificacion = (id) => {
    setNotificaciones((previas) => previas.filter((notificacion) => notificacion.id !== id));
  };

  const notificar = (mensaje, tipo = "exito") => {
    const id = Date.now() + Math.random();
    setNotificaciones((previas) => [...previas, { id, mensaje, tipo }]);
    setTimeout(() => cerrarNotificacion(id), 3500);
  };

  // Manda la operación al servidor. Si no hay internet queda en la cola del
  // Service Worker y se envía sola al volver la conexión.
  const respaldar = (tipo, datos) => {
    enviarOperacion(tipo, datos).then(({ pendiente, error }) => {
      if (pendiente) notificar("Sin conexión: se guardó y se enviará al volver el internet", "aviso");
      if (error) notificar("No se pudo enviar al servidor", "error");
    });
  };

  const iniciarSesion = (datosUsuario) => {
    setSesion(datosUsuario);
    setModuloActivo("inventario");
    notificar(`Bienvenido(a), ${datosUsuario.nombre}`);
  };

  const cerrarSesion = () => setSesion(null);

  const guardarProducto = (producto) => {
    if (producto.id) {
      setProductos((previos) => previos.map((item) => (item.id === producto.id ? producto : item)));
      respaldar("producto-editado", producto);
      notificar(`Se actualizó "${producto.nombre}"`);
      return;
    }
    const id = siguienteId(productos);
    const codigo = producto.codigo.trim() || `PRD-${String(id).padStart(3, "0")}`;
    setProductos((previos) => [...previos, { ...producto, id, codigo }]);
    respaldar("producto-nuevo", { ...producto, id, codigo });
    notificar(`Se agregó "${producto.nombre}" al inventario`);
  };

  const eliminarProducto = (id) => {
    setProductos((previos) => previos.filter((producto) => producto.id !== id));
    respaldar("producto-eliminado", { id });
    notificar("Producto eliminado");
  };

  const registrarCompra = ({ proveedorId, proveedor, partidas }) => {
    const numero = siguienteId(compras);
    const compra = {
      id: numero,
      folio: generarFolio("C", numero),
      fecha: new Date().toISOString(),
      proveedorId,
      proveedor,
      usuario: sesion.nombre,
      partidas,
      ...calcularTotales(partidas),
    };

    setCompras((previas) => [compra, ...previas]);
    respaldar("compra", compra);
    setProductos((previos) =>
      previos.map((producto) => {
        const partida = partidas.find(({ productoId }) => productoId === producto.id);
        return partida
          ? { ...producto, stock: sumar(producto.stock, partida.cantidad), costo: partida.precio }
          : producto;
      }),
    );
    return compra;
  };

  const registrarVenta = ({ cliente, metodoPago, descuento, partidas }) => {
    const numero = siguienteId(ventas);
    const venta = {
      id: numero,
      folio: generarFolio("V", numero),
      fecha: new Date().toISOString(),
      cliente,
      metodoPago,
      descuento,
      usuario: sesion.nombre,
      partidas,
      ...calcularTotales(partidas, descuento),
    };

    setVentas((previas) => [venta, ...previas]);
    respaldar("venta", venta);
    setProductos((previos) =>
      previos.map((producto) => {
        const partida = partidas.find(({ productoId }) => productoId === producto.id);
        return partida ? { ...producto, stock: restar(producto.stock, partida.cantidad) } : producto;
      }),
    );
    return venta;
  };

  const restablecerDatos = () => {
    if (!window.confirm("Se borrarán los cambios y se cargarán los datos de ejemplo. ¿Continuar?")) return;
    borrarDatos(CLAVES_DATOS);
    setProductos(productosIniciales);
    setCompras(comprasIniciales);
    setVentas(ventasIniciales);
    notificar("Datos de ejemplo restablecidos");
  };

  const instalarAplicacion = async () => {
    eventoInstalacion.prompt();
    await eventoInstalacion.userChoice;
    setEventoInstalacion(null);
  };

  if (!sesion) {
    return (
      <>
        <Login onIngresar={iniciarSesion} />
        <Notificaciones lista={notificaciones} onCerrar={cerrarNotificacion} />
      </>
    );
  }

  const modulo = MODULOS.find(({ id }) => id === moduloActivo);

  return (
    <div className="aplicacion">
      <Encabezado
        modulos={MODULOS}
        moduloActivo={moduloActivo}
        onCambiar={setModuloActivo}
        sesion={sesion}
        onCerrarSesion={cerrarSesion}
        pendientes={pendientes}
      />

      <main className="contenido">
        <div className="titulo-modulo">
          <h1>{modulo.titulo}</h1>
          <p className="texto-suave">{modulo.descripcion}</p>
        </div>

        {moduloActivo === "inventario" && (
          <Inventario productos={productos} onGuardar={guardarProducto} onEliminar={eliminarProducto} />
        )}
        {moduloActivo === "compras" && (
          <Compras
            productos={productos}
            proveedores={proveedores}
            compras={compras}
            onRegistrar={registrarCompra}
            notificar={notificar}
          />
        )}
        {moduloActivo === "ventas" && (
          <Ventas productos={productos} ventas={ventas} onRegistrar={registrarVenta} notificar={notificar} />
        )}

        <footer className="pie">
          {eventoInstalacion && (
            <button className="enlace" onClick={instalarAplicacion}>Instalar aplicación</button>
          )}
          <button className="enlace" onClick={restablecerDatos}>Restablecer datos de ejemplo</button>
        </footer>
      </main>

      <Notificaciones lista={notificaciones} onCerrar={cerrarNotificacion} />
    </div>
  );
}

export default Aplicacion;
