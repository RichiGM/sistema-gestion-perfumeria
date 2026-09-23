// Envía cada operación (venta, compra o cambio de producto) al servidor.
// Si no hay internet, el Service Worker la guarda en una cola y la manda
// sola cuando se restablece la conexión.

const URL_API = "/api/operaciones";

const crearId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const enviarOperacion = async (tipo, datos) => {
  const operacion = { id: crearId(), tipo, datos, fecha: new Date().toISOString() };

  try {
    const respuesta = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operacion),
    });
    const { pendiente = false } = await respuesta.json().catch(() => ({}));
    return { pendiente };
  } catch (error) {
    // Solo pasa si todavía no hay Service Worker controlando la página.
    return { pendiente: false, error: true };
  }
};

const mandarMensajeAlServiceWorker = async (mensaje) => {
  if (!("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.ready;
  registro.active?.postMessage(mensaje);
};

export const consultarPendientes = () => mandarMensajeAlServiceWorker({ tipo: "consultar" });

export const sincronizarAhora = () => mandarMensajeAlServiceWorker({ tipo: "sincronizar" });

export const escucharServiceWorker = (alRecibir) => {
  if (!("serviceWorker" in navigator)) return () => {};
  const manejar = (evento) => alRecibir(evento.data || {});
  navigator.serviceWorker.addEventListener("message", manejar);
  return () => navigator.serviceWorker.removeEventListener("message", manejar);
};
