# 🎨 THEMING — sistema di tema di Jingle Machine

Come è strutturato il tema grafico e **come aggiungerne uno nuovo**. Pensato per essere
**semplice, essenziale e performante**: niente JS a runtime per ricalcolare gli stili, solo
**CSS custom properties** native (variabili CSS) come unica fonte di verità.

> 📌 Stato: **IMPLEMENTATO** (Fase 5). Sistema attivo in `client/src/styles/`. Valori del tema **default**
> tarati sull'**SVG del mockup** Figma (palette teal/cyan). Verificato con build + screenshot + check WCAG.

---

## 1. Principi (perché così)

1. **Unica fonte di verità = token CSS** (`--*`). Colori, raggi, tipografia, superfici e spazi
   vivono **solo** nei file di tema. Nessun `#45fff3` o `rounded-[20px]` sparso nei template.
2. **Un tema = un file.** Aggiungere un tema = copiare un file e cambiare i valori. Niente refactor.
3. **Performance**: le CSS variables sono native, valutate dal browser senza JS e **ereditate**;
   cambiare tema = cambiare **un attributo** su `<html>` (`data-theme`), zero rebuild, zero reflow di logica.
4. **Niente classi custom** (`.jm-button`, `.jw-*`): si stilizzano i **tag nativi** (`button`, `input`,
   `textarea`…), i loro **attributi/stati** (`type="password"`, `:hover`, `:checked`, `:focus-visible`)
   e le **classi già esistenti di ng-zorro** (`.ant-btn`, `.ant-input`…). Le classi semantiche si usano
   solo come *utility Tailwind generate dai token* (`bg-primary`, `rounded-xl`), non come CSS scritto a mano.
5. **Configurare Tailwind, non sovrascriverlo**: i token vivono **direttamente negli slot nativi** di
   Tailwind v4 (`@theme`): colori in `--color-*`, raggi in `--radius-*`, font in `--font-*`. Si usano le
   **utility che Tailwind già genera** (`rounded-xl`, `text-2xl`, `bg-primary`) — niente scala/variabili parallele.
6. **Best-practice dei framework**: Tailwind v4 `@theme` (token → utility) + override ng-zorro centralizzati.
   Verificato su doc ufficiali (vedi §10).

---

## 2. Architettura a livelli

```
┌─ @theme (themes/default.scss) ────────────────────────┐  ← VALORI del tema DEFAULT
│  @theme { --color-primary:#45fff3; --radius-xl:20px } │     + è ciò che fa GENERARE le utility
└───────────────────────────────────────────────────────┘
┌─ themes/<altro>.css ──────────────────────────────────┐  ← un file per tema in più: SOLO override
│  :root[data-theme="ocean"] { --color-primary:#…; … }  │     delle CSS var (stessi nomi)
└───────────────────────────────────────────────────────┘
            │ (le var sono emesse su :root ed ereditate da tutto il DOM)
   ┌────────┴───────────────────────────┬───────────────────────────┐
   ▼                                     ▼                           ▼
utility Tailwind (auto)           ng-zorro.scss              base HTML (styles.css)
bg-primary · rounded-xl ·         override .ant-* con        tag nativi + stati
text-2xl (referenziano la var)    var(--color-*) + color-mix (input, button, :checked…)
```

- **Token = slot nativi di Tailwind.** Il blocco `@theme` definisce i **valori del tema default** e, così
  facendo, fa **generare le utility** (`bg-primary`, `rounded-xl`…). Le utility *referenziano* la CSS var
  (es. `.bg-primary { background: var(--color-primary) }`), quindi cambiare la var cambia l'aspetto.
- **Un tema in più = override delle stesse var** sotto `[data-theme="x"]`: le utility si ri-risolvono da sole.
  Niente `@theme inline` (lo useremmo solo se un token referenziasse un altro token).
- **Consumo:** ng-zorro e i tag nativi leggono `var(--color-*)`. Nessuno ridefinisce valori propri.

