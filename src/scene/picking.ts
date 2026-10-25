/**
 * Raycaster selection adapted from leonichevAndrei/threejs-interactive-cubes,
 * src/components/Skyscraper.js, commit ecbe03d (MIT declaration in upstream README).
 * Copyright (c) leonichevAndrei. See LICENSES.md.
 * Adaptation: canvas-local coordinates, Pointer Events, drag and pinch rejection,
 * recursive group selection, scoped listeners, complete disposal.
 */
import { Raycaster, Vector2, type Camera, type Object3D } from "three";
export function bindPicking(
  canvas: HTMLCanvasElement,
  camera: Camera,
  objects: Object3D[],
  select: (id: string) => void,
  hover: (id: string | null) => void,
) {
  const raycaster = new Raycaster();
  const mouse = new Vector2();
  const pointers = new Set<number>();
  let start: Vector2 | null = null;
  let multitouch = false;
  let previous: string | null = null;
  function hit(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    let obj: Object3D | undefined = raycaster.intersectObjects(objects, true)[0]
      ?.object;
    while (obj && !obj.userData.zoneId) obj = obj.parent || undefined;
    return obj?.userData.zoneId as string | undefined;
  }
  function down(e: PointerEvent) {
    pointers.add(e.pointerId);
    if (pointers.size > 1) multitouch = true;
    start = new Vector2(e.clientX, e.clientY);
  }
  function up(e: PointerEvent) {
    if (
      e.button === 0 &&
      !multitouch &&
      start &&
      start.distanceTo(new Vector2(e.clientX, e.clientY)) < 7
    ) {
      const id = hit(e);
      if (id) select(id);
    }
    pointers.delete(e.pointerId);
    if (!pointers.size) {
      multitouch = false;
      start = null;
    }
  }
  function cancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
    start = null;
    if (!pointers.size) multitouch = false;
  }
  function move(e: PointerEvent) {
    if (pointers.size) return;
    const id = hit(e) || null;
    if (id !== previous) {
      previous = id;
      hover(id);
      canvas.style.cursor = id ? "pointer" : "grab";
    }
  }
  function leave() {
    previous = null;
    hover(null);
  }
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  return () => {
    canvas.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerleave", leave);
  };
}
