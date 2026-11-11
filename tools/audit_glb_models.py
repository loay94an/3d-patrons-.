#!/usr/bin/env python3
"""Read-only structural and best-effort geometry audit for repository GLB files."""
from __future__ import annotations
import json
import struct
from pathlib import Path
import trimesh

ROOT = Path(__file__).resolve().parents[1]

def read_gltf(path: Path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("file is too small to be a GLB")
    magic, version, declared = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared != len(data):
        raise ValueError("invalid GLB 2.0 header or declared length")
    offset = 12
    document = None
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_len]
        if len(chunk) != chunk_len:
            raise ValueError("truncated GLB chunk")
        if chunk_type == b"JSON":
            document = json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\0"))
            break
        offset += chunk_len
    if document is None:
        raise ValueError("GLB JSON chunk not found")
    return document

def accessor_summary(doc):
    accessors = doc.get("accessors", [])
    rows = []
    vertex_count = 0
    triangle_count = 0
    bounds = []
    for mesh_index, mesh in enumerate(doc.get("meshes", [])):
        for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
            attributes = primitive.get("attributes", {})
            position_index = attributes.get("POSITION")
            if position_index is None or position_index >= len(accessors):
                continue
            position = accessors[position_index]
            count = int(position.get("count", 0))
            vertex_count += count
            index = primitive.get("indices")
            index_count = int(accessors[index].get("count", 0)) if index is not None and index < len(accessors) else count
            mode = primitive.get("mode", 4)
            triangles = index_count // 3 if mode == 4 else 0
            triangle_count += triangles
            if position.get("min") and position.get("max"):
                bounds.append((position["min"], position["max"]))
            rows.append({
                "mesh": mesh.get("name", f"mesh-{mesh_index}"),
                "primitive": primitive_index,
                "vertices": count,
                "triangles": triangles,
                "mode": mode,
                "morph_targets": len(primitive.get("targets", [])),
                "position_bounds": {"min": position.get("min"), "max": position.get("max")},
            })
    return rows, vertex_count, triangle_count, bounds

def main():
    paths = sorted(ROOT.glob("*.glb"))
    if not paths:
        print("No root-level GLB files found.")
        return
    failures = []
    print(f"GLB_AUDIT_BEGIN files={len(paths)}")
    for path in paths:
        try:
            doc = read_gltf(path)
            primitives, vertices, triangles, bounds = accessor_summary(doc)
            geometry = []
            geometry_error = None
            try:
                scene = trimesh.load(path, force="scene", process=False)
                for name, mesh in list(scene.geometry.items())[:40]:
                    if not isinstance(mesh, trimesh.Trimesh):
                        continue
                    geometry.append({
                        "name": str(name)[:100],
                        "vertices": len(mesh.vertices),
                        "faces": len(mesh.faces),
                        "watertight": bool(mesh.is_watertight),
                        "components": len(mesh.split(only_watertight=False)),
                    })
            except Exception as exc:
                geometry_error = str(exc)
            skins = [{"name": skin.get("name", ""), "joints": len(skin.get("joints", []))}
                     for skin in doc.get("skins", [])]
            report = {
                "file": path.name,
                "size_bytes": path.stat().st_size,
                "nodes": len(doc.get("nodes", [])),
                "mesh_definitions": len(doc.get("meshes", [])),
                "materials": len(doc.get("materials", [])),
                "skins": skins,
                "animations": [item.get("name", "unnamed") for item in doc.get("animations", [])],
                "morph_target_sets": sum(item.get("morph_targets", 0) for item in primitives),
                "vertices_from_accessors": vertices,
                "triangles_from_accessors": triangles,
                "primitive_accessors": primitives,
                "position_accessor_bounds": bounds,
                "geometry_topology": geometry,
                "geometry_topology_error": geometry_error,
            }
            print(json.dumps(report, ensure_ascii=False))
        except Exception as exc:
            failures.append(path.name)
            print(json.dumps({"file": path.name, "structural_error": str(exc)}, ensure_ascii=False))
    print(f"GLB_AUDIT_END structural_failures={len(failures)}")
    if failures:
        raise SystemExit(f"Invalid GLB files: {', '.join(failures)}")

if __name__ == "__main__":
    main()
