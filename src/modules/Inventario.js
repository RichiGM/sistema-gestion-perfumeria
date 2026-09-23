import { useState } from "react";
import { Indicador, Vacio } from "../components/Comunes.js";
import { calcularMargen, formatearMoneda, multiplicar, sumar } from "../utils/calculos.js";

const PRODUCTO_VACIO = {
  codigo: "",
  nombre: "",
  categoria: "",
  costo: "",
  precio: "",
  stock: "",
  stockMinimo: "5",
};

const obtenerEstadoStock = ({ stock, stockMinimo }) => {
  if (stock === 0) return { etiqueta: "Agotado", clase: "etiqueta--rojo" };
  if (stock <= stockMinimo) return { etiqueta: "Stock bajo", clase: "etiqueta--amarillo" };
  return { etiqueta: "Disponible", clase: "etiqueta--verde" };
};

function FormularioProducto({ producto, categorias, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(() =>
    producto.id ? { ...producto } : { ...PRODUCTO_VACIO },
  );
  const [error, setError] = useState("");

  const actualizar = ({ target: { name, value } }) => {
    setDatos((previos) => ({ ...previos, [name]: value }));
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    const { nombre, categoria, costo, precio, stock, stockMinimo } = datos;
    const numeros = [costo, precio, stock, stockMinimo].map(Number);

    if (!nombre.trim() || !categoria.trim()) {
      setError("El nombre y la categoría son obligatorios");
      return;
    }
    if (numeros.some((numero) => Number.isNaN(numero) || numero < 0) || [costo, precio, stock].some((valor) => valor === "")) {
      setError("Revisa que costo, precio y stock sean números válidos");
      return;
    }
    if (Number(precio) <= Number(costo)) {
      setError("El precio de venta debe ser mayor al costo");
      return;
    }

    const [costoNum, precioNum, stockNum, minimoNum] = numeros;
    onGuardar({
      ...datos,
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      costo: costoNum,
      precio: precioNum,
      stock: Math.floor(stockNum),
      stockMinimo: Math.floor(minimoNum),
    });
  };

  return (
    <div className="modal" onClick={onCancelar}>
      <form className="modal__caja" onClick={(evento) => evento.stopPropagation()} onSubmit={manejarEnvio}>
        <div className="modal__cabecera">
          <h3>{producto.id ? "Editar producto" : "Nuevo producto"}</h3>
          <button type="button" className="cerrar" onClick={onCancelar} aria-label="Cerrar">×</button>
        </div>

        <div className="rejilla-formulario">
          <label className="campo campo--ancho">
            <span>Nombre del producto</span>
            <input name="nombre" value={datos.nombre} onChange={actualizar} placeholder="Ej. Perfume Élégance 100 ml" autoFocus />
          </label>
          <label className="campo">
            <span>Código</span>
            <input name="codigo" value={datos.codigo} onChange={actualizar} placeholder="Se genera si se deja vacío" />
          </label>
          <label className="campo">
            <span>Categoría</span>
            <input name="categoria" value={datos.categoria} onChange={actualizar} list="lista-categorias" placeholder="Ej. Perfumes" />
            <datalist id="lista-categorias">
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria} />
              ))}
            </datalist>
          </label>
          <label className="campo">
            <span>Costo (sin IVA)</span>
            <input name="costo" type="number" min="0" step="0.01" value={datos.costo} onChange={actualizar} />
          </label>
          <label className="campo">
            <span>Precio de venta (sin IVA)</span>
            <input name="precio" type="number" min="0" step="0.01" value={datos.precio} onChange={actualizar} />
          </label>
          <label className="campo">
            <span>Stock actual</span>
            <input name="stock" type="number" min="0" value={datos.stock} onChange={actualizar} />
          </label>
          <label className="campo">
            <span>Stock mínimo</span>
            <input name="stockMinimo" type="number" min="0" value={datos.stockMinimo} onChange={actualizar} />
          </label>
        </div>

        {error && <div className="aviso aviso--error">{error}</div>}

        <div className="modal__acciones">
          <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="boton">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function Inventario({ productos, onGuardar, onEliminar }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [productoEditando, setProductoEditando] = useState(null);

  const categorias = [...new Set(productos.map(({ categoria }) => categoria))];

  const productosFiltrados = productos.filter(({ nombre, codigo, categoria }) => {
    const texto = busqueda.trim().toLowerCase();
    const coincideTexto = nombre.toLowerCase().includes(texto) || codigo.toLowerCase().includes(texto);
    const coincideCategoria = categoriaFiltro === "Todas" || categoria === categoriaFiltro;
    return coincideTexto && coincideCategoria;
  });

  const totalUnidades = productos.reduce((acumulador, { stock }) => sumar(acumulador, stock), 0);
  const valorInventario = productos.reduce(
    (acumulador, { costo, stock }) => sumar(acumulador, multiplicar(costo, stock)),
    0,
  );
  const productosStockBajo = productos.filter(({ stock, stockMinimo }) => stock <= stockMinimo);
  const hayAgotados = productos.some(({ stock }) => stock === 0);

  const guardar = (producto) => {
    onGuardar(producto);
    setProductoEditando(null);
  };

  const eliminar = ({ id, nombre }) => {
    if (window.confirm(`¿Eliminar "${nombre}" del inventario?`)) onEliminar(id);
  };

  return (
    <div className="modulo">
      <div className="indicadores">
        <Indicador titulo="Productos" valor={productos.length} detalle={`${categorias.length} categorías`} />
        <Indicador titulo="Unidades en stock" valor={totalUnidades} />
        <Indicador titulo="Valor del inventario" valor={formatearMoneda(valorInventario)} detalle="A precio de costo" />
        <Indicador
          titulo="Alertas de stock"
          valor={productosStockBajo.length}
          detalle={hayAgotados ? "Hay productos agotados" : "Sin productos agotados"}
        />
      </div>

      {productosStockBajo.length > 0 && (
        <div className="aviso aviso--amarillo">
          <strong>Reabastecer pronto: </strong>
          {productosStockBajo.map(({ nombre, stock }) => `${nombre} (${stock})`).join(", ")}
        </div>
      )}

      <section className="tarjeta">
        <div className="barra-herramientas">
          <input
            className="buscador"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre o código..."
          />
          <select className="selector" value={categoriaFiltro} onChange={(evento) => setCategoriaFiltro(evento.target.value)}>
            {["Todas", ...categorias].map((categoria) => (
              <option key={categoria}>{categoria}</option>
            ))}
          </select>
          <button className="boton" onClick={() => setProductoEditando({})}>
            + Nuevo producto
          </button>
        </div>

        {productosFiltrados.length === 0 ? (
          <Vacio titulo="Sin resultados" texto="No hay productos que coincidan con la búsqueda." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="derecha">Costo</th>
                  <th className="derecha">Precio</th>
                  <th className="derecha">Margen</th>
                  <th className="centro">Stock</th>
                  <th>Estado</th>
                  <th className="derecha">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((producto) => {
                  const { id, codigo, nombre, categoria, costo, precio, stock, stockMinimo } = producto;
                  const { etiqueta, clase } = obtenerEstadoStock(producto);
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{nombre}</strong>
                        <small className="texto-suave bloque">{codigo}</small>
                      </td>
                      <td>{categoria}</td>
                      <td className="derecha">{formatearMoneda(costo)}</td>
                      <td className="derecha">{formatearMoneda(precio)}</td>
                      <td className="derecha">{calcularMargen(precio, costo).toFixed(0)}%</td>
                      <td className="centro">
                        <strong>{stock}</strong>
                        <small className="texto-suave bloque">mín. {stockMinimo}</small>
                      </td>
                      <td><span className={`etiqueta ${clase}`}>{etiqueta}</span></td>
                      <td className="derecha nowrap">
                        <button className="boton-chico" onClick={() => setProductoEditando(producto)}>
                          Editar
                        </button>
                        <button className="boton-chico boton-chico--peligro" onClick={() => eliminar(producto)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {productoEditando && (
        <FormularioProducto
          producto={productoEditando}
          categorias={categorias}
          onGuardar={guardar}
          onCancelar={() => setProductoEditando(null)}
        />
      )}
    </div>
  );
}

export default Inventario;
