# Taxonomía y migración del histórico

Derivado de `meow_export_records.csv`: 1.230 registros, ene 2024 → ago 2026.
Las 41 "categorías" de Meow venían con typos, truncados, 39 filas vacías y una categoría comodín (`Varios`) con 108 cosas distintas adentro. Esto la reordena.

---

## 1. Categorías de gasto

| # | Categoría | Subcategorías |
|---|---|---|
| 1 | **Comida** | Restaurante · Delivery · Fast food · Merienda y cafetería · Facultad · Postres y helados · Propinas |
| 2 | **Supermercado** | Super · Verdulería y carnicería · Kiosco y chino · Limpieza y hogar |
| 3 | **Bebidas** | Sin alcohol · Alcohol · Salidas y boliche |
| 4 | **Transporte** | Apps (Didi/Uber) · Nafta · Estacionamiento · Peajes · Mantenimiento y reparación · Transporte público |
| 5 | **Apuestas** | Póker · Casino y online · Timba con amigos |
| 6 | **Entretenimiento** | Recitales y shows · Cine · Videojuegos · Salidas y juegos · Eventos y entradas |
| 7 | **Deporte** | Fútbol · Gym · Otros deportes |
| 8 | **Salud** | Psicóloga · Médico y estudios · Farmacia · Óptica |
| 9 | **Suscripciones** | Streaming · Software · Servicios digitales |
| 10 | **Tecnología** | Componentes y PC · Celular · Accesorios · Reparaciones |
| 11 | **Cuidado personal** | Peluquería · Perfumería y cosmética · Higiene |
| 12 | **Ropa y accesorios** | Ropa · Calzado · Accesorios |
| 13 | **Regalos y ocasiones** | Regalos · Flores · Aniversarios y cumpleaños |
| 14 | **Hogar y servicios** | Servicios (luz/gas/internet) · Muebles y equipamiento · Mantenimiento |
| 15 | **Impuestos y trámites** | Monotributo y AFIP · Multas · Documentación · Comisiones bancarias |
| 16 | **Viajes** | Vuelos · Alojamiento · Gastos en viaje |
| 17 | **Otros** | Sin categorizar |

### Por qué cambia respecto de Meow

- **`Coche` → `Transporte`.** No tenés gastos de auto: tenés 152 registros de los cuales la enorme mayoría son Didi y Uber. Nafta, estacionamiento y mecánico son minoría.
- **`Juego` → `Apuestas`.** De 59 registros: 9 "timba", 7 "poker", más stake, pokerstars, sinoca, rula. No son videojuegos. Sumado a `Timba` (4) y a los 13 ingresos de `Premios`, la timba tiene volumen propio y merece ver su resultado neto.
- **`uba` → `Comida > Facultad`.** Los 47 registros son medialunas, sanguches y alfajores en la facu. Es un *dónde*, no un *qué*.
- **`Tati` y `junko` dejan de ser categorías.** Son personas: pasan a etiquetas (`#tati`, `#junko`) y el gasto va a su categoría real. "Cena + propina con Tati" es `Comida > Restaurante` + `#tati`, y aparece en los dos cortes.
- **`Varios` se desarma.** Adentro había 10 registros de YouTube Premium, 7 de Mercado Libre nivel 6, la psicóloga, el monotributo, la luz, multas, entradas de recitales y el gym. Nada de eso es "vario".
- **`Gasto Grande Obligatorio` no es una categoría, es un tamaño.** Los 5 registros (775k + 775k + 396k + 360k + 78k) son todos mecánico y partes del auto: van a `Transporte > Mantenimiento y reparación` con etiqueta `#gasto-grande`.
- **`Limpiar` era peluquería.** Mal etiquetado en origen.

## 2. Categorías de ingreso

| Categoría | Origen en Meow |
|---|---|
| **Trabajo** | `Salario` (1), `Otros` → "base" (+229.951) |
| **Venta de USD** | `Cambio ` (29) — ver pendiente en la especificación |
| **Apuestas** | `Premios` (13) |
| **Inversiones** | `Interés` (6) — rendimientos y interés de MP |
| **Reintegros** | `Otros` → "devolucion rappi", reembolsos |
| **Regalos recibidos** | `Efectivo` → "regalo tia monk" |
| **Otros** | `Hice algo mal` (1) |

## 3. Qué se descarta

**78 registros no migran.** No son gastos ni ingresos: son préstamos, devoluciones y movimientos de efectivo, todos liquidados hace tiempo. El módulo de deudas arranca vacío.

| Origen | Cantidad | Qué era |
|---|---|---|
| Tipo `Transferir`, sin categoría | 39 | "maxi me paga deuda casino", "le doy a forster pa la timba", "extracción", "cambio c paola" |
| Categoría `Transfe`, tipo Ingreso | 32 | Cobros de deudas: "me paga tahichi", "me pagan las EMPAS" |
| Categoría `Presto`, tipo Expensas | 7 | Préstamos otorgados: "presté al dogor", "prestamo timbero" |

