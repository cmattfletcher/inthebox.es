# inthebox.es

**A deterministic generative microworld.**

[www.inthebox.es](https://www.inthebox.es/)

InTheBox.es began in 2015 as an independent maker project combining art, reuse and technology through hand-built computers made from reclaimed and unconventional materials.

The project has since evolved into a broader experimental space for creative technology, web design and unconventional digital ideas.

This repository contains the source for Prototype 1: a deterministic generative microworld.

## Prototype 1

`inthebox.es` is a procedural system exposed through the web.

A fixed seed and a small set of explicit rules generate a world of territories, objects, openings and relationships.

The same generation reconstructs the same state, allowing its structure and history to be explored and replayed deterministically.

## What it explores

The experiment is concerned with ideas including:

- containment
- relationships
- topology
- lifecycle
- representation
- deterministic generation
- procedural structure

It is not intended as a conventional application or product.

It is an evolving creative-technology experiment within the wider InTheBox.es project.

## Run locally

```bash
python3 -m http.server 8796 --bind 127.0.0.1
```

Then open:

[http://127.0.0.1:8796/](http://127.0.0.1:8796/)

## Implementation

Prototype 1 uses:

- semantic HTML
- CSS
- vanilla JavaScript modules
- SVG

There is no framework, build step, analytics, external API or runtime dependency.

## Project

**Live site**  
[www.inthebox.es](https://www.inthebox.es/)

**Creator**  
[Charles Matthew Fletcher](https://www.charlesmatthewfletcher.com/)

## Contact

[hello@inthebox.es](mailto:hello@inthebox.es)

## Licensing

Copyright © 2026 Charles Matthew Fletcher.

This repository is published for public inspection of the InTheBox.es experiment represented by this source tree.

No open-source or other software licence is granted for reuse of the source code in this repository.

**All rights reserved unless explicitly stated otherwise.**
