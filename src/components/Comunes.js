export function Indicador({ titulo, valor, detalle }) {
  return (
    <div className="indicador">
      <span className="indicador__titulo">{titulo}</span>
      <strong className="indicador__valor">{valor}</strong>
      {detalle && <small className="indicador__detalle">{detalle}</small>}
    </div>
  );
}

export function Pestanas({ opciones, activa, onCambiar }) {
  return (
    <div className="pestanas">
      {opciones.map(({ id, etiqueta }) => (
        <button key={id} className={activa === id ? "pestanas--activa" : ""} onClick={() => onCambiar(id)}>
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

export function Vacio({ titulo, texto }) {
  return (
    <div className="vacio">
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
    </div>
  );
}

export function Notificaciones({ lista, onCerrar }) {
  return (
    <div className="notificaciones">
      {lista.map(({ id, mensaje, tipo }) => (
        <div key={id} className={`notificacion notificacion--${tipo}`}>
          <span>{mensaje}</span>
          <button className="cerrar" onClick={() => onCerrar(id)} aria-label="Cerrar">×</button>
        </div>
      ))}
    </div>
  );
}
