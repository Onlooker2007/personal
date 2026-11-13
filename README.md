# Personal website

Open `index.html` directly in a browser, or upload the entire `personal` directory to any static website host. The Skills pool works over both `file://` and HTTP(S); no backend or local server is required.

## Doggie / Robot Dog Kit

The homepage's Robot Dog Kit card links to `dog-kit/index.html`. This self-contained project page uses the four supplied photos and a procedural Three.js reconstruction of the black acrylic robot dog. The reconstruction is illustrative, not a measured CAD model. The walking animation is a conceptual gait, not hardware control.

Drag or use arrow keys to orbit, hold Ctrl while scrolling (or use pinch or +/- keys) to zoom, and click components to highlight them. Ordinary wheel scrolling scrolls the page. The 3D viewer uses the full workspace width, without a sidebar. Four buttons arranged vertically on the right control disassembly, assembly, x-ray and walking. The gallery supports full-size viewing with arrow keys and Escape. The renderer pauses outside the viewport and when the tab is hidden; automatic effects start only on request. The favicon, page header and homepage project card use a custom SVG of Doggie's face.

`doggie.bundle.js` includes the locally vendored Three.js dependency and needs no network connection or build step for visitors, including when opened with `file://`. WebGL 2 is required for 3D; unsupported devices retain the reference photo, gallery.

To rebuild after editing `dog-kit/doggie.js`, run `npm install` then `npm run build:doggie`. For an optional loopback-only preview run `node tools/preview.cjs` and open `http://127.0.0.1:4173/dog-kit/`. Upload the entire `personal` folder to preserve the homepage, sibling projects and relative links.

## Skills pool

The page loads `assets/js/skill-pool.bundle.js` as a classic script. When the Skills section approaches the viewport, it loads `assets/models/icon-pool-brand.data.js` as a classic script and decodes the embedded GLB in memory. This avoids module imports and model fetches that browsers restrict on `file://`. Textures are embedded in the model. The model-data script is approximately 14.7 MB before HTTP compression.

The Skills section presents the sixteen original brand-icon balls in a shallow blue 4×4 tray. Hovering over a ball lifts it and rotates it left to right. Leaving it lowers it back into place; the adjacent description remains selected so its certificate links can be opened. Tapping a ball on mobile or using the previous/next buttons also selects a skill. Each ball has a native focusable button, with arrow-key navigation across the grid. The reduced-motion preference disables rotation and uses a smaller lift. Rendering pauses outside the viewport.

Skill descriptions and competition/certificate links are maintained in `assets/js/skill-content.js`. Records refer to existing website entries; skills without documented records show their descriptions without invented awards. The original Certification section is preserved in full.

The 3D Skills view needs no network connection when opened locally. Existing remote images and Google Fonts elsewhere on the page still require internet access.

## Rebuild after editing Skills

The built files are committed alongside the source, so visitors and static hosts do not need Node.js. Developers can rebuild from this directory:

```powershell
npm install
npm run build:skills
```

Edit `assets/js/skill-pool.js` for behavior or `assets/js/skill-content.js` for descriptions and records, or replace `assets/models/icon-pool-brand.glb` for the model, then rebuild. The build script regenerates the bundled JavaScript and model-data script. The original `.blend` file is not needed by the website.

Three.js 0.170.0, GLTFLoader, and BufferGeometryUtils are included locally. Upstream: https://github.com/mrdoob/three.js/tree/r170 (MIT; license in `assets/vendor/three/LICENSE`).