> Regola d'oro: i **valori** stanno solo in `@theme`/`[data-theme]`. Tutto il resto fa `var(--color-*)` o usa l'utility.

---

## 3. Taxonomy dei token (tema **default**)

I token usano i **namespace nativi di Tailwind v4** (`--color-*`, `--radius-*`, `--font-*`, `--shadow-*`)
così ogni token **genera l'utility corrispondente** (`bg-primary`, `rounded-xl`, `shadow-raised`…) e
si configura **una volta sola**. Naming **semantico** (per scopo, non per colore: `--color-primary`, non
`--color-cyan`). Valori estratti dagli stili attuali. Solo i `--color-*` cambiano tra temi; gli altri sono
strutturali (un tema può comunque ridefinirli se vuole).

> Eccezione: lo **z-index** (§3.8) **non** è un namespace di `@theme` in Tailwind → quei `--z-*` sono CSS var
> nostre e **non** generano utility.

### 3.1 Palette semantica — `--color-*`
| Token | Valore default | Utility | Uso |
|---|---|---|---|
| `--color-primary` | `#45fff3` (cyan) | `bg/text/border-primary` | CTA, link, focus ring |
| `--color-on-primary` | `#00201c` | `text-on-primary` | testo/icona sopra `primary` |
| `--color-danger` | `#ff4548` (rosso) | `*-danger` | errori, YouTube, azioni distruttive |
| `--color-on-danger` | `#ffffff` | `text-on-danger` | testo sopra `danger` |
| `--color-success` / `--color-on-success` | `#52c41a` / `#00201c` | `*-success` / `text-on-success` | esiti positivi |
| `--color-warning` / `--color-on-warning` | `#ffb700` / `#00201c` | `*-warning` / `text-on-warning` | avvisi |
| `--color-info` / `--color-on-info` | `#1890ff` / `#ffffff` | `*-info` / `text-on-info` | info neutre |

> Ogni colore "di sfondo" ha il suo **`--color-on-*`** (testo/icona a contrasto). Regola: testo su superficie
> colorata → sempre il suo `on-*`, mai bianco fisso. Contrasti verificati WCAG (vedi §3.9).

> I **tint/hover** NON sono token separati: si derivano con `color-mix(in srgb, var(--color-primary) 15%, transparent)`
> (CSS nativo, sostituisce il `fade()` di Less). Un solo token per colore → meno duplicazione.

### 3.2 Superfici / layer (bg + bordo + raggio per contenitore)
Tre "altezze" di superficie, per layout armonici. Ogni layer abbina **bg + border + radius**.
| Layer | `bg` | `border` | `radius` | Uso |
|---|---|---|---|---|
| `page` | `--color-page: #00201c` | — | — | sfondo pagina/`body` |
| `surface` | `--color-surface: #001714` | `--color-border` | `rounded-2xl` (40px) modali · `rounded-xl` (30px) card | modali/popover (più scuro della pagina, come nel mock) |
| `control` | `--color-control: #005147` (teal) | `transparent`→`--color-primary` su focus | `rounded-lg` (20px) | input, textarea, search, bottone neutral |

> Valori superfici **dall'SVG del mockup**: `control` è un **teal visibile** (`#005147`), non near-black → i campi
> si distinguono dallo sfondo. `--color-control-hover: #006659` per gli hover.

Token correlati:
- `--color-border: rgba(255,255,255,.12)` · `--color-border-subtle: rgba(255,255,255,.08)`
- `--shadow-raised: none` (design **flat**: separazione via bordo, non ombra; token pronto se servirà → utility `shadow-raised`)

### 3.3 Testo — `--color-*`
| Token | Valore | Utility | Uso |
|---|---|---|---|
| `--color-fg` | `rgba(255,255,255,.85)` | `text-fg` | testo base |
| `--color-muted` | `rgba(255,255,255,.55)` | `text-muted` | secondario/placeholder (.55 = ≥AA su scuro) |
| `--color-heading` | `rgba(255,255,255,.88)` | `text-heading` | titoli |
| `--color-disabled` | `rgba(255,255,255,.30)` | `text-disabled` | disabilitato/placeholder |

