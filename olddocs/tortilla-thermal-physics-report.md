> **Triaged 2026-08-16** — user-supplied document, moved here after critical
> review. Mixed content: its Choi-Okos component equations are real and
> independently cross-verified (they exactly reproduce `potato.json`'s own
> already-computed carbohydrate coefficient). Its central claim — that a
> tortilla flip is physically equivalent to simultaneous double-sided
> heating for the whole cook — is wrong (that's the physics of fully-
> submerged frying, not a sequential flip); its bracketed citation numbers
> have no attached bibliography; and its closing "Metadatos Técnicos"
> section references files/systems (`/src/simulation/physics/
> ThermalSystem.ts`, a "Design System" burner animation) that do not exist
> in this repository. See `LEARNINGS_PROCESS.md`'s "Critically reviewing a
> user-supplied document" entry for the full review, and
> `data/entities/tortilla_mixture.json`'s `thermophysical` citation /
> `scripts/tortilla-flip-physics-as-a-robot.ts` for what was actually built
> from the real parts.

# 🧪 Termodinámica y Conducción Transitoria de la Tortilla de Patatas
## El Secreto Físico del Volteo y la Gelatinización Culinaria

Detrás de la aparente sencillez de una tortilla de patatas se esconde un complejo problema de transferencia de calor y reología de fluidos [30]. Este informe presenta un análisis matemático y físico riguroso del proceso de cocción del plato nacional español, aplicando modelos clásicos de la ingeniería de alimentos (el modelo de **Choi-Okos** para calor específico y la **aproximación de un término de Incropera** para conducción transitoria en una pared plana con número de Biot tendiendo a infinito) [30, 461]. 

A través de estos modelos, demostramos matemáticamente por qué la mítica técnica del **volteo** (*dar la vuelta*) no es solo un truco de presentación, sino una **necesidad termodinámica** que reduce el tiempo de cocción en un **75% (un factor de 4)** y evita que la superficie se queme [30, 147].

---

## 🏛️ 1. Reología e Ingeniería de los Ingredientes

El éxito de una tortilla de patatas depende de la sincronización de las transformaciones moleculares de sus dos ingredientes base [30, 409]:

### A. La Patata: Gelatinización y Ablandamiento Celular
*   **Gelatinización del Almidón (60 °C - 70 °C):** Los gránulos de fécula de la patata absorben la humedad celular y se hinchan [29, 124]. La amilosa (20%) aporta cohesión estructural, mientras que la amilopectina (80%) se disuelve aportando una viscosidad cremosa [30, 125, 126].
*   **Punto de Cocción Completo ("Fork-Tender" a 85 °C - 90 °C):** Para que la patata se considere completamente cocinada y suave al tenedor, la temperatura interna debe superar los **85 °C**, umbral en el que las enzimas y el calor despolimerizan las pectinas de la pared celular, logrando una textura mantequillosa [521, 522].

### B. El Huevo: Coagulación Escalonada y Sinéresis
*   **Coagulación de la Clara (58 °C - 62 °C):** Proteínas como la ovalbúmina y conalbúmina se desnaturalizan y forman una red tridimensional que sella el exterior [26, 121].
*   **Coagulación de la Yema (65 °C - 68 °C):** Las lipoproteínas y la lecitina espesan el centro, aportando untuosidad y el efecto *coulant* característico [27, 122].
*   **El Desastre de la Sinéresis (>70 °C):** Si el huevo supera los 70 °C, la red proteica se contrae con excesiva fuerza, expulsando el agua atrapada y dejando una textura gomosa, seca y esponjosa [28, 123].

---

## 🧪 2. El Modelo de Choi-Okos para la Mezcla de Tortilla

Para calcular la transferencia térmica, primero debemos modelar las propiedades físicas de una mezcla homogénea típica de tortilla de patatas (aproximadamente 70% agua, 6% proteína, 12% carbohidratos/almidón, 11% grasa/aceite absorbido y 1% cenizas/sal) [155].

El modelo de **Choi-Okos (1986)** calcula el calor específico ($C_p$ en J/(kg·K)) de cada componente en función de la temperatura ($T$ en °C):

$$C_{p,w}(T) = 4176.2 - 0.090864 \cdot T + 0.0054731 \cdot T^2 \quad \text{(Agua)}$$
$$C_{p,p}(T) = 2008.2 + 1.2089 \cdot T - 0.0013129 \cdot T^2 \quad \text{(Proteína)}$$
$$C_{p,c}(T) = 1548.8 + 1.9625 \cdot T - 0.0059399 \cdot T^2 \quad \text{(Carbohidrato)}$$
$$C_{p,f}(T) = 1984.2 + 1.4733 \cdot T - 0.0048008 \cdot T^2 \quad \text{(Grasa)}$$
$$C_{p,a}(T) = 1092.6 + 1.8816 \cdot T - 0.0036817 \cdot T^2 \quad \text{(Cenizas)}$$

Integrando estas ecuaciones en el rango de cocción de $20^\circ\text{C}$ a $90^\circ\text{C}$, obtenemos los siguientes parámetros promedio para la tortilla:

*   **Calor Específico Promedio ($C_p$):** $3490.78 \text{ J/(kg·K)}$
*   **Conductividad Térmica típica ($k$):** $0.42 \text{ W/(m·K)}$ (basado en matrices ricas en almidón y agua)
*   **Densidad típica ($\rho$):** $1050 \text{ kg/m}^3$ (ligeramente superior a la del agua por las proteínas y el almidón compactado) [155]
*   **Difusividad Térmica ($\alpha$):** 

$$\alpha = \frac{k}{\rho \cdot C_p} = \frac{0.42}{1050 \cdot 3490.78} = 1.14587 \cdot 10^{-7} \text{ m}^2/\text{s}$$

