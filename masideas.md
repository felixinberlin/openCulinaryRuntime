Knowledge > Instructions

Ingredients know themselves.
Tools know themselves.
Actions know themselves.

Recipes should contain as little knowledge as possible.
3. Core Principles

Cada principio explicado.

Por ejemplo

Knowledge is immutable.

Instances are mutable.

Recipes are declarative.

Everything is replayable.

Everything is deterministic.

Unknown knowledge is allowed.
4. The World

Explicar qué existe.

Ingredient Types

Ingredient Instances

Actions

Transformations

Tools

Containers

Workstations

Environment

Particles

Recipes

Events

Todo con diagramas.

5. Knowledge Layers

Esta parte me gusta mucho.

Grandma Layer

↓

World Layer

↓

Scientific Layer

Grandma dice

"pela la patata"

World entiende

PEEL

requires:
knife

creates:
peeled potato
potato peel

Scientific layer sabe

skin removed

water decreases

surface changes

etc

Nunca al revés.

6. Ingredient Model

Aquí un documento enorme.

Identity

Structure

Composition

Capabilities

Possible States

Allowed Transformations

Produced Byproducts

Sensory Properties

Metadata
7. Actions

Una acción no es código.

Es conocimiento.

Ejemplo

PEEL

requires

knife

valid targets

vegetables

outputs

peeled object
waste

duration

variable

precision

optional

etc
8. States

No sólo

raw

fried

Sino

peeled

cut

broken

burned

crispy

cold

warm

hot

overcooked

salted

wet

dry
9. Transformations

Aquí es donde ocurre la magia.

No existen recetas.

Existen transformaciones.

egg

↓

break

↓

egg white
egg yolk
shell
10. Event System

Todo es Event Sourcing.

PICK_UP

DROP

CUT

MOVE

HEAT

WAIT

MIX


Nunca se guarda el estado.

Sólo eventos.

11. Timeline

Explicar

undo

redo

save

playback

ghost cooking

AI explanation

robot execution


Todo sale gratis gracias al timeline.

12. Recipe Model

La parte importante.

Una receta NO contiene

Step 1

Step 2

Step 3

Contiene

Goals

Constraints

Required Ingredients

Acceptable States

Serving

Optional Variants

Tolerance

Victory Conditions
13. Validation Engine

Cómo decide

Is this tortilla valid?

No compara texto.

Compara estados.

14. Human Language

Aquí entra la IA.

Usuario

corta la cebolla finita

↓

LLM

↓

Intent

↓

SLICE

target onion

thickness thin

↓

Motor determinista.

15. Unknown Knowledge

Muy importante.

El mundo acepta

unknown ingredient

unknown action

unknown state

sin romper nada.

16. AI Integration

La IA nunca cocina.

La IA interpreta.

Nunca decide reglas.

17. Robotics

Misma API.

Humano

↓

Timeline

↓

Robot

No cambia nada.

18. Multiplayer

Aunque ahora el proyecto sea single-player, la arquitectura debe explicar cómo varios agentes podrían operar sobre el mismo timeline sin cambiar el modelo fundamental.

19. Future

Olores.

Partículas.

Fermentación.

Tiempo.

Bacterias.

Economía.

Mercado.

Restaurantes.

Robots.

20. Appendix

Modelo JSON.

Ejemplos.

DSL.

Cooklang.

Comparación.

Referencias.

Y añadiría algo que casi ningún proyecto tiene

Después del documento conceptual, un segundo documento llamado:

ENGINE_INVARIANTS.md

Este documento no explica el sistema.

Explica lo que nunca puede romperse.

Ejemplo:

Recipes never contain executable knowledge.

Actions never know recipes.

Ingredients never know tools.

Tools never know recipes.

Instances are disposable.

Knowledge is immutable.

Timeline is append-only.

Every world state must be reconstructable from events.

Everything must remain deterministic.

LLMs are never authoritative.

Ese archivo vale oro para una Coding AI. Cada vez que genere código, puede comprobar si viola alguno de esos invariantes. Si lo hace, el cambio es incorrecto aunque compile.

Creo que estos dos documentos (CONCEPT.md y ENGINE_INVARIANTS.md) serían la base más sólida posible para Tortilla World. A partir de ellos, una IA de programación podría generar la arquitectura, detectar inconsistencias y mantener el proyecto alineado con la filosofía "Grandma First, Machine Deep" sin necesidad de reinventar el modelo en cada sesión.