### 3.4 Tipografia — `--font-sans` + scala nativa
- `--font-sans: 'Inter', system-ui, sans-serif` (font del mockup Figma) → utility `font-sans`, e font di base del `body`.
- **Dimensioni**: si usa **direttamente la scala nativa di Tailwind** (`text-xs … text-3xl`, con `line-height`
  abbinato) — niente token nostri. I size del mockup **coincidono già**: 20px = `text-xl`, 24px = `text-2xl`.

### 3.5 Raggi — slot nativi `--radius-*` (valori dall'SVG del mockup)
Configuriamo gli **slot esistenti** di Tailwind → si usano `rounded-lg`/`rounded-xl`/… senza nuove classi.
| Token Tailwind | Valore | Utility | Uso |
|---|---|---|---|
| `--radius-lg` | `20px` | `rounded-lg` | input/control, `nz-button` (default) |
| `--radius-xl` | `30px` | `rounded-xl` | card jingle, pannelli raised |
| `--radius-2xl` | `40px` | `rounded-2xl` | modale |
| `--radius-full` | (default `9999px`) | `rounded-full` | pill/tag/dot, **CTA `ui-button`** |

> **Altezza control**: token `--control-height: 56px` (in `tokens.css`), usato via `h-(--control-height)`
> per input/select/CTA. Tunable. `nzSize="small"/"large"` di ng-zorro restano disponibili.

### 3.6 Intenti componente (confermati dai mockup)
Mappatura "scopo → token", così i componenti si guidano dai token (niente classi custom). Dai mockup:
| Intento | bg | testo | bordo | radius | Esempio nel mockup |
|---|---|---|---|---|---|
| **btn primary** | `--color-primary` | `--color-on-primary` | — | `rounded-xl` | "Crea Jingle", "Continua", "Aggiungi file" |
| **btn youtube** | `--color-danger` | `--color-on-danger` | — | `rounded-xl` | "Carica da Youtube" |
| **btn danger-ghost** | `color-mix(… danger 10%, transparent)` | `--color-danger` | `color-mix(… danger 40%, transparent)` | `rounded-xl` | "Elimina" |
| **btn neutral** | `--color-surface` | `--color-muted` | — | `rounded-xl` | "Annulla" |
| **upload vuota** | trasparente | — | dashed `--color-primary` | `rounded-lg` | "Carica file audio/immagine" |
| **upload piena** | `color-mix(… primary 12%, surface)` | `--color-fg` | — | `rounded-lg` | card "nomefile.mp3" con ✕ |
| **search box** | `--color-control` | placeholder `--color-muted` | — | `rounded-lg` | "Cerca" |
| **card jingle** | immagine + tint `--card-color` | `--color-fg` | `--card-color` | `rounded-2xl` | griglia jingle |
| **color dot selez.** | il colore | — | anello `#fff` (offset) | `rounded-full` | "Colore scheda" |

> Le 4 varianti bottone corrispondono già a `ui-button` (`primary`/`youtube`/`alert`→danger-ghost/`neutral`):
> in migrazione si tengono i 4 nomi ma lo stile arriva dai token, non dalle classi `.jm-btn-*`.

### 3.7 Spaziatura / gap
La scala di spacing è quella **nativa di Tailwind** (`p-4`, `gap-2`, `h-15`…): **non** si tokenizza, per non
gonfiare il sistema. Si usano le utility direttamente nei template.

> Per il jingle, il colore per-card resta una CSS var **runtime già esistente** (`--card-color`,
> impostata inline sulla card): coerente con questo sistema, nessun cambiamento.

### 3.8 Z-index — scala esplicita allineata a ng-zorro
ng-zorro (antd 4) ha una **sua scala interna** di z-index per gli overlay (verificata sul tema antd 4).
La esplicitiamo in **CSS var semantiche** su `:root` così i **nostri** overlay si incastrano nei punti
giusti senza numeri magici e senza guerre di `!important`.

