import { useEffect, useRef } from "react";
import * as THREE from "three";

interface UseThreeViewerOptions {
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

/**
 * Sets up a WebGLRenderer on `canvasRef`, runs an animation loop calling
 * `renderFn` each frame, handles resize via ResizeObserver, and handles
 * WebGL context loss/restore. Cleans up everything on unmount.
 *
 * `renderFn` is read from a ref each frame — pass an inline function safely.
 */
export function useThreeViewer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  renderFn: (renderer: THREE.WebGLRenderer) => void,
  options: UseThreeViewerOptions = {}
): { rendererRef: React.RefObject<THREE.WebGLRenderer | null> } {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Keep renderFn and options fresh without re-running the setup effect
  const renderFnRef = useRef(renderFn);
  renderFnRef.current = renderFn;
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true, // required for getImageData / toDataURL (Phase 2)
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES filmic maps HDR environment values to a pleasing display range
    // LinearToneMapping = no creative grading, values display as-is.
    // Matches Blender's viewport which doesn't apply filmic curves in solid/preview mode.
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    rendererRef.current = renderer;

    let rafId = 0;
    let running = true;

    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      renderFnRef.current(renderer);
    }
    loop();

    const ro = new ResizeObserver(() => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    });
    ro.observe(canvas);

    function onContextLost(e: Event) {
      e.preventDefault(); // required to allow restoration
      running = false;
      cancelAnimationFrame(rafId);
      optsRef.current.onContextLost?.();
    }

    function onContextRestored() {
      running = true;
      optsRef.current.onContextRestored?.();
      loop();
    }

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { rendererRef };
}
