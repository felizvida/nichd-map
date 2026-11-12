# Sample data: a neighbourhood park in Bethesda, Maryland

A deliberately small real-world sample for the [hands-on tutorial](../tutorial/README.md): about 130 × 132 m around a public park with three apartment buildings, courts, a playground, a rail trail, paths and a street. Total size is about 40 KB.

The three files come from three public sources under **three different licences**. The repository's Apache-2.0 licence covers its code and documentation, **not this data**. When you reuse a file, keep its attribution and follow its licence.

| File | Content | Source | Licence | Attribution to keep |
| --- | --- | --- | --- | --- |
| `features.geojson` | 28 features: 3 building footprints, park, 2 courts, playground (clipped), road, service, cycle and foot ways | OpenStreetMap, snapshot 2026-11-09 (Overpass API) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | © OpenStreetMap contributors |
| `structures.geojson` | 4 structure footprints with published heights | USA Structures, retrieved 2026-11-08 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | USA Structures: Oak Ridge National Laboratory (ORNL) and FEMA Geospatial Response Office |
| `terrain.json` | Bare-earth heights on 2 m nodes (67 × 68) | USGS 3D Elevation Program (3DEP) | Public domain (U.S. Government work) | Map services and data available from U.S. Geological Survey, National Geospatial Program. |

## What was changed

These are the "changes made" that CC BY asks you to indicate, and the derivation of the ODbL extract:

- **OpenStreetMap.** Ways inside the box (lon −77.10110 to −77.09960, lat 38.99125 to 38.99244) were clipped to the box; buildings were kept only if wholly inside. Each feature keeps only a generic `kind`, its OSM way id (`osm`), and where present `levels`, `sport` and `surface`. Names, addresses and every other tag were removed. Coordinates are rounded to 7 decimals (about 1 cm). The extract remains under ODbL. If you publish a database derived from it, it must be offered under ODbL too.
- **USA Structures.** Footprints whose centroid is inside the box were kept whole, with five fields: `height_m`, `occupancy_class`, `source`, `image_date` and `validation`. Addresses, identifiers, population estimates and all other attributes were removed. Heights are as published; most are marked "Unverified", and one is missing.
- **USGS 3DEP.** Requested from the 3DEP elevation image service as a float32 raster in WGS84 longitude and latitude at about 1 m. It was then sampled bilinearly at the 2 m nodes of the local frame below and stored as integer centimetres above `z_base_m`. The source project and acquisition date are listed below.

## Frame and units

- **Features and structures:** WGS84 longitude and latitude (GeoJSON, RFC 7946).
- **Terrain:** a local tangent plane: x metres east and y metres north of `origin_lon` and `origin_lat`. The conversion formula is in `terrain.json` and `tutorial/lib.mjs`. Heights are NAVD88 metres; `z[j][i]` is the node at `x0 + i·cell_m`, `y0 + j·cell_m`, with rows running south to north.
- **Datums:** 3DEP's horizontal datum is NAD83, while OpenStreetMap is effectively WGS84. They differ by about 1 to 1.5 m here. The tutorial ignores this and discusses it as an exercise.

## Terrain source details

- Service: `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`
- Catalogue items whose footprints intersect the request box. The service mosaics the finest available item for each pixel, and this list does not say which item supplied which pixel: `n39w078` (30.9221 m), `n39w078` (10.3074 m), `ned19_n39x00_w077x25_md_washingtondc_2008` (3.43579 m), `ned19_n39x00_w077x25_va_wvmd_fema_r3lot5_2012` (3.43579 m), `MD_Central_Processing_D24` (1 m), `VA_NorthernVA_B22` (1 m), `VA_Fairfax_County_2018` (1 m), `MD_VA_Sandy_NCR_2014` (1 m)
- Retrieved: 2026-11-12; raster SHA-256 `bacf4f1163c4df76fff6ef23584a3c2f3e08f5968b9a14a27c88119439f15419`

## Known limits

- The datasets come from different surveys and dates; footprints and terrain may disagree by a metre or two.
- One USA Structures footprint lies on the tennis court and is not a building. The tutorial uses it to show why independent sources are joined and checked.
- Courts and paths are drawn from OpenStreetMap as mapped, not surveyed.
- The sample is for learning methods. It is not authoritative for any purpose.

Attribution for a map or image made from all three files:

> © OpenStreetMap contributors (ODbL); USA Structures: ORNL and FEMA Geospatial Response Office (CC BY 4.0); map services and data available from U.S. Geological Survey, National Geospatial Program.