> ⚠️ In Tailwind v4 lo z-index **non** è un namespace di `@theme` (le utility `z-*` accettano numeri nudi:
> `z-50`, `z-[1000]`). Quindi qui i `--z-*` sono **CSS var nostre** (non generano utility): si usano in CSS
> con `var(--z-modal)` o nel template con `z-[var(--z-modal)]`. Se servisse spesso un'utility, si crea con `@utility`.

| Token (nostro) | Valore | Componente ng-zorro corrispondente |
|---|---|---|
| `--z-affix` | `10` | affix, back-top, picker-panel, popup-close |
| `--z-modal` | `1000` | `nz-modal` + mask (`@zindex-modal`/`-mask`) |
| `--z-message` | `1010` | `nz-message` (toast) |
| `--z-notification` | `1010` | `nz-notification` |
| `--z-popover` | `1030` | `nz-popover` |
| `--z-dropdown` | `1050` | `nz-dropdown`, `nz-select`, `nz-date-picker` |
| `--z-popconfirm` | `1060` | `nz-popconfirm` |
| `--z-tooltip` | `1070` | `nz-tooltip` |
| `--z-image` | `1080` | image preview |

> Regola: un nostro overlay custom **riusa** uno di questi token (o un valore *fra* due livelli noti),
> mai un numero arbitrario. Es. un drawer custom sopra il modale ma sotto i toast → `z-[calc(var(--z-modal)+5)]`.
> Questi token sono **strutturali** (uguali in tutti i temi): stanno in `@layer base`, non nei file-tema.

### 3.9 Contrasto (verifica WCAG)
Non esiste (2026) una funzione CSS auto-contrasto affidabile (`color-contrast()` ha supporto scarso) →
il contrasto si garantisce coi **token `on-*`** accoppiati. Rapporti verificati (testo/sfondo):
- `fg`/`heading`/`primary`/`on-primary`/`on-success`/`on-warning`: **AA** pieno (≥4.5).
- `muted` .55 su superfici scure: ≥AA.
- `on-danger` (bianco/rosso) e `on-info`: **AA-large** (≥3) → ok per testo grande dei bottoni.
- Nomi card (bianco) su accent chiari: garantiti da **text-shadow scuro** (outline), non dal solo colore.
- `disabled` (.30): basso di proposito (stato disabilitato, esente WCAG).

> Per ri-verificare dopo un cambio palette: c'è uno snippet Node di calcolo contrasto nello storico di
> `MEMO.md` (luminanza relativa + composizione alpha del bianco semitrasparente).

---

## 4. Struttura file (`client/src/styles/`)

```
styles/
  themes/
    default.scss       # tema DEFAULT: blocco @theme { --color-* … } → definisce i valori E genera le utility
    <nome>.scss        # [futuro] altri temi: :root[data-theme="x"] { --color-*: … } → solo override delle var
  tokens.css           # token strutturali non-tema: @layer base { :root { --z-*, body, focus } }
  styles.css           # UNICA entry Tailwind (.css obbligatorio): @import ng-zorro precompilato + tailwind + tokens + temi
  ng-zorro.scss        # override componenti ng-zorro, dentro @layer components, SOLO var(--color-*) (+ color-mix)
```
> ⚠️ **Niente più `theme.less`.** Nel sistema a token il theming passa **solo** dagli override CSS-var
> (`ng-zorro.scss`), quindi non serve ricompilare il Less di ng-zorro: importiamo il suo **CSS già
> precompilato** dentro un layer (vedi §5/§7). Un file e un preprocessore in meno.

> 📝 **Estensioni.** `styles.css` **deve** restare `.css` (è l'entry Tailwind; Sass non risolve
> `@import "tailwindcss"`). I file-tema possono essere **`.scss`** (per coerenza/convenzione) perché vengono
> `@import`-ati *dentro* la pipeline Tailwind → letti come CSS. ⚠️ Conseguenza: in quei `.scss` **Sass non
> gira davvero** (niente nesting/`$var`/mixin): contengono solo `@theme { --token }`.