**Migran 1.152 registros**: 1.098 gastos + 54 ingresos.

## 4. Reembolsos parciales

33 filas usan la columna `Reembolsar` de Meow: gastaste 99.950 en sushi libre y te devolvieron 60.402.

Se migran con **monto bruto en `ars_amount` y el reembolso en `refund_ars`**. Los totales usan el neto (`ars_amount - refund_ars`), así que el mes da bien sin perder el dato de lo que realmente salió de tu bolsillo.

## 5. Reglas del importador

Se aplican en orden: primero la categoría de origen, después las reglas por comentario (case-insensitive, sin tildes). Lo que no matchea ninguna regla cae en `Otros > Sin categorizar` y se reclasifica desde la app.

### 5.1 Mapeo directo por categoría de origen

| Meow | Usura |
|---|---|
| `Comida` (459) | Comida → subcategoría por regla 5.2 |
| ` uba` (47) | Comida > Facultad |
| `Postre` (19) | Comida > Postres y helados |
| `Propina` (12) | Comida > Propinas |
| `Café` (2) | Comida > Merienda y cafetería |
| `Coche` (152) | Transporte → subcategoría por regla 5.3 |
| `Autobús` (7) | Transporte > Transporte público |
| `Gasto Grande Obligatorio` (5) | Transporte > Mantenimiento y reparación + `#gasto-grande` |
| `Bebida ` (36), `Beber` (9) | Bebidas → `alcohol\|trago\|birra\|fernet\|cerveza\|vino` → Alcohol; resto → Sin alcohol |
| `Super` (20) | Supermercado > Super |
| `Verduras` (1) | Supermercado > Verdulería y carnicería |
| `Juego` (59), `Timba` (4) | Apuestas → subcategoría por regla 5.4 |
| `Cine` (10) | Entretenimiento > Cine |
| `Deporte` (30) | Deporte → `futbol\|fobal\|fubol\|fuchebol` → Fútbol; `gym\|gimnasio` → Gym; resto → Otros deportes |
| `Médico` (4) | Salud > Médico y estudios |
| `Tecnología ` (28) | Tecnología → subcategoría por regla 5.5 |
| `Corte de pelo` (5), `Limpiar` (1) | Cuidado personal > Peluquería |
| `perfume` (3), `Cosmético` (2) | Cuidado personal > Perfumería y cosmética |
| `Ropa` (20) | Ropa y accesorios > Ropa |
| `Regalo` (19) | Regalos y ocasiones > Regalos |
| `vacacione` (6) | Viajes → `vuelo\|aereo` → Vuelos; `airbnb\|hotel\|hostel` → Alojamiento; resto → Gastos en viaje |
| `junko` (2) | Viajes + `#junko` |
| `suscripcion` (1) | Suscripciones > Streaming |
| `Tati` (24) | Categoría por regla 5.2–5.7 + `#tati` |
| `Me la mande` (2) | Otros > Sin categorizar + `#revisar` |
| `Cambio` (1, gasto) | Otros > Sin categorizar + `#revisar` |
| `Varios` (108) | Reglas 5.6 |

### 5.2 Comida — subcategoría por comentario

| Patrón | Subcategoría |
|---|---|
| `mcdonalds\|mcc\|mc \|mcaya\|nocta\|kfc\|burger\|whatevurger\|tasty\|pancho` | Fast food |
| `merienda\|medialuna\|sanguch\|santuch\|ciabat\|alfajor\|alfsjor\|brule\|batata\|milanes\|cafe\|café` | Merienda y cafetería |
| `rappi\|pedidos ya\|delivery` | Delivery |
| `helado\|torta\|carrot cake\|carro cake\|crepas\|mousse\|postre` | Postres y helados |
| `propina` | Propinas |
| `sushi\|kbbq\|arabe\|sarkis\|enso\|takoyaki\|pizza\|asad\|pf chang\|korean` | Restaurante |
| *resto* | Restaurante |

### 5.3 Transporte — subcategoría por comentario

| Patrón | Subcategoría |
|---|---|
| `didi\|uber\|cabify` | Apps |
| `nafta\|tanque\|combustible\|ypf\|shell` | Nafta |
| `estacionamiento\|estacion\|parking` | Estacionamiento |
| `peaje` | Peajes |
| `mecanico\|service\|partes\|puertas\|arregl\|no funcionan` | Mantenimiento y reparación |
| `sube\|colectivo\|bondi\|tren\|subte` | Transporte público |
| *resto* | Apps |

### 5.4 Apuestas — subcategoría por comentario

| Patrón | Subcategoría |
|---|---|
| `poker\|pokerstars` | Póker |
| `stake\|sinoca\|casino\|online` | Casino y online |
| `timba\|timbita\|timbini\|rula\|chirolera` | Timba con amigos |
| `playland\|bowling\|pool\|golf\|rematch\|repo` | → **Entretenimiento > Salidas y juegos** (no es apuesta) |

