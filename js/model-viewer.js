import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function initModelViewer(section) {
  var canvas = section.querySelector('.model-canvas');
  var modelPath = section.dataset.model;
  if (!canvas || !modelPath) return;

  // Scene
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f0ebe3');

  // Camera — aspect set later in syncSize
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 0, 0);

  // Renderer — don't set size yet, canvas may be 0×0
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Sync renderer size to actual canvas dimensions
  function syncSize() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (w === 0 || h === 0) return false;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    return true;
  }

  // Lights
  var ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  var directional = new THREE.DirectionalLight(0xffffff, 1.0);
  directional.position.set(5, 8, 4);
  scene.add(directional);

  // Model pivot — rotations apply to this group so the axis is always centered
  var pivot = null;
  var loader = new GLTFLoader();
  loader.load(modelPath, function (gltf) {
    var model = gltf.scene;

    // Compute bounding box and scale
    var box = new THREE.Box3().setFromObject(model);
    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());

    var maxDim = Math.max(size.x, size.y, size.z);
    var scale = 3 / maxDim;
    model.scale.setScalar(scale);

    // Offset model inside pivot so bounding box center sits at pivot origin
    model.position.set(
      -center.x * scale,
      -center.y * scale,
      -center.z * scale
    );

    // Pivot group sits at scene origin — all rotations happen around the center
    pivot = new THREE.Group();
    pivot.add(model);
    scene.add(pivot);

    // If section is already visible when model loads, start intro
    if (isVisible && !introPlayed) startIntro();
  });

  // Scroll hint
  var hint = section.querySelector('.model-scroll-hint');

  // Intro animation state
  var introPlayed = false;
  var introRunning = false;
  var introStart = 0;
  var introDuration = 1600; // ms

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Scroll-driven rotation
  function getScrollProgress() {
    var rect = section.getBoundingClientRect();
    var sectionTop = window.scrollY + rect.top;
    var sectionHeight = section.offsetHeight;
    var viewportHeight = window.innerHeight;
    var progress = (window.scrollY - sectionTop) / (sectionHeight - viewportHeight);
    return Math.max(0, Math.min(1, progress));
  }

  // Auto-rotate state
  var autoRotate = false;
  var autoRotateSpeed = 0.005; // radians per frame

  function onScroll() {
    if (introRunning || autoRotate) return;

    var progress = getScrollProgress();

    if (pivot && introPlayed) {
      pivot.rotation.y = progress * Math.PI * 2;
      pivot.rotation.x = Math.sin(progress * Math.PI * 2) * 0.15;
    }

    if (hint) {
      hint.style.opacity = Math.max(0, 1 - progress * 5);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // Render loop — only when visible
  var isVisible = false;
  var animId = null;

  function renderLoop(timestamp) {
    if (!isVisible) { animId = null; return; }
    if (!syncSize()) { animId = requestAnimationFrame(renderLoop); return; }

    // Intro animation
    if (introRunning && pivot) {
      if (!introStart) introStart = timestamp;
      var elapsed = timestamp - introStart;
      var t = Math.min(elapsed / introDuration, 1);
      var eased = easeOutCubic(t);

      // Rotate from PI (180°) to 0, with subtle X tilt
      pivot.rotation.y = Math.PI * (1 - eased);
      pivot.rotation.x = Math.sin(Math.PI * (1 - eased)) * 0.30;

      if (t >= 1) {
        introRunning = false;
        introPlayed = true;
        pivot.rotation.y = 0;
        pivot.rotation.x = 0;
        // Apply current scroll position immediately
        onScroll();
      }
    }

    // Auto-rotate
    if (autoRotate && pivot && !introRunning) {
      pivot.rotation.y += autoRotateSpeed;
      pivot.rotation.x = Math.sin(pivot.rotation.y) * 0.15;
    }

    renderer.render(scene, camera);
    animId = requestAnimationFrame(renderLoop);
  }

  function startIntro() {
    if (introPlayed || introRunning) return;
    if (!pivot) return;
    introRunning = true;
    introStart = 0;
    pivot.rotation.y = Math.PI;
    canvas.classList.add('visible');
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      isVisible = entry.isIntersecting;
      if (isVisible && animId === null) {
        if (!introPlayed && pivot) startIntro();
        renderLoop(performance.now());
      } else if (!isVisible && animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    });
  }, { threshold: 0 });

  observer.observe(section);

  // Wireframe toggle
  var wireframeBtn = section.querySelector('.model-wireframe-toggle');
  var wireframeOn = false;

  function setWireframe(enabled) {
    if (!pivot) return;
    pivot.traverse(function (child) {
      if (child.isMesh && child.material) {
        var mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(function (mat) { mat.wireframe = enabled; });
      }
    });
  }

  if (wireframeBtn) {
    wireframeBtn.addEventListener('click', function () {
      wireframeOn = !wireframeOn;
      setWireframe(wireframeOn);
      wireframeBtn.classList.toggle('active', wireframeOn);
    });
  }

  // Auto-rotate toggle
  var autoRotateBtn = section.querySelector('.model-autorotate-toggle');
  if (autoRotateBtn) {
    autoRotateBtn.addEventListener('click', function () {
      autoRotate = !autoRotate;
      autoRotateBtn.classList.toggle('active', autoRotate);
    });
  }

  // Resize
  window.addEventListener('resize', function () {
    syncSize();
  });
}

// Initialize all model sections
document.querySelectorAll('.model-section').forEach(initModelViewer);