`angular.json` → `styles`: **`styles.css` è l'unica entry Tailwind** (deve contenere `@theme` e gli `@import`
nella stessa pipeline, altrimenti le utility non vengono generate); va **per prima**.
```jsonc
"styles": [
  "src/styles/styles.css",     // PRIMA: @import ng-zorro precompilato + tailwind + tokens.css + themes/*
  "src/styles/ng-zorro.scss"   // override ng-zorro → @layer components (entry Sass separata)
]
```
> **Un solo meccanismo di caricamento**: i file-tema e `tokens.css` si caricano con `@import` **dentro
> `styles.css`** (così `@theme` entra nella pipeline Tailwind), **non** come entry separate in `angular.json`.
> Dettaglio su **come** si innestano i layer (e perché elimina gli `!important`) → §5.

---

## 5. Cascade layers (`@layer`) — l'ordine che elimina gli `!important`

**Problema attuale.** ng-zorro compilato è CSS **"unlayered"** (fuori da ogni `@layer`). In CSS gli stili
unlayered **vincono su qualsiasi `@layer`**. Tailwind v4 mette le sue utility nel layer `utilities` →
quindi oggi **ng-zorro batte le utility Tailwind**, ed è per questo che `ng-zorro.scss` usa tanti `!important`.

**Vincolo aggiuntivo (verificato sul campo).** ng-zorro **non** può stare nel layer più basso: il **Preflight**
di Tailwind (nel layer `base`) azzera `margin/padding/border` su *ogni* elemento → se `ngzorro` sta sotto
`base`, il reset **distrugge il layout** dei componenti ng-zorro (modali scentrate, bottoni senza spaziatura).
Quindi serve: **`base` (Preflight) < `ngzorro` < `components` (nostri override) < `utilities`**.

