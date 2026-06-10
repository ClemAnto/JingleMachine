# 🧬 Blueprint di progetto — istruzioni per Claude

> **Cos'è questo file.** Una guida da copiare in un **nuovo progetto** per ricreare le stesse
> caratteristiche, convenzioni e modo di lavorare del progetto "Jingle Machine". Leggila per prima.
> Non descrive *cosa* fa quell'app, ma *come* è fatta e *come ci si lavora*: stack, pattern del codice,
> stile dei componenti, gestione degli stili, e il sistema di documentazione `.md`.

---

## 0. Preferenze dell'utente (la cosa più importante)

Queste guidano **ogni** decisione. Rispettarle prima di tutto il resto.

- **Gratis e senza carta di credito.** Rifiuta piani a pagamento se evitabili; cerca alternative free.
- **Semplicità e leggibilità.** Best practice del framework, **niente over-engineering**. Codice che si
  legge come quello già presente.
- **Pianificare prima di codare.** L'utente fa domande di architettura/costi/rischi *prima* di scrivere
  codice. Sviscera alternative, costi e rischi **prima**; non avere fretta di codare.
- **Verifica i fatti online**, non andare a memoria — soprattutto per cose che cambiano nel tempo
  (versioni di librerie, limiti dei piani free, comportamento di servizi esterni). L'utente si fida di più
  di un fatto verificato e datato che di un ricordo.
- **Principiante sul backend** → spiega i concetti in modo **elementare**, con analogie, e di' sempre il
  *perché* di una scelta.
- **Segnala sempre refusi / errori grammaticali** (italiano e inglese) che trovi in codice, stringhe,
  commenti o documentazione — anche se fuori dal task corrente. Non correggerli d'ufficio senza chiedere,
  a meno che non sia parte del task.

---

## 1. Lingua: regola ferrea

| Dove | Lingua |
|------|--------|
| Codice, commenti, log, identificatori (variabili, funzioni, classi) | **Inglese** sempre |
| Testi UI visibili all'utente | **Italiano** (pubblico italiano) |
| Documentazione (`.md`) | **Italiano** |

> Esempio reale: una funzione si chiama `describe(err)` e ritorna stringhe italiane come
> `'Email o password non corretti.'`. Codice inglese, messaggio utente italiano.

---

## 2. Stack di riferimento

