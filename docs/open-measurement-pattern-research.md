# Open measurement-driven garment pattern research

## Scope

This is a curated engineering survey, not a claim that every patternmaking method in the world has been collected. The project now has a structured catalogue of garment block families and style variants in `src/lib/open-pattern-library.ts`. Catalogue entries are metadata, not production-ready drafting implementations: an entry must not be presented as a generated, validated pattern until its equations, piece topology, seam lengths, notches, grainlines, seam allowance and print scale have tests.

## Primary open-source references

| Project | License / reuse position | What it contributes | Integration decision |
|---|---|---|---|
| [FreeSewing](https://github.com/freesewing/freesewing) | MIT | JavaScript parametric pattern engine, made-to-measure designs and reusable geometry | Preferred first code-level integration candidate. Add as an isolated adapter and preserve upstream attribution/license. |
| [JBlockCreator](https://github.com/aharwood2/JBlockCreator) | GPL-3.0 | Measurement-driven blocks, including bodices, skirts, sleeves and trousers; scan input and DXF output | Strong drafting-method reference. Porting code into this distributed app requires GPL compatibility review. |
| [Seamly2D](https://github.com/FashionFreedom/Seamly2D) | GPL-3.0-or-later | Formula-based parametric drafting and individual/multi-size measurement files | Use as workflow and formula reference; do not transplant code without accepting copyleft obligations. |
| [Valentina](https://gitlab.com/smart-pattern/valentina) | GPL family; verify current upstream license | Formula-based drafting with standard and individual measurements | Reference for reusable formulas, measurement tables and pattern construction. |
| [Costumy](https://github.com/cdrinmatane/Costumy) | Verify exact license in repository | Body mesh measurement -> FreeSewing design -> 3D garment workflow; SVG/JSON/OBJ | Prototype/reference for connecting the 2D and 3D systems, not a production dependency. |
| [OpenSew-2](https://github.com/MarcelloMorettoni/opensew-2) | Verify exact license in repository | Blender workflow for 2D pieces, sewing relationships, mesh-derived measures and cloth draping | Reference for 3D fitting and seam matching; Blender-specific implementation. |
| [FashionMaker](https://github.com/OpnTec/fashionmaker) | GPL family; verify provenance and exact license | Valentina-lineage patternmaking code | Historical reference only pending provenance and license review. |

Academic reference: [JBlockCreator paper](https://doi.org/10.1016/j.softx.2019.100365), *JBlockCreator: An open source, pattern drafting framework to facilitate the automated manufacture of made-to-measure clothing*.

## Pattern families catalogued

The first curated catalogue includes foundational and style families for:

- Bodices: basic block, dartless, princess seams, wrap.
- Shirts and tops: classic button shirt, oversized shirt, tunic, T-shirt, raglan T-shirt, polo.
- Dresses: shift, A-line, fit-and-flare, wrap, shirt dress.
- Skirts: straight, pencil, A-line, circle, gathered/pleated.
- Trousers: basic block, straight, wide-leg/palazzo, tapered, jeans, shorts, culottes.
- Sleeves: set-in, two-piece tailored, puff.
- Outerwear: blazer, coat, hoodie, cape.
- Traditional garments: abaya, kimono, kaftan.
- Activewear and underwear: leggings, sports bra, boxer briefs.
- Children and accessories: children basics, apron, bow tie, basic hat.

These are model families and style variants, not a count of independently implemented generators. Each requires its own drafting rules and measurement dependencies.

## Project-specific integration architecture

The current app already has a 2D CAD geometry model (`CadPiece`, `CadSegment`, notches, grainlines, seam allowances), measurement state, size tables, garment categories, fabric ease and a 3D garment preview. The next integration should preserve these models and add adapters rather than replace the CAD editor.

1. **Measurement profile**: canonical body measurements with units, provenance, validation ranges and missing-measurement prompts.
2. **Pattern definition**: model ID, drafting method/version, required measures, ease, fabric assumptions and style options.
3. **Drafting adapter**: converts a measurement profile and options into project-native `CadPiece[]`.
4. **Geometry validation**: closed outlines, no self-intersections, seam-pair length compatibility, sleeve-cap/armhole matching, grainline and notch checks.
5. **3D synchronization**: map generated piece/seam IDs to the 3D garment assembly; do not infer sewing relationships from visual proximity.
6. **Grading**: explicit grade rules and size-run validation, separate from simply scaling a finished pattern.
7. **Export**: retain SVG/PDF tiled print and add tested DXF-AAMA/ASTM only after its schema and units are validated.

## Licensing and quality gates

- MIT-licensed FreeSewing is the preferred first candidate for direct JavaScript integration, subject to checking the exact package/design licenses and dependencies at the selected version.
- GPL projects are valuable references, but copying/porting their code into a distributed product may impose source-disclosure and same-license obligations. Keep formula research independent and obtain a legal review before importing code.
- Do not bulk-copy pattern files, images, books or proprietary drafting instructions merely because they are publicly viewable.
- Do not label a catalogue entry as ready until it passes measurement fixtures, geometry tests, seam walking, print-scale checks and a physical toile/fitting review.

## Sources

- https://github.com/freesewing/freesewing
- https://github.com/aharwood2/JBlockCreator
- https://github.com/FashionFreedom/Seamly2D
- https://gitlab.com/smart-pattern/valentina
- https://github.com/cdrinmatane/Costumy
- https://github.com/MarcelloMorettoni/opensew-2
- https://github.com/OpnTec/fashionmaker
- https://doi.org/10.1016/j.softx.2019.100365
- https://freesewing.eu/docs/
- https://freesewing.org/docs/designs/
