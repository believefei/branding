# Octopus Poster Study

An experimental poster system that turns 24-hour Shanghai weather data into an abstract octopus-like form.

## Files

- `index.html`: page entry
- `style.css`: page layout and canvas presentation
- `app.js`: poster drawing and data mapping logic
- `shanghai_24h.csv`: 24-hour weather source data
- `Octopus.pde`: earlier Processing study

## Current Direction

The current web version uses:

- a `1:1` square canvas (`720 x 720`)
- one large circular body at the top
- four hanging tentacle chains made from stacked circles
- a paper-like background texture
- motion driven by lightweight procedural animation

The visual goal is not realistic illustration. It is a graphic poster language that can be pushed toward data art, dynamic identity, or generative branding.

## Data Mapping

The source CSV contains:

- `hour`: hour of day
- `T`: temperature
- `H`: humidity
- `P`: pressure
- `W`: wind
- `M`: an additional measured value used here as rhythm/length input

In the current version:

- `T` influences circle size and part of the color temperature
- `H` influences circle tapering and overall palette softness
- `P` influences horizontal spread and the body gradient split position
- `W` influences tentacle sway amplitude and animation speed
- `M` influences tentacle length and end-hook strength

## Current Composition

- The body is a pure circle with a vertical gradient:
  dark purple at the top, lighter pink-purple at the bottom.
- The tentacles connect directly under the body with no gap.
- Secondary sucker discs were intentionally removed in this version to simplify the structure and focus on the main circle chains.

## Run

Open `index.html` in a browser.

## Notes For Next Iterations

Possible next steps:

- make each circle correspond directly to a single hourly record
- expose mapping parameters as editable controls
- test more asymmetric poster compositions
- add export support for static frames or animation sequences
