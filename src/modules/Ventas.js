import { useState } from "react";
import { Indicador, Pestanas, Vacio } from "../components/Comunes.js";
import { procesarOperacion } from "../services/almacenamiento.js";
import { imagenDeCategoria } from "../data/datosIniciales.js";
import {
  calcularIVA,
  calcularTotales,
  dividir,
  esDeHoy,
  formatearFecha,
  formatearMoneda,
  multiplicar,
  sumar,
} from "../utils/calculos.js";

const PESTANAS = [
  { id: "nueva", etiqueta: "Punto de venta" },
  { id: "historial", etiqueta: "Historial" },
];

const METODOS_PAGO = ["Efectivo", "Tarjeta", "Transferencia"];

function Ventas({ productos, ventas, onRegistrar, notificar }) {
  const [pestana, setPestana] = useState("nueva");
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [descuento, setDescuento] = useState(0);
  const [cliente, setCliente] = useState("");
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0]);
  const [procesando, setProcesando] = useState(false);

  const { subtotal, montoDescuento, iva, total } = calcularTotales(carrito, descuento);

  const ventasHoy = ventas.filter(({ fecha }) => esDeHoy(fecha));
  const ingresosHoy = ventasHoy.reduce((acumulador, venta) => sumar(acumulador, venta.total), 0);
  const ingresosTotales = ventas.reduce((acumulador, venta) => sumar(acumulador, venta.total), 0);
  const ticketPromedio = dividir(ingresosTotales, ventas.length);

  const productosVisibles = productos.filter(({ nombre, categoria }) => {
    const texto = busqueda.trim().toLowerCase();
    return nombre.toLowerCase().includes(texto) || categoria.toLowerCase().includes(texto);
  });

  const stockDe = (productoId) => productos.find(({ id }) => id === productoId)?.stock ?? 0;

  const agregarAlCarrito = ({ id, nombre, precio, stock }) => {
    const enCarrito = carrito.find((item) => item.productoId === id);

    if (enCarrito && enCarrito.cantidad >= stock) {
      notificar(`Solo hay ${stock} unidad(es) de ${nombre}`, "error");
      return;
    }

    setCarrito((previo) =>
      enCarrito
        ? previo.map((item) => (item.productoId === id ? { ...item, cantidad: sumar(item.cantidad, 1) } : item))
        : [...previo, { productoId: id, nombre, precio, cantidad: 1 }],
    );
  };

  const cambiarCantidad = (productoId, cambio) => {
    const nuevaCantidad = sumar(carrito.find((item) => item.productoId === productoId).cantidad, cambio);

    if (nuevaCantidad > stockDe(productoId)) {
      notificar("No hay más unidades disponibles", "error");
      return;
    }

    setCarrito((previo) =>
      nuevaCantidad <= 0
        ? previo.filter((item) => item.productoId !== productoId)
        : previo.map((item) => (item.productoId === productoId ? { ...item, cantidad: nuevaCantidad } : item)),
    );
  };

  const cambiarDescuento = (valor) => {
    const numero = Number(valor);
    setDescuento(Number.isNaN(numero) ? 0 : Math.min(Math.max(numero, 0), 100));
  };

  const limpiarVenta = () => {
    setCarrito([]);
    setDescuento(0);
    setCliente("");
    setMetodoPago(METODOS_PAGO[0]);
  };

  const cobrar = async () => {
    const sinStock = carrito.some(({ productoId, cantidad }) => cantidad > stockDe(productoId));
    if (sinStock) {
      notificar("Algún producto ya no tiene stock suficiente", "error");
      return;
    }

    setProcesando(true);
    try {
      const operacion = await procesarOperacion({
        cliente: cliente.trim() || "Mostrador",
        metodoPago,
        descuento,
        partidas: carrito,
      });
      const { folio, total: importe } = onRegistrar(operacion);
      notificar(`Venta ${folio} cobrada por ${formatearMoneda(importe)}`);
      limpiarVenta();
    } catch (error) {
      notificar(error, "error");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="modulo">
      <div className="indicadores">
        <Indicador titulo="Ventas de hoy" valor={ventasHoy.length} detalle={`${ventas.length} en total`} />
        <Indicador titulo="Ingresos de hoy" valor={formatearMoneda(ingresosHoy)} detalle="IVA incluido" />
        <Indicador titulo="Ingresos totales" valor={formatearMoneda(ingresosTotales)} />
        <Indicador titulo="Ticket promedio" valor={formatearMoneda(ticketPromedio)} />
      </div>

      <Pestanas opciones={PESTANAS} activa={pestana} onCambiar={setPestana} />

      {pestana === "nueva" ? (
        <div className="dos-columnas">
          <section className="tarjeta">
            <input
              className="buscador"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar producto o categoría..."
            />

            {productosVisibles.length === 0 ? (
              <Vacio titulo="Sin resultados" />
            ) : (
              <div className="catalogo">
                {productosVisibles.map((producto) => {
                  const { id, nombre, categoria, precio, stock } = producto;
                  return (
                    <button key={id} className="producto" onClick={() => agregarAlCarrito(producto)} disabled={stock === 0}>
                      <img src={imagenDeCategoria(categoria)} alt="" loading="lazy" />
                      <span className="producto__info">
                        <span className="producto__categoria">{categoria}</span>
                        <strong className="producto__nombre">{nombre}</strong>
                        <span className="producto__precio">{formatearMoneda(sumar(precio, calcularIVA(precio)))}</span>
                        <small className={stock === 0 ? "texto-rojo" : "texto-suave"}>
                          {stock === 0 ? "Agotado" : `${stock} disponibles`}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="tarjeta">
            <h3 className="tarjeta__titulo">Venta actual</h3>

            {carrito.length === 0 ? (
              <Vacio titulo="Carrito vacío" texto="Toca un producto para agregarlo." />
            ) : (
              <ul className="lista-partidas">
                {carrito.map(({ productoId, nombre, precio, cantidad }) => (
                  <li key={productoId}>
                    <div>
                      <strong>{nombre}</strong>
                      <small className="texto-suave bloque">{formatearMoneda(precio)} c/u + IVA</small>
                    </div>
                    <div className="contador">
                      <button onClick={() => cambiarCantidad(productoId, -1)} aria-label="Quitar uno">−</button>
                      <span>{cantidad}</span>
                      <button onClick={() => cambiarCantidad(productoId, 1)} aria-label="Agregar uno">+</button>
                    </div>
                    <span className="nowrap">{formatearMoneda(multiplicar(precio, cantidad))}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="rejilla-formulario">
              <label className="campo">
                <span>Cliente</span>
                <input value={cliente} onChange={(evento) => setCliente(evento.target.value)} placeholder="Mostrador" />
              </label>
              <label className="campo">
                <span>Descuento (%)</span>
                <input type="number" min="0" max="100" value={descuento} onChange={(evento) => cambiarDescuento(evento.target.value)} />
              </label>
              <label className="campo campo--ancho">
                <span>Método de pago</span>
                <select value={metodoPago} onChange={(evento) => setMetodoPago(evento.target.value)}>
                  {METODOS_PAGO.map((metodo) => (
                    <option key={metodo}>{metodo}</option>
                  ))}
                </select>
              </label>
            </div>

            <dl className="totales">
              <div><dt>Subtotal</dt><dd>{formatearMoneda(subtotal)}</dd></div>
              {descuento > 0 && (
                <div className="totales__descuento"><dt>Descuento ({descuento}%)</dt><dd>-{formatearMoneda(montoDescuento)}</dd></div>
              )}
              <div><dt>IVA (16%)</dt><dd>{formatearMoneda(iva)}</dd></div>
              <div className="totales__final"><dt>Total a cobrar</dt><dd>{formatearMoneda(total)}</dd></div>
            </dl>

            <button className="boton boton--bloque" onClick={cobrar} disabled={procesando || carrito.length === 0}>
              {procesando ? "Procesando pago..." : `Cobrar ${formatearMoneda(total)}`}
            </button>
            {carrito.length > 0 && (
              <button className="enlace" onClick={limpiarVenta}>Cancelar venta</button>
            )}
          </section>
        </div>
      ) : (
        <section className="tarjeta">
          {ventas.length === 0 ? (
            <Vacio titulo="Aún no hay ventas" />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Productos</th>
                    <th>Pago</th>
                    <th className="derecha">Descuento</th>
                    <th className="derecha">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map(({ id, folio, fecha, cliente: nombreCliente, metodoPago: pago, partidas, descuento: porcentaje, subtotal: bruto, montoDescuento: ahorro, total: importe }) => (
                    <tr key={id}>
                      <td className="nowrap">{folio}</td>
                      <td className="nowrap">{formatearFecha(fecha)}</td>
                      <td>{nombreCliente}</td>
                      <td className="texto-suave">{partidas.map(({ nombre, cantidad }) => `${cantidad}× ${nombre}`).join(", ")}</td>
                      <td>{pago}</td>
                      <td className="derecha">
                        {porcentaje > 0 ? `${porcentaje}% (${formatearMoneda(ahorro)})` : "—"}
                      </td>
                      <td className="derecha">
                        <strong>{formatearMoneda(importe)}</strong>
                        {porcentaje > 0 && <small className="texto-suave bloque tachado">{formatearMoneda(sumar(bruto, calcularIVA(bruto)))}</small>}
                      </td>
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

export default Ventas;
