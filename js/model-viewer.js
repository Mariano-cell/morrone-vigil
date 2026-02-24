import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function initModelViewer(section, index) {
  console.log('[3D] initModelViewer #' + index, section.dataset.model);
  var canvas = section.querySelector('.model-canvas');
  var modelPath = section.dataset.model;
  if (!canvas || !modelPath) { console.warn('[3D] #' + index + ' — missing canvas or modelPath'); return; }

  // Scene
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f0ebe3');

  // Camera — aspect set later in syncSize
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 0, 0);

  // Renderer — don't set size yet, canvas may be 0×0
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    console.log('[3D] #' + index + ' — WebGL renderer created OK');
  } catch (e) {
    console.error('[3D] #' + index + ' — WebGL renderer FAILED:', e);
    return;
  }

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
  var loadingStarted = false;

  function loadModel() {
    if (loadingStarted) return;
    loadingStarted = true;

    console.log('[3D] #' + index + ' — loading model:', modelPath);
    loader.load(
      modelPath,
      function (gltf) {
        console.log('[3D] #' + index + ' — model loaded OK');
        var model = gltf.scene;

        // Compute bounding box and scale
        var box = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size = box.getSize(new THREE.Vector3());

        var maxDim = Math.max(size.x, size.y, size.z);
        var scale = maxDim > 0 ? 3 / maxDim : 1;
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

        // Adjust camera distance dynamically to fit this model
        var boxAfter = new THREE.Box3().setFromObject(pivot);
        var scaledSize = boxAfter.getSize(new THREE.Vector3());
        var maxScaledDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
        var fovRad = camera.fov * (Math.PI / 180);
        var camDist = (maxScaledDim / 2) / Math.tan(fovRad / 2) * 1.6;
        pivot.position.y = 0;
        camera.position.set(0, maxScaledDim * 1.0, camDist);
        camera.lookAt(0, 0, 0);

        // Apply default wireframe if data-wireframe attribute is present
        if (section.hasAttribute('data-wireframe')) {
          wireframeOn = true;
          setWireframe(true);
          if (wireframeBtn) wireframeBtn.classList.add('active');
        }

        // Apply default auto-rotate if data-autorotate attribute is present
        if (section.hasAttribute('data-autorotate')) {
          autoRotate = true;
          if (autoRotateBtn) autoRotateBtn.classList.add('active');
        }

        // If section is already visible when model loads, start intro
        if (isVisible && !introPlayed) startIntro();
      },
      undefined,
      function (error) {
        console.error('Model load failed:', modelPath, error);
        if (hint) {
          hint.textContent = 'No se pudo cargar el modelo 3D';
          hint.style.opacity = '0.85';
        }
      }
    );
  }

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

  // Wheel-driven rotation — only when mouse is over the canvas column
  var canvasCol = section.querySelector('.model-canvas-col');
  var rotationY = 0;
  var wheelSensitivity = 0.003; // radians per pixel of deltaY

  // Auto-rotate state
  var autoRotate = false;
  var autoRotateSpeed = 0.005; // radians per frame

  if (canvasCol) {
    canvasCol.addEventListener('wheel', function (e) {
      if (!pivot || !introPlayed || autoRotate) return;
      e.preventDefault();
      rotationY += e.deltaY * wheelSensitivity;
      pivot.rotation.y = rotationY;
      if (hint) hint.style.opacity = '0';
    }, { passive: false });
  }

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

      // Rotate from PI (180°) to 0
      pivot.rotation.y = Math.PI * (1 - eased);

      if (t >= 1) {
        introRunning = false;
        introPlayed = true;
        pivot.rotation.y = 0;
        pivot.rotation.x = 0;
        rotationY = 0;
      }
    }

    // Auto-rotate
    if (autoRotate && pivot && !introRunning) {
      pivot.rotation.y += autoRotateSpeed;
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
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      isVisible = entry.isIntersecting;
      if (isVisible && animId === null) {
        console.log('[3D] #' + index + ' — section visible, canvas size:', canvas.clientWidth, 'x', canvas.clientHeight);
        canvas.classList.add('visible');
        loadModel();
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