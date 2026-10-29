# Damas — Juego accesible

Juego de **damas españolas** accesible, con voz, señales sonoras y registro de partida.
Aplicación web estática (HTML/CSS/JS puro, sin dependencias) y **PWA instalable**.

## Características

- Damas españolas completas: captura obligatoria (ley de cantidad y calidad), coronación que corta la cadena, tablas por repetición triple, 40 jugadas de dama sin captura ni movimiento de peón y dama contra dama.
- Regla opcional del **soplido**: si puedes comer y no comes, la máquina retira la ficha que debía comer.
- IA con **minimax + poda alfa-beta** y profundización iterativa (3 niveles de dificultad).
- **Accesible**: tablero navegable por teclado, compatible con lectores de pantalla (ARIA), narración por voz y señales sonoras sintetizadas.
- Entrada de jugadas por **texto** (`c3-d4`, `c3xe5xg7`) o **clic**; inspección de casillas, listado de jugadas legales, registro completo de la partida exportable.
- Gráficos **SVG** con tablero texturizado, fichas con relieve y corona, movimiento animado por tramos, efecto de captura y de soplido, y sonidos generados con WebAudio.
- Guardado automático de la partida y ajustes en *localStorage*.
- PWA instalable en móvil (manifest + service worker) con pantalla completa.

## Uso

Abre `index.html` en un navegador. Comandos de texto disponibles: `ayuda`, `estado`, `legales`, `deshacer`-comandos de contexto, `reglas`, `repetir`, `voz`, `sonido`, `soplido`, `registro`, `tablero`, `facil|medio|dificil`, `nueva`, `copiar`, `exportar`.

## Pruebas

Abre `tests.html` para ejecutar la batería autocontenida de pruebas del motor de reglas y de la IA.

## Estructura

```
index.html      # interfaz principal
tests.html      # pruebas del motor
manifest.json   # PWA manifest
sw.js           # service worker
css/styles.css  # estilos
js/rules.js     # motor de reglas (damas españolas)
js/ai.js        # IA (minimax alfa-beta)
js/app.js       # controlador de interfaz, animaciones y flujo
js/speech.js    # voz (TTS) y señales sonoras (WebAudio)
js/tests.js     # batería de pruebas
```

## Licencia

Sin licencia declarada todavía.