### 5.5 Tecnología — subcategoría por comentario

| Patrón | Subcategoría |
|---|---|
| `grafica\|gabinete\|fuente\|cooler\|monitor\|ideapad\|placa` | Componentes y PC |
| `celu\|celular\|telefono` | Celular |
| `mouse\|cargador\|pilas\|pendrive\|funda\|punta\|mic` | Accesorios |
| `arregl\|reparac\|remodelar` | Reparaciones |

### 5.6 `Varios` — desarme completo

| Patrón | Destino | Filas |
|---|---|---|
| `ytp\|yt prem\|ytpremium\|youtube` | Suscripciones > Streaming | 10 |
| `meli\|ml nivel\|mp nivel\|mercalibre` | Suscripciones > Servicios digitales | 7 |
| `crunchyroll\|runchyroll` | Suscripciones > Streaming | 2 |
| `figma\|calm\|stats fm\|google one\|dateas\|djfumsdote\|los datos\|calcu` | Suscripciones > Software | 8 |
| `ysy\|fabro\|fsbro\|cadena ysy` | Entretenimiento > Recitales y shows + `#ysy-a` | 10 |
| `psicolog\|osicolog` | Salud > Psicóloga | 4 |
| `gym\|gimnasio` | Deporte > Gym | 2 |
| `monotrib\|afip` | Impuestos y trámites > Monotributo y AFIP | 4 |
| `multa` | Impuestos y trámites > Multas | 2 |
| `pasaporte\|isic\|fotocopias\|fotinis\|carnet` | Impuestos y trámites > Documentación | 4 |
| `extraccion\|extracciones\|comision` | Impuestos y trámites > Comisiones bancarias | 2 |
| `la luz\|el piso` | Hogar y servicios > Servicios | 2 |
| `silla` | Hogar y servicios > Muebles y equipamiento | 2 |
| `imax\|entrada\|makena\|frozouda\|sabi\|pochoclos\|pochox` | Entretenimiento > Eventos y entradas | 6 |
| `telo` | Entretenimiento > Salidas y juegos | 1 |
| `trago\|birra\|guardarropa\|alcohol\|coca\|cocas` | Bebidas | 5 |
| `uber\|didi\|sube\|parking` | Transporte | 4 |
| `shampoo\|crema para el pelo\|forros` | Cuidado personal > Higiene | 3 |
| `gafas` | Salud > Óptica | 1 |
| `aritos\|altitude\|brth\|don rouch` | Ropa y accesorios > Accesorios | 4 |
| `manga\|rifas\|regale` | Regalos y ocasiones > Regalos | 3 |
| `burger\|cafecito\|chino` | Comida | 3 |
| `service de mam\|multa de papa\|mi vieja` | categoría real + `#familia` | 4 |
| `tarjeta\|maria\|algo\|\?\?\?\|foster no me pago\|vuelto\|usdt\|resto` | Otros > Sin categorizar + `#revisar` | ~10 |

### 5.7 Etiquetas automáticas

El importador genera etiquetas desde el comentario, no solo desde la categoría:

- **Personas** detectadas por nombre recurrente: `#tati`, `#maxi`, `#junko`, `#axel`, `#ian`, `#fabro`, `#tahichi`, `#lolo`, `#forster`, `#dani`, `#maria`.
- **Eventos**: `#ysy-a`, `#viaje-junko`.
- **Marcadores**: `#gasto-grande`, `#revisar`, `#familia`.

### 5.8 Detección de cuotas

El importador reconoce series de cuotas y las agrupa en un único `recurrente` de tipo `cuotas`:

- `cuota N`, `cuot N`, `N/M` en el comentario → `cuota_nro` / `cuota_total`. Casos reales: "campera tati cuota 2", "cuota 1 ysy a", "ysy a cuota 5", "dos cuotas de calm".
- **Mismo monto exacto repetido en meses consecutivos** con el mismo concepto → serie de cuotas. Caso real: "Monitor nuevo!" a -18.414 nueve veces.

Las series detectadas se marcan para que las confirmes: es la única parte de la migración que conviene revisar a mano, porque un falso positivo (un gasto genuinamente repetido, como el fútbol semanal) se puede colar.

## 6. Verificación post-migración

Chequeos que tienen que dar antes de considerar la migración terminada:

1. **1.152 registros importados**, 78 descartados. Nada perdido en el medio.
2. **La suma de gastos por mes coincide con el CSV** mes a mes, considerando el neto de reembolsos.
3. **Cero registros con categoría nula** (a lo sumo `Otros > Sin categorizar`).
4. **`Sin categorizar` por debajo de ~5%** (≈57 registros). Si da más, faltan reglas.
5. Las 5 filas de `Gasto Grande Obligatorio` suman **2.384.317** y están todas en Transporte.
6. Ningún registro de tipo `Transferir` sobrevivió.
