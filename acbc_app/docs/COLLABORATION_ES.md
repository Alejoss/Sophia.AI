# CÓMO COLABORAR

Puedes colaborar creando issues o resolviéndolos.
Por favor si encuentras errores toma un screenshot y compártelos. Esto ayudará mucho al proceso de desarrollo colaborativo. 

## Cómo crear un issue

- Ir al proyecto en GitHub, a la sección "Issues" y clickear el botón "New issue".
- Completa el título del issue y la descripción.
- El título puede seguir la siguiente convención: ${CÓDIGO-DEL-ISSUE}: ${breve explicación}
- La explicación debe ser breve, ya que es un título.
- El código consta de una primera palabra (DOCS, FRONT, BACK, OTHER), un guión medio y un número de cuatro dígitos.
  - DOCS se refiere a si el issue está relacionado con documentación.
  - FRONT se refiere a si el issue está relacionado con frontend.
  - BACK se refiere a si el issue está relacionado con backend.
  - OTHER se refiere a si el issue está relacionado con otro tema.
- Puedes mirar algunos de los issues ya creados para usar de referencia.

## Cómo resolver un issue

- Trabaja directamente en `develop`; verifica la rama antes de editar o hacer commit.
- No crees ramas de funcionalidades, no modifiques `main` ni abras PR hacia `main`.
- Realiza cambios concretos, actualiza la documentación, revisa el diff y ejecuta las pruebas locales pertinentes.
- Haz commit en `develop`, usando el código real del issue cuando exista.
- Publica únicamente `develop` cuando se solicite. Los despliegues son un proceso separado.
- Consulta el [flujo de trabajo](../../docs/hackathon/develop-workflow.md).
