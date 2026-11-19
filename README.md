# Grid Assistant

Reusable Prompt Sparks and Prompt Gallery components for Fluent UI v9, with a
working grid-assistant example. The component collects structured prompts and
explicitly supplied grid context; your application owns data access and AI calls.

## Get started

Requires Node **22.18+** (or Node 24+) and npm. From this repository's root:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run dev
```

The lockfile pins versions and integrity hashes without machine-specific registry
URLs. npm uses your configured registry (the public npm registry by default).

Open **http://127.0.0.1:5187**. The example API runs at
**http://127.0.0.1:3017**. These loopback-only ports differ from the original
playground so both copies can run side by side. Stop both example servers with
Ctrl+C.

Grid selection, filtering, sorting, prompt sparks, and the gallery work without
an AI provider. AI chat reports an explicit configuration error until you set up
a real provider in `examples/playground/.env`; see the
[example guide](examples/playground/README.md). Never commit credentials.

## Repository layout

- [packages/react-prompts](packages/react-prompts): editable component source,
  utility and React unit tests, browser component tests, and Storybook examples.
- [examples/playground](examples/playground): React grid integration, local API,
  fictional order data, shared contracts, and end-to-end tests.
- [vendor](vendor): the MIT-licensed virtualized Fluent grid dependency snapshot.

The example is an npm workspace consumer of the local prompt package, not the
old prompt tarball. Its Vite alias loads the package's TypeScript source directly,
so component edits hot-reload with `npm.cmd run dev`. No Contrib checkout, Nx,
Yarn, package-refresh script, or personal filesystem path is required.

## Component development

See the [component API and behavior guide](packages/react-prompts/README.md).
Keep a terminal running `npm.cmd run dev`, then edit
`packages/react-prompts/src`. The public exports remain named
`@fluentui-contrib/react-prompts` for compatibility; this is an independent
repository, not an official package release. Packages are marked private to
prevent accidental npm publication.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:components
npm.cmd run test:e2e
```

- `build` emits the package's JavaScript/declarations and builds the example.
- `test` runs the package's Jest tests and the example's Node API tests.
- `test:components` runs the component's real-browser Chromium tests.
- `test:e2e` starts and stops its own example servers; stop `dev` first.
- `npm.cmd run storybook` opens the standalone examples on
  **http://127.0.0.1:6006**, without calling an AI provider.

The example backend is for local development, not authenticated production
hosting. Read its guide before connecting real business data or exposing it.

## Attribution and license

The component and grid dependency were extracted from the local
[Fluent UI Contrib](https://github.com/microsoft/fluentui-contrib) development
checkout, including local component additions. This repository starts with a
fresh history; it does not claim that those additions were released upstream.
Existing Microsoft copyright and MIT terms are retained in [LICENSE](LICENSE).
See [vendor/README.md](vendor/README.md) for the bundled dependency's provenance.
