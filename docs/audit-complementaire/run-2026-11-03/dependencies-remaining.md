# Dépendances encore signalées par npm

Date : 3 novembre 2026. Inventaire généré depuis les sept JSON finaux, sans suppression de signalement. Les dépendances parentes peuvent répéter un même avis.

## root

| Paquet | Gravité | Direct | Plage signalée | Correction proposée par npm |
|---|---|---|---|---|
| `minimatch` | moderate | non | `<11.0.1` | `nodemon@1.0.2` (changement majeur) |
| `nodemon` | moderate | oui | `0.0.0-development || 1.0.2-rc - 1.0.2-rc4 || >=1.0.3` | `nodemon@1.0.2` (changement majeur) |
| `npm-run-all` | moderate | oui | `>=1.2.0` | `npm-run-all@1.1.3` (changement majeur) |

Avis directs (les autres lignes sont des chaînes de propagation) :

- **moderate** — minimatch : [minimatch has potential denial of service via globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## backend

Aucun signalement dans cet audit.

## frontend

| Paquet | Gravité | Direct | Plage signalée | Correction proposée par npm |
|---|---|---|---|---|
| `@babel/eslint-parser` | moderate | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `@eslint-community/eslint-utils` | moderate | non | `*` | `react-scripts@0.0.0` (changement majeur) |
| `@eslint/eslintrc` | moderate | non | `0.0.1 || >=0.1.1` | `react-scripts@0.0.0` (changement majeur) |
| `@humanwhocodes/config-array` | moderate | non | `*` | `react-scripts@0.0.0` (changement majeur) |
| `@jest/core` | moderate | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `@jest/reporters` | moderate | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `@jest/test-sequencer` | moderate | non | `<=28.0.0-alpha.11` | Disponible annoncée ; voir chaîne JSON |
| `@jest/transform` | moderate | non | `*` | `react-scripts@0.0.0` (changement majeur) |
| `@rollup/plugin-node-resolve` | low | non | `>=8.0.0` | Disponible annoncée ; voir chaîne JSON |
| `@surma/rollup-plugin-off-main-thread` | moderate | non | `>=2.2.0` | Disponible annoncée ; voir chaîne JSON |
| `@svgr/plugin-svgo` | high | non | `*` | `react-scripts@0.0.0` (changement majeur) |
| `@svgr/webpack` | low | non | `>=5.5.0` | `react-scripts@0.0.0` (changement majeur) |
| `@tootallnate/once` | low | non | `<2.0.1` | Disponible annoncée ; voir chaîne JSON |
| `@typescript-eslint/eslint-plugin` | moderate | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `@typescript-eslint/experimental-utils` | moderate | non | `>=5.7.1-alpha.0` | Disponible annoncée ; voir chaîne JSON |
| `@typescript-eslint/parser` | moderate | non | `*` | `react-scripts@0.0.0` (changement majeur) |
| `@typescript-eslint/type-utils` | moderate | non | `>=5.9.2-alpha.0` | Disponible annoncée ; voir chaîne JSON |
| `@typescript-eslint/utils` | moderate | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `babel-jest` | moderate | non | `>=24.0.0-alpha.0` | `react-scripts@0.0.0` (changement majeur) |
| `babel-plugin-istanbul` | moderate | non | `>=5.0.1` | `react-scripts@0.0.0` (changement majeur) |
| `bfj` | high | non | `7.1.0 - 9.1.2` | Disponible annoncée ; voir chaîne JSON |
| `css-minimizer-webpack-plugin` | moderate | non | `1.1.4 - 7.0.4` | `react-scripts@0.0.0` (changement majeur) |
| `css-select` | high | non | `<=3.1.0` | `react-scripts@0.0.0` (changement majeur) |
| `deepmerge` | low | non | `>=4.2.0` | `react-scripts@0.0.0` (changement majeur) |
| `ejs` | moderate | non | `3.1.2 - 4.0.1` | Disponible annoncée ; voir chaîne JSON |
| `eslint` | moderate | non | `0.7.1 - 2.0.0-rc.1 || >=4.1.0` | `react-scripts@0.0.0` (changement majeur) |
| `eslint-config-react-app` | moderate | non | `>=0.3.0-alpha.9c45b252` | `react-scripts@0.0.0` (changement majeur) |
| `eslint-plugin-flowtype` | moderate | non | `>=3.10.5` | `react-scripts@0.0.0` (changement majeur) |
| `eslint-plugin-import` | moderate | non | `>=1.15.0` | `react-scripts@0.0.0` (changement majeur) |
| `eslint-plugin-jest` | moderate | non | `>=22.0.0` | Disponible annoncée ; voir chaîne JSON |
| `eslint-plugin-jsx-a11y` | moderate | non | `>=6.5.0` | Disponible annoncée ; voir chaîne JSON |
| `eslint-plugin-react` | moderate | non | `>=7.23.0` | `react-scripts@0.0.0` (changement majeur) |
| `eslint-plugin-testing-library` | moderate | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `eslint-webpack-plugin` | moderate | non | `*` | `react-scripts@0.0.0` (changement majeur) |
| `file-entry-cache` | moderate | non | `4.0.0 - 7.0.2` | `react-scripts@0.0.0` (changement majeur) |
| `filelist` | moderate | non | `>=0.0.2` | Disponible annoncée ; voir chaîne JSON |
| `flat-cache` | moderate | non | `1.3.4 - 4.0.0` | `react-scripts@0.0.0` (changement majeur) |
| `fork-ts-checker-webpack-plugin` | moderate | non | `>=0.2.9` | Disponible annoncée ; voir chaîne JSON |
| `glob` | moderate | non | `3.0.0 - 13.0.6` | `react-scripts@0.0.0` (changement majeur) |
| `http-proxy-agent` | low | non | `4.0.1` | Disponible annoncée ; voir chaîne JSON |
| `jake` | moderate | non | `>=10.6.1` | Disponible annoncée ; voir chaîne JSON |
| `jest` | low | non | `>=25.2.0-alpha.86` | Disponible annoncée ; voir chaîne JSON |
| `jest-circus` | moderate | non | `>=25.2.4` | Disponible annoncée ; voir chaîne JSON |
| `jest-cli` | low | non | `>=25.2.0-alpha.86` | Disponible annoncée ; voir chaîne JSON |
| `jest-config` | moderate | non | `>=19.1.0-alpha.eed82034` | Disponible annoncée ; voir chaîne JSON |
| `jest-environment-jsdom` | low | non | `27.0.1 - 27.5.1` | Disponible annoncée ; voir chaîne JSON |
| `jest-jasmine2` | moderate | non | `>=24.2.0-alpha.0` | Disponible annoncée ; voir chaîne JSON |
| `jest-resolve-dependencies` | moderate | non | `>=27.0.0-next.0` | Disponible annoncée ; voir chaîne JSON |
| `jest-runner` | moderate | non | `>=24.0.0-alpha.0` | Disponible annoncée ; voir chaîne JSON |
| `jest-runtime` | moderate | non | `>=24.0.0-alpha.0` | Disponible annoncée ; voir chaîne JSON |
| `jest-snapshot` | moderate | non | `>=27.0.0-next.0` | Disponible annoncée ; voir chaîne JSON |
| `jest-watch-typeahead` | low | non | `>=0.6.0` | Disponible annoncée ; voir chaîne JSON |
| `jsdom` | low | non | `16.6.0 - 17.0.0` | Disponible annoncée ; voir chaîne JSON |
| `jsonpath` | high | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `minimatch` | moderate | non | `<11.0.1` | `react-scripts@0.0.0` (changement majeur) |
| `nth-check` | high | non | `<2.0.1` | `react-scripts@0.0.0` (changement majeur) |
| `postcss` | high | non | `<=8.5.22` | `react-scripts@0.0.0` (changement majeur) |
| `react-dev-utils` | moderate | non | `>=0.5.2` | Disponible annoncée ; voir chaîne JSON |
| `react-router` | moderate | non | `6.0.0 - 7.17.0` | `react-router-dom@7.18.5` (changement majeur) |
| `react-router-dom` | moderate | oui | `6.0.0-alpha.0 - 7.17.0` | `react-router-dom@7.18.5` (changement majeur) |
| `react-scripts` | moderate | oui | `>=0.1.0` | `react-scripts@0.0.0` (changement majeur) |
| `recursive-readdir` | moderate | non | `>=1.2.0` | Disponible annoncée ; voir chaîne JSON |
| `resolve-url-loader` | moderate | non | `0.0.1-experiment-postcss || 3.0.0-alpha.1 - 4.0.0` | `react-scripts@0.0.0` (changement majeur) |
| `rimraf` | moderate | non | `2.3.0 - 3.0.2 || >=4.2.0` | `react-scripts@0.0.0` (changement majeur) |
| `rollup-plugin-terser` | high | non | `3.0.0 || >=4.0.4` | Disponible annoncée ; voir chaîne JSON |
| `serialize-javascript` | high | non | `<=7.1.2` | `react-scripts@0.0.0` (changement majeur) |
| `sockjs` | moderate | non | `>=0.3.17` | `react-scripts@0.0.0` (changement majeur) |
| `svgo` | high | non | `1.0.0 - 2.8.3` | `react-scripts@0.0.0` (changement majeur) |
| `test-exclude` | moderate | non | `4.2.2 || >=5.0.0` | `react-scripts@0.0.0` (changement majeur) |
| `underscore` | high | non | `<=1.13.7` | Disponible annoncée ; voir chaîne JSON |
| `uuid` | moderate | non | `<11.1.1` | `react-scripts@0.0.0` (changement majeur) |
| `webpack-dev-middleware` | high | non | `<7.4.5` | `react-scripts@0.0.0` (changement majeur) |
| `webpack-dev-server` | high | non | `<=5.2.7` | `react-scripts@0.0.0` (changement majeur) |
| `workbox-build` | high | non | `*` | Disponible annoncée ; voir chaîne JSON |
| `workbox-webpack-plugin` | low | non | `>=6.0.0-alpha.0` | Disponible annoncée ; voir chaîne JSON |

Avis directs (les autres lignes sont des chaînes de propagation) :

- **low** — @tootallnate/once : [@tootallnate/once vulnerable to Incorrect Control Flow Scoping](https://github.com/advisories/GHSA-vpq2-c234-7xj6).
- **low** — deepmerge : [deepmerge mergeObject() allows prototype poisoning of returned objects](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
- **moderate** — minimatch : [minimatch has potential denial of service via globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).
- **high** — nth-check : [Inefficient Regular Expression Complexity in nth-check](https://github.com/advisories/GHSA-rp65-9cf3-cjxr).
- **moderate** — postcss : [PostCSS line return parsing error](https://github.com/advisories/GHSA-7fh5-64p2-3v2j).
- **moderate** — postcss : [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93).
- **high** — postcss : [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q).
- **moderate** — postcss : [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
- **high** — postcss : [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849).
- **moderate** — react-router : [React Router: Open redirect via backslash in <Link> and useNavigate (CVE-2025-68470 bypass)](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6).
- **moderate** — react-router : [React Router: Arbitrary Constructor Injection via deserializeErrors() in React Router SSR Hydration](https://github.com/advisories/GHSA-337j-9hxr-rhxg).
- **high** — serialize-javascript : [Serialize JavaScript is Vulnerable to RCE via RegExp.flags and Date.prototype.toISOString()](https://github.com/advisories/GHSA-5c6j-r48x-rmvq).
- **moderate** — serialize-javascript : [Serialize JavaScript has CPU Exhaustion Denial of Service via crafted array-like objects](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v).
- **low** — serialize-javascript : [Serialize JavaScript: Cross-site scripting (XSS) via unescaped </script at the end of a serialized function body](https://github.com/advisories/GHSA-m5mm-p8h7-m29v).
- **high** — svgo : [SVGO removeScripts plugin leaves some executable scripts intact](https://github.com/advisories/GHSA-2p49-hgcm-8545).
- **moderate** — svgo : [SVGO: removeScripts incompletely sanitizes executable HTML in SVG foreignObject elements](https://github.com/advisories/GHSA-4vpr-x523-8j87).
- **high** — svgo : [SVGO: removeScripts allows executable links through namespace and control-character bypasses](https://github.com/advisories/GHSA-w27v-7q3p-w38r).
- **high** — underscore : [Underscore has unlimited recursion in _.flatten and _.isEqual, potential for DoS attack](https://github.com/advisories/GHSA-qpx9-hpmf-5gmw).
- **moderate** — uuid : [uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- **high** — webpack-dev-middleware : [webpack-dev-middleware vulnerable to Path Traversal via non-slash-terminated publicPath](https://github.com/advisories/GHSA-g84c-rxfj-3j2c).
- **moderate** — webpack-dev-server : [webpack-dev-server users' source code may be stolen when they access a malicious web site with non-Chromium based browser](https://github.com/advisories/GHSA-9jgg-88mc-972h).
- **moderate** — webpack-dev-server : [webpack-dev-server users' source code may be stolen when they access a malicious web site](https://github.com/advisories/GHSA-4v9v-hfq4-rm2v).
- **moderate** — webpack-dev-server : [webpack-dev-server vulnerable to cross-origin source code exposure on non-HTTPS origins](https://github.com/advisories/GHSA-79cf-xcqc-c78w).
- **moderate** — webpack-dev-server : [webpack-dev-server vulnerable to HMR WebSocket interception via permissive user proxies](https://github.com/advisories/GHSA-mx8g-39q3-5c79).
- **moderate** — webpack-dev-server : [webpack-dev-server vulnerable to cross-site request forgery via internal developer endpoints](https://github.com/advisories/GHSA-f5vj-f2hx-8m93).
- **moderate** — webpack-dev-server : [webpack-dev-server vulnerable to denial of service via a malformed Host or Origin header](https://github.com/advisories/GHSA-m28w-2pqf-7qgj).

## gateway

Aucun signalement dans cet audit.

## microservices-auth-gateway

Aucun signalement dans cet audit.

## microservices-notifications

| Paquet | Gravité | Direct | Plage signalée | Correction proposée par npm |
|---|---|---|---|---|
| `nodemailer` | high | oui | `<=10.1.3` | `nodemailer@10.3.1` (changement majeur) |

Avis directs (les autres lignes sont des chaînes de propagation) :

- **moderate** — nodemailer : [Nodemailer: Email to an unintended domain can occur due to Interpretation Conflict](https://github.com/advisories/GHSA-mm7p-fcc7-pg87).
- **low** — nodemailer : [Nodemailer has SMTP command injection due to unsanitized `envelope.size` parameter](https://github.com/advisories/GHSA-c7w3-x93f-qmm8).
- **moderate** — nodemailer : [Nodemailer Vulnerable to SMTP Command Injection via CRLF in Transport name Option (EHLO/HELO) ](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g).
- **moderate** — nodemailer : [Nodemailer: CRLF injection in Nodemailer List-* header comments allows arbitrary message header injection](https://github.com/advisories/GHSA-268h-hp4c-crq3).
- **moderate** — nodemailer : [Nodemailer jsonTransport bypasses disableFileAccess and disableUrlAccess during message normalization](https://github.com/advisories/GHSA-wqvq-jvpq-h66f).
- **high** — nodemailer : [Nodemailer’s addressparser is vulnerable to DoS caused by recursive calls](https://github.com/advisories/GHSA-rcmh-qjqh-p98v).
- **high** — nodemailer : [Nodemailer: Message-level raw option bypasses disableFileAccess/disableUrlAccess, enabling arbitrary file read and full-response SSRF in the delivered message](https://github.com/advisories/GHSA-p6gq-j5cr-w38f).
- **moderate** — nodemailer : [Nodemailer: resolveContent() on a MailMessage bypasses disableFileAccess/disableUrlAccess when called with the legacy signature](https://github.com/advisories/GHSA-8m3c-c648-2xjj).
- **moderate** — nodemailer : [Nodemailer: IDN/Punycode domain allow-list bypass leads to email delivery to an attacker-controlled domain](https://github.com/advisories/GHSA-wmmp-3585-3rmp).
- **high** — nodemailer : [Nodemailer: Quadratic (O(n²)) time complexity in addressparser allows remote denial of service via a crafted address list](https://github.com/advisories/GHSA-2x7j-588g-ccc2).
- **moderate** — nodemailer : [Nodemailer: Recipient-domain validation bypass via RFC 5322 comment mis-parsing leads to email delivery to an attacker-controlled domain](https://github.com/advisories/GHSA-cc9r-2j5m-2m83).
- **moderate** — nodemailer : [Nodemailer: Process-global DNS cache reuses TLS `servername` across transports, enabling cross-tenant SMTP credential disclosure](https://github.com/advisories/GHSA-6vj9-mwq6-2f5v).
- **moderate** — nodemailer : [Nodemailer: Nested structured recipient arrays bypass the parser depth limit and cause stack exhaustion DoS](https://github.com/advisories/GHSA-8vvx-rff5-p5rq).
- **high** — nodemailer : [Nodemailer: Quadratic backtracking in the addressparser free-text fallback allows remote denial of service](https://github.com/advisories/GHSA-v53p-9fqp-m79j).
- **high** — nodemailer : [Nodemailer: Improper TLS Certificate Validation in OAuth2 Token Fetch Enables Credential Interception](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2).
- **moderate** — nodemailer : [Nodemailer: Quadratic (O(n^2)) DKIM header unfolding lets a large folded header cause remote denial of service during signing](https://github.com/advisories/GHSA-39m8-27wv-hr27).
- **moderate** — nodemailer : [Nodemailer: A nested comment ends early in addressparser, releasing the rest of the comment as a recipient](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8).
- **moderate** — nodemailer : [Nodemailer: A ";" inside a quoted string or comment ends an address group early in addressparser, turning display text into a recipient](https://github.com/advisories/GHSA-m943-m63m-w62w).
- **moderate** — nodemailer : [Nodemailer: A ">" inside a quoted local part ends an angle-addr early in addressparser, delivering to a domain the header does not name](https://github.com/advisories/GHSA-85x2-q946-cp5h).
- **moderate** — nodemailer : [Nodemailer: Quadratic backtracking in SMTP AUTH mechanism detection regexes allows pre-auth remote denial of service](https://github.com/advisories/GHSA-4ffr-jq9g-5ffx).
- **moderate** — nodemailer : [Nodemailer: RFC 5322 comment inside an angle-bracket address is never stripped](https://github.com/advisories/GHSA-g73g-hqqh-jr95).
- **moderate** — nodemailer : [Nodemailer: Quadratic (O(n^2)) SMTP client reply parsing lets a malicious server or MITM cause a pre-auth remote denial of service](https://github.com/advisories/GHSA-4g23-2xm8-66gc).

## microservices-stock-management

Aucun signalement dans cet audit.

