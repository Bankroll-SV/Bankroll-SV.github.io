# BLACKBOOK

Diario local de apuestas deportivas. El panel calcula bankroll, ROI, yield, win rate, cuota media, drawdown, rachas y la curva de capital. Los datos se quedan en el navegador.

## Abrir

Hace falta un navegador actual: Edge, Chrome o Firefox. No hace falta instalar nada.

1. Entra en la carpeta `blackbook`.
2. Abre `index.html` con doble clic.

También puedes servirlo:

```powershell
cd C:\Users\ASUS\Proyectos\blackbook
python -m http.server 8080
```

Luego abre `http://127.0.0.1:8080`.

Para ver el panel con datos de ejemplo, sin guardarlos, abre `index.html?preview=1` o usa **Ver demostración** dentro de la app.

## Qué guarda y dónde

Cada alta, edición, borrado e importación se escribe en `localStorage` de ese navegador, bajo la clave `blackbook.v1`. No hay servidor ni cuenta.

El origen del almacenamiento depende de la ruta del archivo. Si mueves la carpeta, el navegador puede tratarla como otro sitio y no mostrar el historial anterior. Exporta una copia JSON antes de moverla.

La vista previa no se guarda hasta que pulsas **Guardar** o registras un cambio.

## Registro

Cada apuesta tiene fecha, deporte, competición, evento, tipo, cuota decimal, stake, resultado, casa y notas. El beneficio neto se calcula solo:

| Resultado | Beneficio |
| --- | --- |
| Ganada | stake × (cuota − 1) |
| Perdida | −stake |
| Nula | 0 |
| Cashout | importe cobrado − stake |

En un cashout, el importe cobrado es lo que devuelve la casa, stake incluido. Un cierre de 28 € sobre un stake de 40 € es −12 €.

## Métricas

- **Bankroll**: bankroll inicial + beneficio de todas las apuestas. El número del encabezado ignora los filtros.
- **Beneficio**: suma del resultado neto de la selección visible.
- **Yield**: beneficio / suma de stakes. Las nulas entran en el apostado y aportan 0.
- **ROI**: beneficio / bankroll inicial. Con filtros, es el aporte de esa selección, no un bankroll distinto.
- **Win rate**: aciertos / (ganadas + perdidas). Una nula no entra. Un cashout entra según el signo de su beneficio; si es cero, tampoco entra.
- **Cuota media**: media ponderada por stake. La nota muestra la media simple.
- **Drawdown**: mayor caída desde un pico hasta el valle posterior. En una selección filtrada, la curva parte de cero.
- **Racha**: resultados decisivos seguidos. Una nula no la corta.

El beneficio positivo se muestra en blanco y el negativo en rojo. El rojo de la interfaz es el color de marca, no un indicador de casino.

## Filtros y períodos

Los filtros de fecha, deporte, tipo, casa, resultado y búsqueda se aplican al panel, al historial, a los cortes y a las rachas.

La comparativa usa sus propias dos fechas. El resto de filtros sí se aplica. La diferencia de yield, ROI y win rate está en puntos porcentuales.

## CSV y JSON

En **Datos** puedes exportar el historial completo, la selección filtrada, una copia JSON o una plantilla.

El CSV sale en UTF-8, con separador `;` y decimales con coma, para abrirlo en Excel en español. Al importar también se aceptan coma, punto y coma o tabulador, y decimales con punto o coma. Fechas `AAAA-MM-DD` o `DD/MM/AAAA`.

Columnas: `fecha`, `deporte`, `competicion`, `evento`, `tipo`, `cuota`, `stake`, `resultado`, `importe_cashout`, `casa`, `notas`. `beneficio` se exporta como referencia y se vuelve a calcular al importar.

Resultados admitidos: `ganada`, `perdida`, `nula`, `cashout` (también `won`, `lost`, `void`, `push`).

**Añadir** suma filas válidas. **Reemplazar** sustituye el historial. Una copia JSON también puede traer el bankroll inicial y la moneda.

## Comprobar los cálculos

```powershell
node test/logic.test.js
```

## Privacidad

Nada sale del navegador. Borrar los datos del sitio, o usar una ventana privada, elimina el historial.
