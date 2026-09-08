# inthebox.es

**A deterministic generative microworld.**

[www.inthebox.es](https://www.inthebox.es/)

`inthebox.es` is a procedural system exposed through the web. A fixed seed and
a small set of explicit rules generate a world of territories, objects,
openings and relationships. The same generation reconstructs the same state,
so its history can be explored and replayed deterministically.

## Run locally

```sh
python3 -m http.server 8796 --bind 127.0.0.1
```

Then open http://127.0.0.1:8796/.

## Implementation

Semantic HTML, CSS, vanilla JavaScript modules and SVG. No framework, build
step, analytics, external API or runtime dependency.

## Contact

hello@inthebox.es

Copyright © 2026 Charles Matthew Fletcher. All rights reserved. No software
licence is granted for reuse.
