const CACHE_NAME = "aroma-gestion-pwa-v2";
const RECURSOS = [
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
  "/img/portada.jpg",
  "/img/perfumes.jpg",
  "/img/cremas.jpg",
  "/img/maquillaje.jpg",
  "/img/cuidado-capilar.jpg",
];

const URL_API = "/api/operaciones";
const ETIQUETA_SYNC = "sincronizar-operaciones";

// ---------------------------------------------------------------------------
// Cola de operaciones pendientes (IndexedDB).
// Aquí se guardan las ventas, compras y cambios de productos que se hicieron
// sin conexión, para enviarlas al servidor cuando regrese el internet.
// ---------------------------------------------------------------------------

const abrirBaseDatos = () =>
  new Promise((resolve, reject) => {
    const solicitud = indexedDB.open("aroma-cola", 1);
    solicitud.onupgradeneeded = () => {
      solicitud.result.createObjectStore("pendientes", { keyPath: "clave", autoIncrement: true });
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });

const usarAlmacen = async (modo, accion) => {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction("pendientes", modo);
    const solicitud = accion(transaccion.objectStore("pendientes"));
    transaccion.oncomplete = () => resolve(solicitud.result);
    transaccion.onerror = () => reject(transaccion.error);
  });
};

const agregarPendiente = (operacion) => usarAlmacen("readwrite", (almacen) => almacen.add(operacion));
const leerPendientes = () => usarAlmacen("readonly", (almacen) => almacen.getAll());
const borrarPendiente = (clave) => usarAlmacen("readwrite", (almacen) => almacen.delete(clave));

const avisarPaginas = async (mensaje) => {
  const paginas = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  paginas.forEach((pagina) => pagina.postMessage(mensaje));
};

const avisarPendientes = async () => {
  const pendientes = await leerPendientes();
  await avisarPaginas({ tipo: "pendientes", cantidad: pendientes.length });
};

const enviarOperacion = (operacion) =>
  fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(operacion),
  });

let sincronizando = false;

// Envía en orden todas las operaciones guardadas. Si alguna falla se detiene
// y lanza el error para que el navegador vuelva a intentar el "sync" después.
const sincronizarPendientes = async () => {
  if (sincronizando) return;
  sincronizando = true;
  let enviadas = 0;

  try {
    const pendientes = await leerPendientes();
    for (const { clave, ...operacion } of pendientes) {
      const respuesta = await enviarOperacion(operacion);
      if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
      await borrarPendiente(clave);
      enviadas++;
    }
  } finally {
    sincronizando = false;
    const restantes = await leerPendientes();
    if (enviadas > 0) {
      await avisarPaginas({ tipo: "sincronizado", enviadas, cantidad: restantes.length });
    } else {
      await avisarPaginas({ tipo: "pendientes", cantidad: restantes.length });
    }
  }
};

const programarSincronizacion = async () => {
  try {
    if ("sync" in self.registration) {
      await self.registration.sync.register(ETIQUETA_SYNC);
    }
  } catch (error) {
    // Si el navegador no soporta Background Sync, la página nos avisa con
    // un mensaje "sincronizar" cuando detecta el evento "online".
  }
};

// POST /api/operaciones: se intenta enviar; si no hay internet se guarda en la
// cola y se responde 202 para que la app siga funcionando normalmente.
const manejarEnvioOperacion = async (request) => {
  const operacion = await request.clone().json();
  try {
    const respuesta = await fetch(request);
    if (respuesta.status >= 500) throw new Error("Servidor no disponible");
    return respuesta;
  } catch (error) {
    await agregarPendiente(operacion);
    await programarSincronizacion();
    await avisarPendientes();
    return new Response(JSON.stringify({ pendiente: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

async function guardarEnCache(cache, rutas) {
  await Promise.all(
    rutas.map(async (ruta) => {
      try {
        const respuesta = await fetch(ruta);
        if (respuesta.ok) await cache.put(ruta, respuesta);
      } catch (error) {}
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const respuesta = await fetch("/");
        const html = await respuesta.text();
        const respuestaLimpia = new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
        await cache.put("/", respuestaLimpia);

        const rutasAssets = Array.from(
          html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
        ).map((coincidencia) => coincidencia[1]);

        await guardarEnCache(cache, [...RECURSOS, ...rutasAssets]);
      } catch (error) {}
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre !== CACHE_NAME)
            .map((nombre) => caches.delete(nombre)),
        ),
      ),
  );
  self.clients.claim();
});

// Background Sync: el navegador lo dispara cuando vuelve la conexión.
self.addEventListener("sync", (event) => {
  if (event.tag === ETIQUETA_SYNC) {
    event.waitUntil(sincronizarPendientes());
  }
});

// Mensajes desde la página: "consultar" (cuántas hay pendientes) y
// "sincronizar" (respaldo para navegadores sin Background Sync).
self.addEventListener("message", (event) => {
  const { tipo } = event.data || {};
  if (tipo === "consultar") {
    event.waitUntil(avisarPendientes());
  }
  if (tipo === "sincronizar") {
    event.waitUntil(sincronizarPendientes().catch(() => {}));
  }
});

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

const esRecursoEstatico = (url) =>
  url.pathname.startsWith("/assets/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/img/");

const guardarRespuesta = (request, respuestaRed) => {
  if (respuestaRed.ok) {
    const copia = respuestaRed.clone();
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.put(request, copia))
      .catch(() => {});
  }
  return respuestaRed;
};

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === "POST" && url.pathname === URL_API) {
    event.respondWith(manejarEnvioOperacion(event.request));
    return;
  }

  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match("/", { ignoreVary: true });
      }),
    );
    return;
  }

  if (esRecursoEstatico(url)) {
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then((respuestaCache) => {
        if (respuestaCache) return respuestaCache;
        return fetch(event.request)
          .then((respuestaRed) => guardarRespuesta(event.request, respuestaRed))
          .catch(() => Response.error());
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => guardarRespuesta(event.request, respuestaRed))
      .catch(async () => {
        const respuestaCache = await caches.match(event.request, { ignoreVary: true });
        return respuestaCache || Response.error();
      }),
  );
});
