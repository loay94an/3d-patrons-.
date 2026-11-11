#!/usr/bin/env python3
"""Audit repository GLB files for human-body reuse suitability (read-only)."""
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
        raise ValueError("invalid GLB 2.0 header or length")
    chunk_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON":
        raise ValueError("first GLB chunk is not JSON")
    return json.loads(data[20:20 + chunk_len].decode("utf-8"))

def main():
    paths = sorted(ROOT.glob("*.glb"))
    if not paths:
        print("No root-level GLB files found.")
        return
    print(f"GLB_AUDIT_BEGIN files={len(paths)}")
    for path in paths:
        try:
            doc = read_gltf(path)
            scene = trimesh.load(path, force="scene", process=False)
            meshes = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
            vertices = sum(len(g.vertices) for g in meshes)
            faces = sum(len(g.faces) for g in meshes)
            bounds = scene.bounds.tolist() if len(meshes) and scene.bounds is not None else None
            mesh_rows = []
            for name, mesh in list(scene.geometry.items())[:40]:
                if not isinstance(mesh, trimesh.Trimesh):
                    continue
                components = list(mesh.split(only_watertight=False))
                mesh_rows.append({
                    "name": str(name)[:100],
                    "vertices": len(mesh.vertices),
                    "faces": len(mesh.faces),
                    "watertight": bool(mesh.is_watertight),
                    "components": len(components),
                    "bounds": mesh.bounds.round(4).tolist() if len(mesh.vertices) else None,
                })
            skins = [{"name": s.get("name", ""), "joints": len(s.get("joints", []))}
                     for s in doc.get("skins", [])]
            animations = [a.get("name", "unnamed") for a in doc.get("animations", [])]
            morph_targets = sum(
                len(p.get("targets", []))
                for m in doc.get("meshes", [])
                for p in m.get("primitives", [])
            )
            print(json.dumps({
                "file": path.name,
                "size_bytes": path.stat().st_size,
                "nodes": len(doc.get("nodes", [])),
                "mesh_objects": len(meshes),
                "materials": len(doc.get("materials", [])),
                "skins": skins,
                "animations": animations,
                "morph_target_sets": morph_targets,
                "vertices": vertices,
                "triangles": faces,
                "scene_bounds": bounds,
                "meshes": mesh_rows,
            }, ensure_ascii=False))
        except Exception as exc:
            print(json.dumps({"file": path.name, "error": str(exc)}, ensure_ascii=False))
    print("GLB_AUDIT_END")

if __name__ == "__main__":
    main()
