import { useState } from "react";
import { Indicador, Pestanas, Vacio } from "../components/Comunes.js";
import { procesarOperacion } from "../services/almacenamiento.js";
import { calcularTotales, formatearFecha, formatearMoneda, multiplicar, sumar } from "../utils/calculos.js";

const PESTANAS = [
  { id: "nueva", etiqueta: "Nueva compra" },
  { id: "historial", etiqueta: "Historial" },
];

const obtenerProveedorFrecuente = (compras) => {
  const conteo = compras.reduce((acumulador, { proveedor }) => {
    acumulador[proveedor] = (acumulador[proveedor] || 0) + 1;
    return acumulador;
  }, {});
  const [nombre] = Object.entries(conteo).sort(([, a], [, b]) => b - a)[0] || ["—"];
  return nombre;
};

function Compras({ productos, proveedores, compras, onRegistrar, notificar }) {
  const [pestana, setPestana] = useState("nueva");
  const [proveedorId, setProveedorId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [costo, setCosto] = useState("");
  const [partidas, setPartidas] = useState([]);
  const [procesando, setProcesando] = useState(false);

  const { subtotal, iva, total } = calcularTotales(partidas);

  const totalInvertido = compras.reduce((acumulador, compra) => sumar(acumulador, compra.total), 0);
  const unidadesCompradas = compras.reduce(
    (acumulador, compra) =>
      sumar(acumulador, compra.partidas.reduce((suma, { cantidad }) => sumar(suma, cantidad), 0)),
    0,
  );

  const seleccionarProducto = (id) => {
    setProductoId(id);
    const producto = productos.find((item) => item.id === Number(id));
    setCosto(producto ? String(producto.costo) : "");
  };

  const agregarPartida = (evento) => {
    evento.preventDefault();
    const producto = productos.find((item) => item.id === Number(productoId));
    const cantidadNum = Math.floor(Number(cantidad));
    const costoNum = Number(costo);

    if (!producto) return notificar("Selecciona un producto", "error");
    if (!(cantidadNum > 0) || !(costoNum > 0)) return notificar("Cantidad y costo deben ser mayores a cero", "error");

    const { id, nombre } = producto;
    const yaExiste = partidas.some((partida) => partida.productoId === id);

    setPartidas((previas) =>
      yaExiste
        ? previas.map((partida) =>
            partida.productoId === id
              ? { ...partida, cantidad: sumar(partida.cantidad, cantidadNum), precio: costoNum }
              : partida,
          )
        : [...previas, { productoId: id, nombre, precio: costoNum, cantidad: cantidadNum }],
    );
    setProductoId("");
    setCantidad("1");
    setCosto("");
  };

  const quitarPartida = (id) => {
    setPartidas((previas) => previas.filter((partida) => partida.productoId !== id));
  };

  const registrarCompra = () => {
    const proveedor = proveedores.find(({ id }) => id === Number(proveedorId));
    if (!proveedor) return notificar("Selecciona un proveedor", "error");

    setProcesando(true);
    procesarOperacion({ proveedorId: proveedor.id, proveedor: proveedor.nombre, partidas })
      .then((operacion) => {
        const { folio } = onRegistrar(operacion);
        notificar(`Compra ${folio} registrada. El inventario se actualizó.`);
        setPartidas([]);
        setProveedorId("");
      })
      .catch((error) => notificar(error, "error"))
      .finally(() => setProcesando(false));
  };

  return (
    <div className="modulo">
      <div className="indicadores">
        <Indicador titulo="Compras registradas" valor={compras.length} />
        <Indicador titulo="Total invertido" valor={formatearMoneda(totalInvertido)} detalle="IVA incluido" />
        <Indicador titulo="Unidades compradas" valor={unidadesCompradas} />
        <Indicador titulo="Proveedor frecuente" valor={obtenerProveedorFrecuente(compras)} />
      </div>

      <Pestanas opciones={PESTANAS} activa={pestana} onCambiar={setPestana} />

      {pestana === "nueva" ? (
        <div className="dos-columnas">
          <section className="tarjeta">
            <h3 className="tarjeta__titulo">Datos de la compra</h3>
            <label className="campo">
              <span>Proveedor</span>
              <select value={proveedorId} onChange={(evento) => setProveedorId(evento.target.value)}>
                <option value="">Selecciona un proveedor</option>
                {proveedores.map(({ id, nombre }) => (
                  <option key={id} value={id}>{nombre}</option>
                ))}
              </select>
            </label>

            <form className="formulario-partida" onSubmit={agregarPartida}>
              <label className="campo campo--ancho">
                <span>Producto</span>
                <select value={productoId} onChange={(evento) => seleccionarProducto(evento.target.value)}>
                  <option value="">Selecciona un producto</option>
                  {productos.map(({ id, nombre, stock }) => (
                    <option key={id} value={id}>{nombre} (stock: {stock})</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span>Cantidad</span>
                <input type="number" min="1" value={cantidad} onChange={(evento) => setCantidad(evento.target.value)} />
              </label>
              <label className="campo">
                <span>Costo unitario</span>
                <input type="number" min="0" step="0.01" value={costo} onChange={(evento) => setCosto(evento.target.value)} placeholder="0.00" />
              </label>
              <button type="submit" className="boton boton--secundario">
                Agregar
              </button>
            </form>
          </section>

          <section className="tarjeta">
            <h3 className="tarjeta__titulo">Orden de compra</h3>
            {partidas.length === 0 ? (
              <Vacio titulo="Sin productos" texto="Agrega productos para armar la orden." />
            ) : (
              <ul className="lista-partidas">
                {partidas.map(({ productoId: id, nombre, cantidad: unidades, precio }) => (
                  <li key={id}>
                    <div>
                      <strong>{nombre}</strong>
                      <small className="texto-suave bloque">{unidades} × {formatearMoneda(precio)}</small>
                    </div>
                    <span>{formatearMoneda(multiplicar(unidades, precio))}</span>
                    <button className="boton-chico boton-chico--peligro" onClick={() => quitarPartida(id)}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <dl className="totales">
              <div><dt>Subtotal</dt><dd>{formatearMoneda(subtotal)}</dd></div>
              <div><dt>IVA (16%)</dt><dd>{formatearMoneda(iva)}</dd></div>
              <div className="totales__final"><dt>Total</dt><dd>{formatearMoneda(total)}</dd></div>
            </dl>

            <button
              className="boton boton--bloque"
              onClick={registrarCompra}
              disabled={procesando || partidas.length === 0}
            >
              {procesando ? "Registrando compra..." : "Registrar compra"}
            </button>
          </section>
        </div>
      ) : (
        <section className="tarjeta">
          {compras.length === 0 ? (
            <Vacio titulo="Aún no hay compras" />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Productos</th>
                    <th className="derecha">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map(({ id, folio, fecha, proveedor, partidas: detalle, total: importe }) => (
                    <tr key={id}>
                      <td className="nowrap">{folio}</td>
                      <td className="nowrap">{formatearFecha(fecha)}</td>
                      <td>{proveedor}</td>
                      <td className="texto-suave">{detalle.map(({ nombre, cantidad: unidades }) => `${unidades}× ${nombre}`).join(", ")}</td>
                      <td className="derecha"><strong>{formatearMoneda(importe)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Compras;
