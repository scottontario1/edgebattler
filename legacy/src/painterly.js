import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Painterly post-process: a Kuwahara filter (each pixel takes the mean colour of whichever of the four
// surrounding quadrants is smoothest) flattens texture into brush-like patches while keeping edges,
// which turns the low-poly trees, rocks and cliffs into painted shapes.
//
// Sprites are hand-drawn already, so they are masked out and stay crisp. The mask is rendered here:
// first the whole scene in flat black (this writes the terrain depth, so trees in front of a unit
// still hide it), then only the objects on MASK_LAYER in white on top, each through its own
// alpha-cutout material `object.userData.maskMaterial`. To keep something crisp, put it on
// MASK_LAYER (in addition to layer 0) and give it a maskMaterial.
export const MASK_LAYER = 1;

const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

const shader = {
  uniforms: {
    tDiffuse: { value: null },
    tMask: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uStrength: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    #define R 2
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform vec2 uTexel;
    uniform float uStrength;
    varying vec2 vUv;

    // Mean and luminance variance of one quadrant; dir is the quadrant's sign on each axis.
    void quadrant(vec2 dir, out vec3 mean, out float variance) {
      vec3 sum = vec3(0.0);
      float sum2 = 0.0;
      for (int j = 0; j <= R; j++) {
        for (int i = 0; i <= R; i++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * dir * uTexel).rgb;
          sum += c;
          sum2 += dot(c, vec3(0.299, 0.587, 0.114)) * dot(c, vec3(0.299, 0.587, 0.114));
        }
      }
      float n = float((R + 1) * (R + 1));
      mean = sum / n;
      float l = dot(mean, vec3(0.299, 0.587, 0.114));
      variance = abs(sum2 / n - l * l);
    }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      float keep = texture2D(tMask, vUv).r;
      if (keep > 0.999) { gl_FragColor = src; return; }
      vec3 m0, m1, m2, m3;
      float v0, v1, v2, v3;
      quadrant(vec2(-1.0, -1.0), m0, v0);
      quadrant(vec2( 1.0, -1.0), m1, v1);
      quadrant(vec2(-1.0,  1.0), m2, v2);
      quadrant(vec2( 1.0,  1.0), m3, v3);
      vec3 best = m0; float bv = v0;
      if (v1 < bv) { bv = v1; best = m1; }
      if (v2 < bv) { bv = v2; best = m2; }
      if (v3 < bv) { bv = v3; best = m3; }
      vec3 painted = mix(src.rgb, best, uStrength);
      gl_FragColor = vec4(mix(painted, src.rgb, keep), src.a);
    }
  `,
};

export class PainterlyPass extends Pass {
  /** @param {{scene: THREE.Scene, camera: THREE.Camera, maskObjects: () => THREE.Mesh[]}} opts */
  constructor({ scene, camera, maskObjects }) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.maskObjects = maskObjects;
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: shader.vertexShader, fragmentShader: shader.fragmentShader });
    this.quad = new FullScreenQuad(this.material);
    this.maskTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  }

  /** 0 = off, 1 = full painterly. */
  set strength(v) { this.uniforms.uStrength.value = v; }
  get strength() { return this.uniforms.uStrength.value; }

  setSize(width, height) {
    this.maskTarget.setSize(width, height);
    this.uniforms.uTexel.value.set(1 / width, 1 / height);
  }

  renderMask(renderer) {
    const { scene, camera } = this;
    const objects = this.maskObjects();
    const prev = {
      target: renderer.getRenderTarget(), autoClear: renderer.autoClear, override: scene.overrideMaterial,
      background: scene.background, clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), layers: camera.layers.mask, shadows: renderer.shadowMap.autoUpdate,
    };
    const materials = objects.map((o) => o.material);
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.maskTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = true;
    renderer.clear();
    renderer.autoClear = false;
    scene.background = null;

    // 1. everything except the masked objects, flat black: fills the depth buffer.
    scene.overrideMaterial = blackMat;
    objects.forEach((o) => { o.visible = false; });
    renderer.render(scene, camera);

    // 2. only the masked objects, white where their cutout is opaque, depth-tested against step 1.
    scene.overrideMaterial = null;
    camera.layers.set(MASK_LAYER);
    objects.forEach((o) => { o.visible = true; o.material = o.userData.maskMaterial; });
    renderer.render(scene, camera);

    objects.forEach((o, i) => { o.material = materials[i]; });
    camera.layers.mask = prev.layers;
    scene.overrideMaterial = prev.override;
    scene.background = prev.background;
    renderer.autoClear = prev.autoClear;
    renderer.shadowMap.autoUpdate = prev.shadows;
    renderer.setClearColor(prev.clear, prev.alpha);
    renderer.setRenderTarget(prev.target);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    if (this.uniforms.uStrength.value <= 0) {
      // Off: copy through with the mask ignored.
      this.uniforms.tMask.value = this.maskTarget.texture;
      this.material.uniforms.uStrength.value = 0;
    } else {
      this.renderMask(renderer);
      this.uniforms.tMask.value = this.maskTarget.texture;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  dispose() {
    this.maskTarget.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
