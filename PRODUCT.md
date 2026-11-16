# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal: el familiar que cuida.** Hijo, hija o cuidador que pide atención de enfermería a domicilio para un adulto mayor o un paciente en casa. Decide desde el celular, con algo de angustia y poco tiempo, y deja entrar a un desconocido a la casa de alguien vulnerable.
- **Profesional de enfermería ("socio").** Se conecta, recibe ofertas con cuenta regresiva, se desplaza, atiende y cobra el 85 % de cada servicio. Usa la app de pie, en la calle, con una mano.
- **Administrador.** Valida tarjeta profesional y diploma de cada profesional y vigila la operación en curso.

## Product Purpose

Pedir un profesional de enfermería verificado que llegue a la casa del paciente. El familiar elige el servicio, cuándo y dónde, ve el total antes de pedir, paga y sigue el recorrido en vivo hasta que la atención termina y la califica. Éxito: que el familiar confíe lo suficiente para pedir la primera vez y vuelva a pedir.

## Positioning

**Confianza verificada.** Ningún profesional recibe servicios hasta que un administrador valida su tarjeta profesional y su diploma. Frente a conseguir enfermera por WhatsApp o esperar a una IPS domiciliaria, la app muestra quién viene, con qué credenciales y por dónde va. Rapidez y precio claro acompañan esa promesa, no la reemplazan.

## Operating Context

- Ciudad de operación actual: Bogotá. Moneda COP, idioma español (es-CO).
- Flujo del familiar: servicio → cuándo (ahora o programado) → dónde (ubicación obligatoria) → pago → búsqueda → aceptado → en camino → en atención → completado → calificación. Factura por servicio.
- Flujo del profesional: subir documentos → revisión → conectarse → oferta con tiempo límite → aceptar → salir → llegar → iniciar → terminar. Ganancias por día.
- Flujo del administrador: validar o rechazar perfiles, abrir documentos, ver solicitudes activas y profesionales en el mapa.
- Pagos: Wompi (tarjeta, Nequi/PSE) y efectivo. Reembolso automático al cancelar o quedar sin cobertura.

## Capabilities and Constraints

- PWA móvil primero: React 19, TypeScript, Vite, Tailwind v4, Supabase (Auth, Postgres con RLS, Realtime, Edge Functions), Leaflet, lucide-react. En escritorio se muestra dentro de un marco de teléfono.
- Catálogo confirmado: Inyectología, Curaciones, Postoperatorio, Adulto mayor, Toma de muestras, Terapia IV, con precio base y duración.
- Estados del servicio: solicitado, aceptado, en_camino, en_atencion, completado, cancelado, sin_cobertura.
- El total lo calcula el servidor (`cotizar`); la interfaz no inventa precios.
- Solo tema claro hoy.
- **Abierto:** el nombre "EnfermeraYa" puede cambiar si aparece uno mejor; no se cambia sin confirmación explícita, porque arrastra dominio, comercio en Wompi y correos.
- **Abierto:** política de reembolsos definitiva; texto fijo "Visa •••• 4242" en el paso de pago.

## Brand Commitments

Ninguno obligatorio: nombre, símbolo, colores y tipografía pueden cambiar. Un límite confirmado: la app no puede sentirse infantil ni de juguete; trata un tema de salud y de confianza.

## Evidence on Hand

- Datos reales en la app: catálogo y precios, profesionales registrados con su especialidad, calificación y número de servicios, distancia y tiempo estimado.
- No hay testimonios, fotos de profesionales, cifras de cobertura ni sellos de terceros. No se fabrican.

## Product Principles

1. **La confianza se muestra, no se declara.** La verificación del profesional aparece donde el familiar decide, no en un aviso al pie.
2. **Calma para quien cuida.** Una decisión por pantalla, estado siempre visible, nada que apure.
3. **El precio y el estado nunca se esconden.** Total antes de pedir; quién viene y dónde va durante todo el servicio.
4. **El profesional es personal de salud, no un repartidor.** Su nombre, especialidad y credencial van primero.

## Accessibility & Inclusion

Objetivo de trabajo, sin confirmar con el dueño: contraste WCAG AA, texto mínimo de 12 px, zonas táctiles de 44 px y respeto a `prefers-reduced-motion`. Parte de los usuarios son adultos mayores.
