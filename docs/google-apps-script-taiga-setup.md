# Configuración de Google Apps Script y Taiga

Esta guía conecta el envío del Google Form de Zigma Inflables con el endpoint
`POST /taiga/inflatable-order`. El microservicio lee las respuestas, consulta
los issues del proyecto en Taiga, calcula el consecutivo y crea un **issue**.

## 1. Configurar el microservicio

Usa [.env.example](../.env.example) como referencia. En desarrollo local crea
un `.env` en la raíz del repositorio. En producción, define estas mismas
variables en el gestor de variables/secretos de la plataforma donde despliegas
el microservicio:

| Variable | Valor que debes configurar |
|---|---|
| `GIT_USER` | Usuario de Taiga que utilizará la API. |
| `TIAGA_PASSWORD` | Contraseña de ese usuario. El nombre lleva `TIAGA` porque así lo lee el servicio existente. |
| `TAIGA_PROJECT_ID` | ID numérico del proyecto Taiga en el que se consultarán y crearán issues. |
| `INFLATABLE_CATALOG_URL` | URL HTTPS de la hoja de cálculo pública de Google Sheets. |
| `INFLATABLE_ORDER_WEBHOOK_SECRET` | Secreto largo y aleatorio compartido con Apps Script. |

No agregues las credenciales ni el secreto a Git. El `.env.example` contiene los
nombres de las variables, no sus valores privados. En producción, el endpoint
debe estar publicado con HTTPS; la URL final tendrá esta forma:

```text
https://<dominio-publico-del-microservicio>/taiga/inflatable-order
```

### ID numérico del proyecto Taiga

El endpoint espera el ID numérico, no el slug del proyecto. Puedes obtenerlo
consultando Taiga con un token válido:

```text
GET https://api.taiga.io/api/v1/projects/by_slug?slug=<slug-del-proyecto>
```

El objeto del proyecto devuelto contiene `id`; ese número es el valor de
`TAIGA_PROJECT_ID`.

### URL del catálogo en Google Sheets

Configura directamente la URL normal de la hoja, por ejemplo:

```text
https://docs.google.com/spreadsheets/d/1I0URF1-jNhRJx7YThKXlUnfgBdojayRUc_H3jELiIQs/edit?gid=0#gid=0
```

El servicio toma el ID y el `gid` de esa ruta y consulta las filas de la hoja
en formato CSV mediante Google Visualization; no necesita un enlace de descarga
ni una copia local del `.xlsx`. Para que la lectura del servidor funcione sin
credenciales, configura la hoja como **Cualquier persona que tenga el enlace:
Lector**. El servicio actualiza su caché cada cinco minutos.

La primera fila debe incluir columnas que contengan `CATEGORIA`,
`NOMBRE PRODUCTO` y `DESCRIPCION`. Si el endpoint responde `502`, revisa los
logs `Google Sheets response` y `InflatableCatalogService`: confirma que la
respuesta sea HTTP 200 y tenga tipo `text/csv`; una página HTML normalmente
indica que la hoja no tiene acceso público de lectura.

## 2. Configurar Apps Script

Abre el Google Form, ve a **Más (⋮) → Editor de secuencias de comandos** y pega
este código. La URL y el secreto se leen de Script Properties; no es necesario
incluir valores privados en el código:

```javascript
function enviarATaiga(e) {
  if (!e || !e.response) {
    throw new Error(
      "Esta función debe ejecutarse mediante el activador de envío del formulario."
    );
  }

  var properties = PropertiesService.getScriptProperties();
  var url = properties.getProperty("INFLATABLE_ORDER_ENDPOINT");
  var secret = properties.getProperty("INFLATABLE_ORDER_WEBHOOK_SECRET");

  if (!url || !secret) {
    throw new Error(
      "Configura INFLATABLE_ORDER_ENDPOINT e INFLATABLE_ORDER_WEBHOOK_SECRET en Script Properties."
    );
  }

  var respuestas = e.response.getItemResponses();
  var datosFormulario = {};

  for (var i = 0; i < respuestas.length; i++) {
    var itemResponse = respuestas[i];
    var titulo = itemResponse.getItem().getTitle();
    datosFormulario[titulo] = itemResponse.getResponse();
  }

  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-webhook-secret": secret,
      Accept: "application/json"
    },
    payload: JSON.stringify(datosFormulario),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      "El microservicio respondió HTTP " + status + ": " + body
    );
  }

  Logger.log("Issue de Taiga creado correctamente: " + body);
}
```

### Guardar la URL y el secreto de forma segura

1. En Apps Script, abre **Configuración del proyecto** (ícono de engranaje).
2. En **Propiedades de la secuencia de comandos**, agrega:
   - `INFLATABLE_ORDER_ENDPOINT` = `https://<dominio-publico-del-microservicio>/taiga/inflatable-order`
   - `INFLATABLE_ORDER_WEBHOOK_SECRET` = el mismo valor configurado en el microservicio como `INFLATABLE_ORDER_WEBHOOK_SECRET`.
3. Genera un valor aleatorio largo para el secreto. No lo escribas en el código ni lo compartas en logs o repositorios.

## 3. Crear el activador del formulario

El envío del formulario debe llamar la función automáticamente:

1. En Apps Script, abre **Activadores** (ícono de reloj).
2. Haz clic en **Añadir activador**.
3. Selecciona la función `enviarATaiga`.
4. En **Selecciona la fuente del evento**, elige **Desde el formulario**.
5. En **Selecciona el tipo de evento**, elige **Al enviar el formulario**.
6. Guarda y autoriza los permisos solicitados, incluyendo acceso externo para `UrlFetchApp`.

No ejecutes `enviarATaiga` con el botón **Ejecutar** del editor: el parámetro `e`
solo existe cuando Google dispara el activador. Para probarlo, envía una respuesta
real al formulario y revisa **Ejecuciones** en Apps Script.

## 4. Configuración de Taiga

1. Verifica que el usuario configurado en `GIT_USER`/`TIAGA_PASSWORD` pueda
   autenticarse por la API y tenga acceso al proyecto.
2. Configura el ID numérico del proyecto en `TAIGA_PROJECT_ID`.
3. En ese proyecto, usa el tablero de **Issues** de Taiga; el flujo consulta y
   crea elementos mediante `GET /api/v1/issues` y `POST /api/v1/issues`.
4. No necesitas configurar un tipo de User Story. La API de creación de issues
   requiere `project` y `subject`; el microservicio también envía `description`.
5. Confirma que las issues existentes que definen el consecutivo tengan el lote
   en su `subject`, por ejemplo `MT03126 - Cliente - Producto`. El consecutivo
   se calcula por prefijo y año actual.

Referencia: [Taiga API — Issues: list and create](https://docs.taiga.io/api.html#issues-list)
y [Issues: create](https://docs.taiga.io/api.html#issues-create).

## 5. Comprobar la integración

Al enviar una respuesta, Apps Script debe recibir un HTTP 2xx con una respuesta
similar a:

```json
{
  "lotCode": "MT03126",
  "subject": "MT03126 - Nombre del Cliente - Nombre del Producto",
  "issueId": 123,
  "issueRef": 45
}
```

Si hay un error HTTP, el script lanza una excepción con el código y respuesta
del microservicio; revisa **Ejecuciones** en Apps Script y los logs del
microservicio. Un `401` indica que el secreto falta o no coincide; un `400`
indica que falta información obligatoria o el producto no puede clasificarse.