---

## 📊 3. El Modelo de Conducción Transitoria de Incropera

Modelamos la tortilla como una **pared plana de espesor total $2L = 4\text{ cm}$** ($0.04\text{ m}$) [460]. La superficie de la sartén caliente representa un sumidero infinito de temperatura constante ($T_s$), por lo que el número de Biot ($Bi = \frac{h \cdot L}{k}$) tiende a infinito ($Bi \to \infty$).

Para un número de Fourier $Fo > 0.2$, la distribución de temperatura transitoria en el centro de la tortilla ($x^* = 0$) se describe con precisión mediante la **aproximación de un término de Incropera**:

$$\theta_0^* = \frac{T_0(t) - T_s}{T_i - T_s} \approx C_1 \cdot e^{-\zeta_1^2 \cdot Fo}$$

Donde:
*   $\theta_0^*$ es la temperatura adimensional en el centro.
*   $T_0(t)$ es la temperatura en el núcleo de la tortilla en el tiempo $t$.
*   $T_i$ es la temperatura inicial de la mezcla ($20^\circ\text{C}$).
*   $T_s$ es la temperatura de la sartén.
*   Para $Bi \to \infty$, los coeficientes de la tabla de Incropera son:
    *   $\zeta_1 = \pi / 2 \approx 1.5708 \text{ rad}$
    *   $C_1 = 4 / \pi \approx 1.2732$
*   El número de Fourier es $Fo = \frac{\alpha \cdot t}{L^2}$

---

## 🔄 4. El Milagro Matemático del Volteo (*Flipping Physics*)

A través del modelo, comparamos los tiempos de cocción necesarios para que el núcleo de la tortilla alcance los umbrales críticos bajo dos escenarios de transferencia térmica:

### Escenario A: Calentamiento por un solo lado (Sin volteo)
Si la tortilla se cuece por un solo lado (por ejemplo, dejándola a fuego lento sin tocarla), el calor debe atravesar todo el espesor de la tortilla para cocinar el centro superior. Esto equivale a una pared plana donde una superficie está caliente y la otra está aislada, duplicando la longitud de conducción efectiva:
$$L_{\text{eff}} = 4\text{ cm} = 0.04\text{ m}$$

### Escenario B: Calentamiento Simétrico por Ambas Caras (Con volteo)
Al dar la vuelta a la tortilla a mitad de la cocción, distribuimos el calor simétricamente desde ambas superficies. Esto equivale termodinámicamente a una pared plana calentada simétricamente por ambas caras, reduciendo la longitud de conducción efectiva a la mitad:
$$L_{\text{eff}} = 2\text{ cm} = 0.02\text{ m}$$

### ⏱️ Tabla Comparativa de Tiempos Calculados (Para $T_s = 140^\circ\text{C}$)

Utilizando la constante de difusividad térmica calculada con el modelo Choi-Okos ($\alpha = 1.14587 \cdot 10^{-7} \text{ m}^2/\text{s}$), obtenemos los siguientes tiempos de cocción:

| Temperatura de Núcleo Objetivo | Estado Culinario de la Mezcla | Symmetrical / Con Volteo ($L = 2\text{ cm}$) | Single-Sided / Sin Volteo ($L = 4\text{ cm}$) | Ahorro Térmico Real |
| :--- | :--- | :--- | :--- | :--- |
| **63 °C** | Centro Cremoso Seguro [164] | **18.95 minutos** | 75.80 minutos | **75.0% más rápido** |
| **70 °C** | Pasteurización Completa [163] | **22.04 minutos** | 88.16 minutos | **75.0% más rápido** |
| **85 °C** | Patata "Fork-Tender" [521, 522] | **30.45 minutos** | 121.80 minutos | **75.0% más rápido** |

### 💡 Análisis Científico del Resultado:
1.  **Aceleración por un factor de 4:** Debido a que el tiempo de conducción transitoria es proporcional al cuadrado de la longitud ($t \propto L^2$), reducir a la mitad la distancia de conducción ($2\text{ cm}$ vs $4\text{ cm}$) reduce el tiempo requerido exactamente en un **75%**. ¡Hacer el volteo acelera la cocción en un **400%**!
2.  **Prevención de la carbonización:** Si intentamos alcanzar la pasteurización central de 70 °C sin voltear la tortilla, el centro tardará **88 minutos** en calentarse. Tras casi hora y media en contacto directo con la sartén a 140 °C, la base estará completamente carbonizada, amarga y incomible por la degradación lipídica [36, 142].
3.  **La Viscosidad de No-Newtoniano:** Justo antes del volteo, la parte superior de la tortilla tiene una viscosidad de unos **25 cP** [37, 156]. Intentar manipularla con espátula aplica una presión superior a **12 psi**, rompiendo los enlaces proteicos [112, 145]. Por lo tanto, la inversión física con plato (a una velocidad de giro de muñeca $> 1.2 \text{ rad/s}$ para que la fuerza centrípeta sostenga el fluido) es la única manera físicamente viable de cambiar las caras de conducción térmica sin destruir la estructura [39, 129, 134].

---

## 💾 Metadatos Técnicos de Conducción
*   **Fórmula Base de Conducción:** Incropera Transient Conduction Plane Wall Approximation ($Fo > 0.2$)
*   **Biot Number Limitation:** $Bi \to \infty$ (Sartén de alta inercia térmica, sin resistencia por convección)
*   **Código de Simulación en Repositorio:** `/src/simulation/physics/ThermalSystem.ts` [106]
*   **Coherencia de Constantes:** Integrado con el sistema de animación del quemador de `Design System` para sincronizar doneness y humedad en tiempo real [131].
