## Release

An account of what a release needs, in the order the stores want it. There are three listings and two artifacts: Firefox takes the Manifest V2 zip, and Chrome and Edge each take the same Manifest V3 zip.

### The Firefox Listing Already Exists

The add-on is live at `https://addons.mozilla.org/en-US/firefox/addon/cachecontrol/`, published on 14 July 2024 as version `1.0`. That upload set no `id`, so AMO generated one and bound it to the listing permanently.

| Field | Value |
|---|---|
| Listing guid | `{67ff6b13-5c99-4f81-ba95-eebbc5be8f6f}` |
| Slug | `cachecontrol` |

The gecko id in `manifest.json` carries that guid, and `test/manifest.test.ts` asserts it exactly. Do not change it. An upload whose id does not match the listing does not update the listing, it creates a second add-on and strands the users on the first.

Every upload also needs a version strictly greater than the published one. Mozilla's version comparison treats an absent part as zero, so `1.0.0` does not beat `1.0` and AMO rejects it. Bump to a version that differs in a part both strings carry.

| Step | Description |
|---|---|
| Bump the version | The version comes from the `version` field of `package.json` and is injected into both manifests at build time. |
| Run the checks | The command is `bun run check`, which type checks, lints, and runs the unit suite. |
| Run the browsers | The command is `bun run e2e`, which drives both engines against a logging server. |
| Build the artifacts | The command is `bun run package`, which writes `dist/cachecontrol-firefox.zip` and `dist/cachecontrol-chrome.zip`. |

### Firefox

The artifact is `dist/cachecontrol-firefox.zip`, and `bun run lint:extension` runs the same `addons-linter` that AMO runs.

There are three warnings the linter reports and none of them block a submission.

- **KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION**: `data_collection_permissions` landed in Firefox 140 while `strict_min_version` is `115.0`. The older Firefox ignores the key, and 115 is the oldest release carrying `URL.canParse`, which the rule parser needs.
- **KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION**: the same key against the Android minimum, and the same reasoning applies.
- **UNSAFE_VAR_ASSIGNMENT**: the Vue runtime assigns to `innerHTML`. The assignment is internal to the framework and the extension never passes a page value to it.

Signing goes through `web-ext sign` with the AMO credentials and the gecko id already in the manifest. Vite minifies the bundles, so AMO also wants the human readable source, and `--upload-source-code` is what carries it.

```sh
bun run package:firefox
git archive --format=zip --output=dist/cachecontrol-source.zip HEAD
bunx web-ext sign \
    --source-dir dist/firefox \
    --channel listed \
    --api-key "$AMO_JWT_ISSUER" \
    --api-secret "$AMO_JWT_SECRET" \
    --upload-source-code dist/cachecontrol-source.zip
```

The reviewer needs the build to be reproducible from that archive, so `README.md` carries the toolchain versions and the exact commands under "Development".

### Vendored Fonts

Three binary font files sit under `src/stylesheet/fonts`, and a reviewer reading the source archive cannot tell from the bytes alone what they are. The two IBM Plex Sans files carry the wordmark and nothing else, which is why each holds nine glyphs.

```sh
bun add -d @fontsource/ibm-plex-sans
pyftsubset node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2 \
    --text="cachecontrol" \
    --flavor=woff2 \
    --layout-features='' \
    --no-hinting \
    --desubroutinize \
    --output-file=src/stylesheet/fonts/ibm-plex-sans-400-latin.woff2
```

The 700 weight takes the same command with the weight changed in both paths. The subset drops the pair from 45 KB to 2.2 KB, and Vite inlines both as data URIs because each lands under its 4 KB threshold. The provenance of `inter-variable-latin.woff2` predates this note and is not recorded anywhere.

### Chrome

The artifact is `dist/cachecontrol-chrome.zip`, uploaded through the Chrome Web Store developer dashboard.

The Manifest V3 privacy declarations are the part that stalls a review, so answer them from what the code does.

| Declaration | Answer |
|---|---|
| Single purpose | The extension disables the browser cache for URLs the user lists. |
| `declarativeNetRequest` justification | The rules rewrite cache headers on matching requests, which is the entire feature. |
| `storage` justification | The rule list and the global toggle live in `storage.local`. |
| Host permission justification | A rule can name any host, so the rules need `<all_urls>` to match one. |
| Remote code | The extension executes none. Every script ships in the package. |
| Data collection | The extension collects nothing and sends nothing anywhere. |

### Edge

The artifact is the same `dist/cachecontrol-chrome.zip`, uploaded through Microsoft Partner Center. There is no third build and no third manifest. The declarations match the Chrome answers above.

### After A Store Rejects The Manifest

A rejection almost always names a permission. The permission set is deliberately small, so check it against the table before widening anything.

| Target | Permissions |
|---|---|
| Firefox | The set is `webRequest`, `webRequestBlocking`, `storage`, and `<all_urls>`. |
| Chrome and Edge | The set is `declarativeNetRequest` and `storage`, with `<all_urls>` under `host_permissions`. |

The `browsingData` permission stays out. A cache purge was measured against the header rewrite during the HTTP/3 investigation and added nothing.