**Soluzione (verificata sull'output).** Si **dichiara l'ordine esplicito** in cima a `styles.css`
(Tailwind v4 lo **rispetta**), poi si importa tutto:

```css
/* 1. Ordine esplicito: Preflight(base) PRIMA di ngzorro; nostri override in components; utilities in cima. */
@layer theme, base, ngzorro, components, utilities;

/* 2. Tailwind (emette theme/base/components/utilities). */
@import 'tailwindcss';

/* 3. ng-zorro PRECOMPILATO → layer ngzorro (sopra Preflight, sotto i nostri override). */
@import 'ng-zorro-antd/ng-zorro-antd.dark.min.css' layer(ngzorro);

/* 4. Token + temi (con @theme) nella stessa pipeline. */
@import './tokens.css';
@import './themes/default.scss';   /* + eventuali altri temi */
```
`ng-zorro.scss` (entry Sass separata) avvolge i suoi override in **`@layer components { … }`** (si fonde col layer `components` di Tailwind, sopra `ngzorro`).

Ordine effettivo (dal più debole al più forte): **theme → base(Preflight) → ngzorro → components(override) → utilities → (unlayered)**.

> ⚠️ **Verificato, da rispettare:** la dichiarazione `@layer theme, base, ngzorro, components, utilities;`
> **viene onorata** da Tailwind v4 (compare in testa all'output) → l'ordine NON dipende dalla posizione degli
> `@import`. Il resolver Tailwind risolve sia il package bare `ng-zorro-antd/…dark.min.css` sia i file-tema
> `.scss`. Niente più dubbio Less+`@layer`: è CSS puro nella pipeline PostCSS.

**Regola operativa:** prima di scrivere `!important`, chiediti se basta spostare la regola in un layer più
alto. Gli `!important` residui ammessi **solo** dove ng-zorro applica stili inline o `!important` propri
(rari) — vanno commentati col perché.

---

## 6. Tailwind `@theme` — i valori del tema default

I valori del tema default vivono in **`themes/default.scss`** dentro un blocco **`@theme static`** (sta nel
layer `theme` di Tailwind). Definirli lì **genera anche le utility** (`bg-primary`, `rounded-xl`…):

```css
/* `static` = forza l'emissione di TUTTE le var in :root anche se nessuna utility le usa
   (servono a ng-zorro.scss, file separato che Tailwind non scansiona → altrimenti vengono eliminate). */
@theme static {
  --color-primary: #45fff3;   --color-on-primary: #00201c;
  --color-danger:  #ff4548;   --color-on-danger:  #ffffff;
  --color-success: #52c41a;   --color-on-success: #00201c;
  --color-warning: #ffb700;   --color-on-warning: #00201c;
  --color-info:    #1890ff;   --color-on-info:    #ffffff;
  --color-page: #00201c;  --color-surface: #001714;  --color-control: #005147;  --color-control-hover: #006659;
  --color-fg: rgb(255 255 255 / .85);  --color-muted: rgb(255 255 255 / .55);
  --color-heading: rgb(255 255 255 / .88);  --color-disabled: rgb(255 255 255 / .30);
  --color-border: rgb(255 255 255 / .12);   --color-border-subtle: rgb(255 255 255 / .08);
  --radius-lg: 20px;  --radius-xl: 30px;  --radius-2xl: 40px;
  --font-sans: 'Inter', system-ui, sans-serif;
}
```
> ⚠️ **`@theme static` è obbligatorio qui**: senza `static`, Tailwind v4 emette in `:root` solo le var che
> vede "usate" nei file che scansiona. Le var consumate **solo** da `ng-zorro.scss` (`--color-surface`,
> `--color-control`…) verrebbero eliminate → `var()` non risolve → **sfondi trasparenti**. (Bug realmente incontrato.)

Le utility **referenziano** la var (`.bg-primary{background:var(--color-primary)}`), quindi un tema in più
che ridefinisce `--color-primary` cambia tutto **senza rebuild**. Niente `@theme inline` (servirebbe solo
se un token referenziasse un altro token).

> ⚠️ **Specificità (importante per il runtime).** `@theme` emette le var su `:root` (specificità `0,1,0`).
> Un override scritto come `[data-theme="ocean"]` ha la **stessa** specificità → vincerebbe solo per ordine,
> fragile. Scrivi sempre l'override come **`:root[data-theme="ocean"] { … }`** (`0,2,0`) così batte `:root`
> in modo deterministico, indipendentemente dall'ordine di caricamento.

---

## 7. ng-zorro — come consuma i token

ng-zorro 21 resta su **CSS** (la modalità "CSS variable" dinamica è **sperimentale e limitata** —
vedi §11: la teniamo fuori per stabilità). Approccio **a due strati**, semplice e robusto:

1. **Base precompilata**: si importa `ng-zorro-antd/ng-zorro-antd.dark.min.css` nel layer `ngzorro` (§5).
   Dà la struttura + un dark **neutro** (grigi di antd) **una volta sola**, senza compilare Less.
2. **`ng-zorro.scss`** (nel layer `components`) **ridipinge solo i pezzi di brand** (primary, danger,
   superfici, raggi) sulle classi `.ant-*` con **`var(--color-*)`**; i derivati (hover/active, prima `fade()`)
   con **`color-mix()`**. Grazie ai layer, **niente `!important`**:
   ```scss
   @layer components {
     .ant-btn-primary { background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--radius-xl); }
     .ant-btn-primary:hover { background: color-mix(in srgb, var(--color-primary) 88%, white); }
     .ant-input, .ant-input-affix-wrapper { background: var(--color-control); border-radius: var(--radius-lg); }
     .ant-input:focus { border-color: var(--color-primary); }
     .ant-modal-content { background: var(--color-surface); border-radius: var(--radius-xl); }
   }
   ```

> **Trade-off da tenere a mente:** la base precompilata è il dark **neutro** di antd → le superfici/colori di
> brand vanno ridipinti negli override (background dei componenti che usiamo, primary, link, bordi). Il
> **set di componenti in uso è piccolo** (button, input, modal, select, tag, slider, spin, message) → la
> superficie di override resta contenuta. Non re-implementiamo ng-zorro, ritematizziamo solo ciò che si vede.

---

## 8. Tag nativi (requisito: niente classi custom)

Per gli elementi **non** ng-zorro si stilizzano i **tag e gli stati** in `@layer base` (styles.css/tokens.css),
sempre via token. Qui vivono anche i token strutturali (`--z-*`). Esempi:
```css
@layer base {
  :root { --z-modal: 1000; --z-tooltip: 1070; /* …vedi §3.8 */ }
  body { background: var(--color-page); color: var(--color-fg); font-family: var(--font-sans); }
  textarea { background: var(--color-control); border-radius: var(--radius-lg); color: var(--color-fg); }
  input[type="checkbox"]:checked { accent-color: var(--color-primary); }
  /* Focus ring SOLO sui tag nativi: ng-zorro ha già il suo focus (bordo cyan) → non lo tocchiamo. */
  button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--color-primary); outline-offset: 2px;
  }
}
```
→ un `<input type="password">` o un `<button>` "nudo" risultano già tematizzati, senza aggiungere classi.

---

## 9. Selezione del tema

### Build-time (ora)
- **Default = il blocco `@theme`** (`themes/default.scss`, `@import`-ato in `styles.css`): se `<html>` non ha
  `data-theme`, valgono quei valori. Zero config per il caso base.
- Per buildare con un tema diverso (quando esisterà): impostare `data-theme="ocean"` su `<html>` in
  `index.html`, **oppure** tenere un `styles.css` alternativo per `configuration` (es. `--configuration=ocean`)
  che `@import`-a un file-tema diverso. (Da decidere col 2° tema; non serve ora.)

### Runtime (dopo)
Tutti i temi `@import`-ati insieme (ognuno sotto `:root[data-theme="x"]`); si cambia con **una riga**:
```ts
document.documentElement.dataset.theme = 'ocean'; // + persistenza in localStorage
```
Nessun rebuild, nessun flash: le CSS var si ri-risolvono istantaneamente. Le var stanno su `<html>` →
**anche gli overlay CDK di ng-zorro** (modali/dropdown appesi a `<body>`) ereditano il tema. Un piccolo
`ThemeService` (signal) gestirà selezione + persistenza quando serve.

---

## 10. Ricetta: aggiungere un nuovo tema

1. Crea `styles/themes/ocean.scss` con un blocco **`:root[data-theme="ocean"] { … }`** (selettore `0,2,0` → batte `:root`, vedi §6).
2. Copiaci dentro le righe `--color-*` del default (§6) e cambiane i **valori** (stesso set di nomi!).
   Puoi ridefinire anche `--radius-*` se vuoi un tema più/meno arrotondato.
3. Aggiungi **una riga** `@import './themes/ocean.scss';` in `styles.css` (stessa pipeline Tailwind).
4. Attiva: `data-theme="ocean"` su `<html>` (build) o `themeService.set('ocean')` (runtime).

**Non serve toccare** `ng-zorro.scss`, `tokens.css` né alcun template: consumano le var, non i valori.
(Il default sta in `@theme` perché è anche ciò che fa *generare* le utility; i temi extra sono soli override.)

---

## 11. Regole / cosa NON fare

- ❌ Nessun colore/raggio **letterale** nei template o nei `.scss` (`#45fff3`, `rounded-[20px]`,
  `bg-[#00201c]`) → usa l'utility da token (`bg-primary`, `rounded-xl`) o `var(--color-*)`.
- ❌ Niente classi di styling custom (`.jm-btn-*`, `.jw-*`): vanno migrate a utility-da-token o a
  override su tag/classi ng-zorro (vedi checklist §12).
- ❌ **`!important` ridotto al minimo**: prima di scriverlo, sposta la regola nel layer giusto (§5).
  Ammesso solo dove ng-zorro usa stili inline o `!important` propri → **commenta sempre il perché**.
- ❌ Niente z-index **arbitrari**: riusa i token `--z-*` (§3.8) o un valore *fra* due livelli noti.
- ❌ Non abilitare la modalità **CSS-variable di ng-zorro** (sperimentale, copre poche variabili): l'ibrido §7 è più stabile.
- ✅ Un nuovo valore tematizzabile = **prima un token** in `@theme` (default), poi lo si consuma.
- ✅ Tint/stati con `color-mix()`, non nuovi token, finché basta.

---

## 12. Checklist di migrazione (dallo stato attuale)

Lo stato di oggi mescola token in 3 posti (Less, `.jm-*` con hex, `.ant-*` con hex e `!important`).
Migrazione al sistema a token, **a piccoli passi** (ogni passo builda):

- [x] In `styles.css`: `@import ng-zorro…dark.min.css layer(ngzorro)` (PRIMA di tailwind) + `@import 'tailwindcss'`
      + `@import tokens.css` + `@import themes/default.scss`. (Niente order-statement custom: Tailwind lo scarta.)
- [x] **Rimuovere `theme.less`** da `angular.json` e dal repo (sostituito dall'import precompilato). Build verde.
- [x] Creare `themes/default.scss` con il blocco `@theme { --color-*, --radius-*, --font-sans }` (valori = §6).
- [x] Creare `tokens.css`: `@layer base { :root { --z-* (§3.8) }, body, focus tag nativi }` (§8).
- [x] Riscrivere `ng-zorro.scss` dentro `@layer components`: ridipingere il brand sui `.ant-*` con
      `var(--color-*)` + `color-mix()`, **senza `!important`** (layer order sufficiente).
- [ ] Migrare le classi `.jm-btn-*` → varianti di `ui-button` che stilano `.ant-btn`/tag via token
      (oppure utility-da-token), e `.jm-card`/`.jm-tag`/`.jm-search-box`/`.jm-upload-area` → utility-da-token.
- [ ] Aggiornare i template (`bg-[#…]`, `rounded-[…]` → utility semantiche; z-index arbitrari → `z-[var(--z-…)]`).
- [ ] Aggiornare `/stylesheet`: palette, tipografia, i 3 layer (page/surface/control) e la scala z-index dai token.
- [ ] `cd client && npm run build` verde + verifica visiva che gli `!important` rimossi non abbiano rotto nulla.

> 🔎 **Affinamento valori col Figma**: i valori default qui sono presi dal CSS attuale. Per renderli
> 1:1 col mockup si può estrarre la palette/raggi via **Figma MCP** (`get_variable_defs`/`get_design_context`)
> sul file <https://www.figma.com/design/wKTJuVY5rC1KI6NBEGVxkj/Jingle-Machine?node-id=0-1>. Step opzionale.

---

## 13. Riferimenti (verificati 2026-06)
- Tailwind v4 — Theme variables (`@theme`, `@theme inline`, runtime via `data-theme`):
  <https://tailwindcss.com/docs/theme>
- Tailwind v4 — Cascade layers / overriding di librerie senza `!important`:
  <https://css-tricks.com/using-css-cascade-layers-with-tailwind-utilities/> · <https://tailwindcss.com/blog/tailwindcss-v4>
- MDN — `@layer` (cascade layers) e priorità unlayered: <https://developer.mozilla.org/docs/Web/CSS/@layer>
- ng-zorro — Theme Customization (Less): <https://ng.ant.design/docs/customize-theme/en>
- ng-zorro — Dynamic Theme (**sperimentale**, CSS variable): <https://ng.ant.design/docs/customize-theme-variable/en>
- Z-index ng-zorro/antd 4 (scala §3.8): `antd@4` `style/themes/default.less` (`@zindex-*`)
- MDN — `color-mix()`: <https://developer.mozilla.org/docs/Web/CSS/color_value/color-mix>
</content>
</invoke>