Adatta le versioni a quelle **attuali** (verificale online: l'utente lo preferisce), ma il profilo è:

| Ambito | Tecnologia | Note |
|--------|-----------|------|
| Framework | **Angular standalone** (signals, `inject()`, zone.js) | niente NgModule |
| UI kit | **ng-zorro-antd** | componenti Ant Design |
| CSS utility | **Tailwind CSS v4** (via `@tailwindcss/postcss`) | niente `tailwind.config.js` se non serve |
| Backend-as-a-service | **Firebase JS SDK** (diretto, non `@angular/fire`) | vedi §6 |
| Hosting | **GitHub Pages** (GitHub Actions) | sito statico |

> ⚠️ **Non usare `@angular/fire`**: tende a non supportare subito l'ultima major di Angular. Usa l'SDK
> Firebase JS direttamente, incapsulato in piccoli service Angular. Vedi il pattern dei token DI in §6.

> ⚠️ **Verifica sempre online** prima di fissare le versioni e prima di scegliere un servizio "gratis":
> i limiti dei piani free cambiano (es. servizi che iniziano a richiedere la carta di credito).

---

## 3. Convenzioni di codice

### Naming
- **Nomi "puliti"**: solo `camelCase`, **niente** caratteri come `@`, `_`, `$`.
- **Observable senza suffisso `$`** → nomi espliciti tipo `userStream`, `userQueue` (preferenza esplicita).
- Componenti con nome di classe semplice (`Login`, non `LoginComponent`); selettore `app-<nome>`.

### Angular — pattern obbligatori
- **Componenti standalone** con `imports: [...]` nel decoratore. Mai NgModule.
- **Stato con signals**: `signal()`, `computed()`, `.set()`, `.update()`.
- **DI con `inject()`** nei campi della classe, non nel costruttore (il costruttore si usa solo per logica
  d'inizializzazione, es. sottoscrizioni).
- **Visibilità**: campi/metodi usati solo dal template → `protected readonly`; dipendenze interne →
  `private readonly`; API pubbliche del service → `readonly`.
- **Form**: Reactive Forms con `fb.nonNullable.group({...})` e `Validators`.
- **Template control flow nativo**: `@if`, `@for`, `@else` (niente `*ngIf` / `*ngFor`).
- **Commenti** solo dove servono davvero; non esagerare. Usa JSDoc `/** ... */` per spiegare scelte non
  ovvie (es. perché un signal parte `undefined`).
- **Usa sempre i pattern più recenti consigliati** dal framework; se in dubbio, **consulta la doc ufficiale
  online** prima di andare a memoria.

### Esempio — service con stato a signals
```ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(AUTH);
  private readonly userSignal = signal<User | null | undefined>(undefined);

  readonly user = computed(() => this.userSignal() ?? null);
  readonly isLoggedIn = computed(() => !!this.userSignal());

  loginWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }
}
```

### Esempio — componente standalone
```ts
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, NzButtonModule, NzFormModule, NzInputModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Wrapper che centralizza loading + gestione errori per ogni azione async.
  private async run(action: () => Promise<unknown>) {
    this.loading.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(this.describe(err)); // describe() → messaggio UI in italiano
    } finally {
      this.loading.set(false);
    }
  }
}
```

> Note di stile da imitare: template in file `.html` separato; un solo metodo privato `run()` che
> centralizza `loading`/`error`; mappatura dei codici d'errore in messaggi italiani leggibili.

---

## 4. Stili — Tailwind v4 + ng-zorro

Setup e regole che evitano i problemi tipici:

1. **Tailwind v4** si configura con `.postcssrc.json`:
   ```json
   { "plugins": { "@tailwindcss/postcss": {} } }
   ```
   e una sola riga in `src/styles.css`:
   ```css
   @import 'tailwindcss';
   ```
   Niente `tailwind.config.js` se non serve.

2. **Ordine degli stili in `angular.json`** — Tailwind **prima**, CSS di NgZorro **dopo**:
   ```json
   "styles": [
     "src/styles.css",
     "node_modules/ng-zorro-antd/ng-zorro-antd.min.css"
   ]
   ```
   > Perché: così il *preflight* (reset) di Tailwind non "resetta" l'aspetto dei componenti Ant Design.

3. **Layout con utility Tailwind** (flex, gap, padding, colori `slate`/`indigo`, `max-w-*`, `shadow-sm`);
   **componenti** (bottoni, form, card, alert, icone) con **ng-zorro** (`nz-button`, `nz-card`,
   `nz-form-item`, `nz-alert`, `nz-icon`).

4. **Icone NgZorro sono tree-shakable**: vanno **registrate una per una** in `app.config.ts`
   (array `icons` passato a `provideNzIcons`). Se usi una nuova icona nel template
   (`nz-icon nzType="..."`), aggiungila lì o non comparirà.

5. **Locale**: imposta `it_IT` (`provideNzI18n(it_IT)` + `registerLocaleData(it)`).

6. Stile globale in `src/styles.css`; eventuali stili di componente in `.scss`. Preferisci comunque le
   utility Tailwind nei template.

### Esempio — template (login.html)
```html
<nz-card [nzTitle]="mode() === 'login' ? 'Accedi' : 'Crea account'" class="w-full max-w-md shadow-sm">
  @if (error()) {
    <nz-alert nzType="error" [nzMessage]="error()!" class="mb-4" nzShowIcon></nz-alert>
  }
  <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
    <nz-form-item>
      <nz-form-label nzRequired>Email</nz-form-label>
      <nz-form-control nzErrorTip="Inserisci un'email valida.">
        <input nz-input type="email" formControlName="email" />
      </nz-form-control>
    </nz-form-item>
    <button nz-button nzType="primary" nzBlock [nzLoading]="loading()" type="submit">
      {{ mode() === 'login' ? 'Accedi' : 'Registrati' }}
    </button>
  </form>
</nz-card>
```
> Layout (`flex`, `max-w-md`, `mb-4`) = Tailwind; componenti (`nz-card`, `nz-form`, `nz-button`) = NgZorro;
> testi in **italiano**; logica via **signals** (`mode()`, `error()`, `loading()`).

### app.config.ts (provider centralizzati)
```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideNzI18n(it_IT),
    provideNzIcons(icons),   // <-- registra qui le icone usate nei template
    provideFirebase(),       // <-- provider custom (vedi §6)
  ],
};
```

---

## 5. Come creare un nuovo componente / service (ricetta)

1. Genera con lo schematics (componente standalone + scss):
   ```bash
   ng g component features/<nome>     # componenti di feature
   ng g service core/<nome>           # service condivisi (stato, API)
   ```
2. **Struttura cartelle**:
   - `core/` → service trasversali (auth, providers DI, wrapper di librerie, guard).
   - `features/<area>/` → componenti di pagina/feature, con il loro `.html`.
3. Componente: standalone, `imports` espliciti, stato a `signal`, dipendenze via `inject()`.
4. Service: `@Injectable({ providedIn: 'root' })`, stato interno in un `signal` privato, espone
   `computed`/metodi pubblici `readonly`.
5. UI in italiano, codice/commenti in inglese.
6. Se usi una nuova icona → registrala in `app.config.ts`.

---

## 6. Firebase senza `@angular/fire` — pattern dei token DI

Incapsula l'SDK Firebase JS in **token di injection**, così i service restano testabili e disaccoppiati:

```ts
// core/firebase.providers.ts
export const AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIREBASE_FIRESTORE');

export function provideFirebase(): EnvironmentProviders {
  const app = initializeApp(environment.firebase);
  return makeEnvironmentProviders([
    { provide: AUTH, useValue: getAuth(app) },
    { provide: FIRESTORE, useValue: getFirestore(app) },
  ]);
}
```
Poi nei service: `private readonly auth = inject(AUTH);`

> La config Firebase (`environment.firebase`) **non è segreta**: la web config è pensata per stare nel
> client. La sicurezza reale la fanno le **Security Rules**. Tienile in una cartella `firebase/`.

---

## 7. Il sistema di documentazione `.md` (da replicare)

Il progetto si tiene "pronto" tramite pochi file `.md` con ruoli distinti. **Replicali nel nuovo progetto.**

| File | Ruolo | Quando aggiornarlo |
|------|-------|--------------------|
| **`MEMO.md`** | Fonte di verità **operativa**: setup, comandi, struttura, **decisioni architetturali + il perché**, fatti verificati (datati), trappole risolte, limiti noti. | Ogni volta che cambia qualcosa (versioni, decisioni, trucchi). |
| **`ROADMAP.md`** | Piano a **fasi con checklist** (`[ ]`/`[x]`) + sezione "Dove eravamo / Prossimo passo". | A ogni avanzamento: spunta gli item, aggiorna lo stato. |
| **`CLAUDE.md`** | Convenzioni di lavoro, **preferenze dell'utente**, come prendere le decisioni, tabella "quando leggere quale `.md`". | Quando emergono nuove convenzioni/preferenze. |
| `README.md` | Comandi base (anche autogenerato). Poco rilevante: preferisci `MEMO.md`. | Raramente. |

Regole:
- **Documentazione in italiano**, azionabile e concisa — niente muri di testo.
- I **fatti deperibili** (versioni, limiti free, comportamenti di servizi) vanno **datati** e marcati come
  tali, perché vanno riverificati nel tempo.
- Registra **le opzioni scartate e il perché**, così non vengono riproposte.
- Registra le **trappole risolte** con la soluzione ("non riproporre").
- Se aggiungi un nuovo `.md`, **aggiungilo alla tabella** in `CLAUDE.md`.

### Il rituale «chiudo» (istruzione permanente in `CLAUDE.md`)
Definisci in `CLAUDE.md` un comando: quando l'utente scrive **`chiudo`**, PRIMA di rispondere:
1. **Analizza la chat** ed estrai ciò che sarà utile al *te* futuro per decidere meglio e più in fretta:
   decisioni prese + perché; opzioni scartate + motivo; preferenze/stile dell'utente emersi; fatti
   verificati (datati); trappole incontrate e come evitarle.
2. **Scrivi** nei file giusti senza duplicare: `MEMO.md` (tecnico/architetturale), `ROADMAP.md`
   (avanzamento + prossimi passi), `CLAUDE.md` (convenzioni/preferenze).
3. **Riassumi in chat** cosa hai scritto e dove.

> Obiettivo: ogni sessione lascia il progetto più "pronto" della precedente.

---

## 8. Prima di consegnare una modifica

1. `npm run build` deve passare (è il check più affidabile: type-check + bundling).
2. Se tocchi i test: `npm test`.
3. Aggiorna i `.md` pertinenti se hai preso decisioni o cambiato struttura.
4. Verifica di non aver introdotto refusi (e segnala quelli che incontri).

> Lancia i comandi `npm` nella cartella dell'app Angular (il `client/`).

---

## 9. Checklist rapida per il nuovo progetto

- [ ] Confermare con l'utente lo scopo e l'architettura (gratis/no-carta) **prima** di codare.
- [ ] Verificare online le versioni attuali di Angular / ng-zorro / Tailwind / Firebase SDK.
- [ ] Scaffold Angular standalone + signals.
- [ ] Tailwind v4 (`.postcssrc.json` + `@import 'tailwindcss'`), ordine stili in `angular.json` (Tailwind → NgZorro).
- [ ] Locale `it_IT`; provider centralizzati in `app.config.ts`.
- [ ] Firebase via token DI custom (non `@angular/fire`); config in `environment.ts`; rules in `firebase/`.
- [ ] Creare `MEMO.md`, `ROADMAP.md`, `CLAUDE.md` (con preferenze utente, tabella `.md` e rituale «chiudo»).
- [ ] Convenzioni: codice/commenti in inglese, UI in italiano, nomi camelCase puliti, no suffisso `$`.
```
