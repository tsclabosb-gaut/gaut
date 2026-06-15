# Firebase como código — descubretuciudad.com

El sitio se aloja en **GitHub Pages** (dominio en `CNAME`). **Firebase** (proyecto
`descubre-tu-ciudad`) se usa como **base de datos de usuarios** (Auth + Firestore):
favoritos, comentarios, calificaciones, eventos enviados, perfiles y follows.

Este repo versiona la configuración de Firestore para poder desplegarla automáticamente:

| Archivo | Qué es |
|---|---|
| `firebase.json` | Apunta a las reglas y los índices |
| `firestore.rules` | Reglas de seguridad (quién puede leer/escribir cada colección) |
| `firestore.indexes.json` | Índice compuesto para `submissions` (status + type) |
| `.firebaserc` | Proyecto por defecto: `descubre-tu-ciudad` |
| `.github/workflows/deploy-firebase.yml` | Despliega reglas+índices al hacer push a `main` |

---

## Pasos manuales (una sola vez)

### 1. Iniciar sesión en Firebase (en tu Mac)
```bash
firebase login
```
Se abre el navegador → inicia sesión con la cuenta Google **dueña** del proyecto
`descubre-tu-ciudad` (el correo admin es `tsclabosb@gmail.com`).

### 2. Primer despliegue MANUAL (revisado)
Antes de confiar en la automatización, despliega tú una vez y verifica que la app
sigue funcionando (login, favoritos, comentarios):
```bash
cd ~/Desktop/gaut
firebase deploy --only firestore:rules,firestore:indexes
```
> ⚠️ Esto **reemplaza** las reglas que hoy estén en producción. Si algo se rompe,
> revisa `firestore.rules` y vuelve a desplegar. Para comparar con lo que hay hoy,
> mira la consola: Firebase Console → Firestore → Reglas.

### 3. Activar el despliegue automático desde GitHub
Para que cada cambio en `firestore.rules`/`firestore.indexes.json` se despliegue solo:

1. Crear una **cuenta de servicio**:
   Firebase Console → ⚙️ Configuración del proyecto → **Cuentas de servicio** →
   **Generar nueva clave privada** → se descarga un archivo `.json`.
2. En GitHub: repo `tsclabosb-gaut/gaut` → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**:
   - Nombre: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: pega **todo el contenido** del archivo `.json` descargado.
3. Listo. A partir de ahí, cada push a `main` que toque las reglas o índices
   ejecuta el workflow y despliega a Firebase.

---

## Resumen del flujo automático ya existente
- **Eventos** (`events.json`): el workflow `update-events.yml` los raspa y commitea
  cada día a las 3am. Usa el secret `ANTHROPIC_API_KEY`.
- **Sitio** (`index.html`): GitHub Pages lo publica en cada push a `main`.
- **Firestore** (reglas/índices): `deploy-firebase.yml` (este nuevo) los despliega
  en cada push que los modifique.
