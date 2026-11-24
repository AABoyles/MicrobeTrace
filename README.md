[![MicrobeTrace](https://raw.githubusercontent.com/aaboyles/MicrobeTrace/master/img/android-chrome-192x192.png "MicrobeTrace")](https://aaboyles.github.io/MicrobeTrace/)

# MicrobeTrace [![MicrobeTrace DOI](https://img.shields.io/badge/DOI-10.1101%2F2020.07.22.216275-blue)](https://doi.org/10.1101/2020.07.22.216275)

*The Visualization Multitool for Molecular Epidemiology and Bioinformatics*

MicrobeTrace began at the US Centers for Disease Control and Prevention (CDC), where it was developed by [some folks](https://github.com/aaboyles/MicrobeTrace/blob/master/humans.txt). This copy is maintained independently at <https://aaboyles.github.io/MicrobeTrace/>. CDC does not operate or endorse it.

## To Use MicrobeTrace:

* **[Launch MicrobeTrace](https://aaboyles.github.io/MicrobeTrace/)**
* [Download Sample Data](https://github.com/aaboyles/MicrobeTrace/raw/master/demo/MicrobetraceDemoData.zip)
* [View the Help Wiki](https://github.com/aaboyles/MicrobeTrace/wiki)
* [Watch and follow along with the webinar](https://www.youtube.com/watch?v=5E-_Kb7yvHU)
* [Watch how to use MicrobeTrace for COVID-19](https://www.youtube.com/watch?v=he0Yq5yvToc)
* [Cite MicrobeTrace](https://github.com/aaboyles/MicrobeTrace/wiki/Cite-MicrobeTrace)

## To Run Your Own Server:

```sh
npm ci && npm start                 # http://localhost:5000 (PORT sets the port)
docker build -t microbetrace . && docker run -p 5000:5000 microbetrace
```

`dist/`, `vendor/`, `fonts/` and `sw.js` are built from `node_modules`, not stored in the repository, so a copy of the repository does not run on its own: `npm start` builds them the first time (`scripts/ensure-built.js`, which needs the dev dependencies), the Docker image builds them, and to deploy to a static host run `npm ci && npm run bundle && npm run cache && npm run site` and publish `_site/`.

The server serves only the files the app needs (the same list the GitHub Pages
deploy publishes, `scripts/build-site.js`); anything else is a 404. `/health`
answers `{"status":"ok"}`. By default it speaks plain HTTP. Behind a proxy or
load balancer that terminates TLS and sets `X-Forwarded-Proto`, set
`FORCE_HTTPS=1` to redirect HTTP requests to HTTPS. `SITE_DIR=_site` serves a
directory built by `npm run site` instead (the Docker image does this).

## Development

MicrobeTrace needs **Node.js 26**, the version in `engines` in `package.json` and used by CI and the Docker image.

```sh
npm ci                            # install the locked dependencies
npm start                         # serve the app at http://localhost:5000
npm test                          # unit tests (no browser needed)
npx playwright install chromium   # once: the browser for the end-to-end tests
npm run test:e2e                  # end-to-end tests in Chromium (E2E_PORT sets the port)
```

The build scripts (see [scripts/README.md](scripts/README.md)):

* `npm run bundle` builds `dist/`, `fonts/` and the generated files in `vendor/` from `node_modules`. None of them is committed; `npm start`, `npm test`, `npm run coverage` and the E2E web server run it when `dist/` is missing or its inputs have changed (the hash in `dist/versions.json`, not file times), and CI, the Docker build and the Pages deploy run it. Run it yourself after changing a dependency or `scripts/bundle.js`.
* `npm run cache` writes `sw.js` (also not committed) from `scripts/sw.template.js`, filling in the precache list and cache name from the files that exist, so run it after `bundle`. Edit the template, not `sw.js`.
* `npm run site` copies exactly the files the app needs into `_site/`, with a `.br` and a `.gz` copy of each text file, which `server.js` sends to browsers that accept them (`SITE_DIR=_site npm start` serves it; the Docker image does).
* `npm run build` runs `bundle`, `cache` and `site`. `npm run update` updates the dependencies and then runs `bundle` and `cache`.

**Deployment.** A push to `master` runs `.github/workflows/pages.yml`. It runs the CI workflow (`.github/workflows/ci.yml`: unit tests and the end-to-end tests, on a fresh `npm run bundle && npm run cache`) and, if those pass, bundles the app (`npm run bundle && npm run cache`) and publishes the output of `scripts/build-site.js` to GitHub Pages. Pull requests run the CI workflow alone.

**Browsers.** The app names Chrome, Firefox, Safari and Edge as the browsers to use. At startup it checks for WebAssembly, Web Workers and IndexedDB, and a browser without one of them gets a message saying which it lacks (`src/index.js`). The end-to-end tests run in Chromium only (`playwright.config.js`).

**How the code fits together.** `index.html` is the one page: its menus, dialogs and Content-Security-Policy, which allows no inline scripts. `src/index.js` starts the page (the menus, global settings, color tables and global timeline), `src/mt.js` builds the page's `MT` with `createMT` from `src/common.js` (the session model and the work pipeline, also an ES module). The other modules beside it hold what the views share: `src/loading.js` (reading files and sessions), `src/links-clusters.js`, `src/colors.js`, `src/export.js`, `src/views.js` (the layout and panels) and `src/ui.js`, each installed onto `MT`, and `src/graph.js`, `src/nodes.js` and `src/session.js` hold the network, the values each file gives its nodes, and the session's data (written through `MT.session`). File formats are one module each in `src/formats/`. Each view is an HTML fragment and an ES module in `components/`, which `src/views.js` imports and mounts in a golden-layout panel when the view opens. Heavy work runs in Web Workers in `workers/`, started with `MT.runWorker`: parsing, distances, alignment, trees and clustering. Third-party libraries are bundled into `dist/`, and those that workers must load are in `vendor/`. `sw.js` is the service worker that keeps the app working offline, and `server.js` serves the same files under `npm start`.

More detail is in the READMEs next to the code: [`src/webmcp/`](src/webmcp/README.md), [`workers/`](workers/README.md), [`vendor/`](vendor/README.md), [`scripts/`](scripts/README.md), [`data/`](data/README.md), [`demo/`](demo/README.md), [`test/unit/`](test/unit/README.md), [`test/e2e/`](test/e2e/README.md), [`test/golden/`](test/golden/README.md) and [`test/security/`](test/security/README.md).

## AI Agents (WebMCP)

MicrobeTrace offers its features as tools for AI agents through [WebMCP](https://webmachinelearning.github.io/webmcp/), a draft web standard for exposing tools to agents in the browser. An agent can load files, launch a network, query and style nodes and links, and draw views, using the same operations as the interface. The tools are described in [src/webmcp/README.md](src/webmcp/README.md), which also covers the filter language, an example workflow and how to add a tool. The tools work without WebMCP too, through `MTWebMCP.call` in the page.

## To Spread the Word:

* [Read our Reports](https://medium.com/microbetrace-reports/latest)
* [Connect with our User Community](https://www.reddit.com/r/MicrobeTrace/)

## To Help Us Build:

* [Report Bugs or Request Features](https://github.com/aaboyles/MicrobeTrace/issues)
* [Deploy Your Own Instance of MicrobeTrace](https://github.com/aaboyles/MicrobeTrace/wiki/z-Deployment)
* [Help us Develop MicrobeTrace](https://github.com/aaboyles/MicrobeTrace/wiki/z-Development)
* To log timings and other developer messages to the browser console, open MicrobeTrace with `?debug` in the address, or run `localStorage.setItem('MT.debug', '1')` and reload. Both are off by default.

## License
MicrobeTrace is licensed under the [Apache License, Version 2.0](LICENSE).
See also the [NOTICE](NOTICE) file.

MicrobeTrace was originally developed at the US Centers for Disease Control and
Prevention; that original work was released into the public domain, and
subsequent work in this repository is licensed under Apache-2.0.

Unless required by applicable law or agreed to in writing, the software is
distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
See the [LICENSE](LICENSE) for the specific language governing permissions and
limitations.

## Privacy

* **Your data stays in your browser.** Files you load are processed on your computer by the page's own scripts and workers. They are not uploaded anywhere.
* **What is stored locally.** Stashed sessions, and autostashes if you turn Session Recovery on, are complete sessions (sequences and case attributes included). They are kept unencrypted in this browser's IndexedDB (database `MicrobeTrace`, which also holds your accepted license), persist after the tab closes, and can be read by anyone with access to the browser profile. If that matters, such as on a shared workstation, don't stash, or delete them. The service worker keeps an offline copy of the app in the browser's Cache Storage. The WebMCP on/off choice is kept in `sessionStorage` for the tab only. Nothing is kept in `localStorage` or the origin-private file system.
* **Delete it all.** In the app, open Help > About and choose "Delete everything stored in this browser". It clears the IndexedDB stashes, the caches, the service worker and the other storage listed above, after asking you to confirm.
* **Third parties.** None. The map draws its countries, states and counties from files that come with MicrobeTrace, so nothing is sent to any third party, and there is no analytics or tracking (the Content-Security-Policy in `index.html` allows no other hosts). If you deploy your own copy, your web host will see ordinary access logs for the page itself.
* **AI agents.** If you switch on [WebMCP](src/webmcp/README.md) (off by default, and for the current tab only), AI agents running in your browser can read and change the whole session, including its data. Leave it off when you don't want that.

## Contributing
Anyone is encouraged to contribute to the project by [forking](https://help.github.com/articles/fork-a-repo)
and submitting a pull request. (If you are new to GitHub, you might start with a
[basic tutorial](https://help.github.com/articles/set-up-git).) By contributing
to this project, you agree that your contribution is submitted under the
[Apache License, Version 2.0](LICENSE), as described in section 5 of that
license (inbound = outbound).

Before you get started, please read the [Developer's Guide to MicrobeTrace.](https://github.com/aaboyles/MicrobeTrace/wiki/z-Development)

## Origin and Disclaimer
MicrobeTrace began at the US Centers for Disease Control and Prevention (CDC).
This copy is maintained independently by its contributors. It is not operated,
supported or endorsed by CDC. Get help or report bugs through
[GitHub Issues](https://github.com/AABoyles/MicrobeTrace/issues), and report
security problems as described in [SECURITY.md](SECURITY.md). The software is
provided "as is", without warranty of any kind; see [DISCLAIMER.md](DISCLAIMER.md).
