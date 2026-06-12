import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FrameInfo } from '../graph/types';

/**
 * Owns renderer/scene/camera and the rAF loop.
 * React renders the canvas element once; everything GPU lives here.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private rafId = 0;
  private running = false;
  private startTime = 0;
  private lastTime = 0;
  private frameIndex = 0;
  fps = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#101014');

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 2, 8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(3, 5, 4);
    this.scene.add(ambient, dir);
  }

  start(onFrame: (frame: FrameInfo) => void): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
      onFrame({ time: (now - this.startTime) / 1000, dt, index: this.frameIndex++ });
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
