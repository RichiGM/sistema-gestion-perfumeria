import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

// Servidor de prueba: recibe las operaciones que manda la app (o el Service
// Worker cuando regresa la conexión) y las guarda en servidor-operaciones.json.
// Funciona con "npm run dev" y con "npm run preview".
const ARCHIVO = 'servidor-operaciones.json'

function servidorDePrueba() {
  const leer = () => (fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) : [])

  const manejar = (req, res, next) => {
    if (!req.url.startsWith('/api/operaciones')) return next()

    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'GET') {
      res.end(JSON.stringify(leer(), null, 2))
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end('{}')
      return
    }

    let cuerpo = ''
    req.on('data', (parte) => (cuerpo += parte))
    req.on('end', () => {
      try {
        const operacion = JSON.parse(cuerpo)
        const operaciones = leer()
        // Si la misma operación llega dos veces, solo se guarda una.
        if (!operaciones.some(({ id }) => id === operacion.id)) {
          operaciones.push({ ...operacion, recibida: new Date().toISOString() })
          fs.writeFileSync(ARCHIVO, JSON.stringify(operaciones, null, 2))
          console.log(`[servidor] operación recibida: ${operacion.tipo}`)
        }
        res.statusCode = 201
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'JSON inválido' }))
      }
    })
  }

  return {
    name: 'servidor-de-prueba',
    configureServer(server) {
      server.middlewares.use(manejar)
    },
    configurePreviewServer(server) {
      server.middlewares.use(manejar)
    },
  }
}

export default defineConfig({
  plugins: [react(), servidorDePrueba()],
  server: {
    watch: { ignored: [`**/${ARCHIVO}`] },
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
})
