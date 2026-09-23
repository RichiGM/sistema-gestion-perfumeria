import { calcularTotales, generarFolio } from "../utils/calculos.js";

export const usuarios = [
  { id: 1, usuario: "admin", password: "admin123", nombre: "Ricardo Garnica", rol: "Administrador" },
  { id: 2, usuario: "vendedor", password: "venta123", nombre: "Laura Méndez", rol: "Vendedora" },
];

export const proveedores = [
  { id: 1, nombre: "Fragancias del Norte", contacto: "ventas@fragnorte.mx" },
  { id: 2, nombre: "Distribuidora Belleza Total", contacto: "pedidos@bellezatotal.mx" },
  { id: 3, nombre: "Cosméticos Luna", contacto: "contacto@cosmeticosluna.mx" },
];

export const productosIniciales = [
  { id: 1, codigo: "PRF-001", nombre: "Perfume Élégance 100 ml", categoria: "Perfumes", precio: 850, costo: 520, stock: 14, stockMinimo: 5 },
  { id: 2, codigo: "PRF-002", nombre: "Perfume Brisa Marina 50 ml", categoria: "Perfumes", precio: 690, costo: 410, stock: 4, stockMinimo: 5 },
  { id: 3, codigo: "PRF-003", nombre: "Loción Cítrica 200 ml", categoria: "Perfumes", precio: 420, costo: 240, stock: 20, stockMinimo: 6 },
  { id: 4, codigo: "CRM-001", nombre: "Crema Hidratante Facial", categoria: "Cremas", precio: 250, costo: 130, stock: 25, stockMinimo: 8 },
  { id: 5, codigo: "CRM-002", nombre: "Crema Corporal Vainilla", categoria: "Cremas", precio: 210, costo: 105, stock: 18, stockMinimo: 8 },
  { id: 6, codigo: "MAQ-001", nombre: "Labial Mate Rubí", categoria: "Maquillaje", precio: 180, costo: 85, stock: 30, stockMinimo: 10 },
  { id: 7, codigo: "MAQ-002", nombre: "Delineador Negro Intenso", categoria: "Maquillaje", precio: 150, costo: 70, stock: 0, stockMinimo: 6 },
  { id: 8, codigo: "CAP-001", nombre: "Shampoo Argán 400 ml", categoria: "Cuidado capilar", precio: 320, costo: 175, stock: 12, stockMinimo: 6 },
  { id: 9, codigo: "CAP-002", nombre: "Acondicionador Keratina", categoria: "Cuidado capilar", precio: 290, costo: 160, stock: 9, stockMinimo: 6 },
  { id: 10, codigo: "PRF-004", nombre: "Body Mist Flor de Loto", categoria: "Perfumes", precio: 260, costo: 135, stock: 3, stockMinimo: 5 },
];

// Fotos locales (carpeta public/img) que se muestran en el punto de venta.
const IMAGENES_CATEGORIA = {
  Perfumes: "/img/perfumes.jpg",
  Cremas: "/img/cremas.jpg",
  Maquillaje: "/img/maquillaje.jpg",
  "Cuidado capilar": "/img/cuidado-capilar.jpg",
};

export const imagenDeCategoria = (categoria) => IMAGENES_CATEGORIA[categoria] || "/icons/icon-512.svg";

const haceDias = (dias, hora) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(hora, 20, 0, 0);
  return fecha.toISOString();
};

const crearPartida = (productoId, cantidad, campoPrecio) => {
  const { id, nombre, [campoPrecio]: precio } = productosIniciales.find(
    (producto) => producto.id === productoId,
  );
  return { productoId: id, nombre, precio, cantidad };
};

const crearCompra = (numero, dias, proveedorId, partidas) => ({
  id: numero,
  folio: generarFolio("C", numero),
  fecha: haceDias(dias, 10),
  proveedorId,
  proveedor: proveedores.find(({ id }) => id === proveedorId).nombre,
  usuario: "Ricardo Garnica",
  partidas,
  ...calcularTotales(partidas),
});

const crearVenta = (numero, dias, hora, cliente, metodoPago, descuento, partidas) => ({
  id: numero,
  folio: generarFolio("V", numero),
  fecha: haceDias(dias, hora),
  cliente,
  metodoPago,
  descuento,
  usuario: "Laura Méndez",
  partidas,
  ...calcularTotales(partidas, descuento),
});

export const comprasIniciales = [
  crearCompra(2, 2, 2, [crearPartida(4, 10, "costo"), crearPartida(6, 12, "costo")]),
  crearCompra(1, 6, 1, [crearPartida(1, 8, "costo"), crearPartida(3, 10, "costo")]),
];

export const ventasIniciales = [
  crearVenta(3, 0, 9, "Mostrador", "Tarjeta", 0, [crearPartida(8, 1, "precio"), crearPartida(9, 1, "precio")]),
  crearVenta(2, 1, 17, "Ana Torres", "Efectivo", 10, [crearPartida(1, 1, "precio"), crearPartida(6, 2, "precio")]),
  crearVenta(1, 3, 12, "Mostrador", "Efectivo", 0, [crearPartida(4, 2, "precio")]),
];
