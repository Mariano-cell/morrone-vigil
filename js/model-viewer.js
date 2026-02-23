(function () {
  var section = document.querySelector('.model-section');
  var canvas = document.getElementById('model-canvas');
  if (!section || !canvas) return;

  // Scene
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#f0ebe3');

  // Camera
  var camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 0, 0);

  // Renderer
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  // Lights
  var ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  var directional = new THREE.DirectionalLight(0xffffff, 1.0);
  directional.position.set(5, 8, 4);
  scene.add(directional);

  // Model
  var model = null;
  var loader = new THREE.GLTFLoader();
  loader.load('img/model.glb', function (gltf) {
    model = gltf.scene;

    // Center and scale
    var box = new THREE.Box3().setFromObject(model);
    var center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);
    var scale = 3 / maxDim;
    model.scale.setScalar(scale);

    scene.add(model);
  });

  // Scroll hint
  var hint = section.querySelector('.model-scroll-hint');

  // Scroll-driven rotation
  function onScroll() {
    var rect = section.getBoundingClientRect();
    var sectionTop = window.scrollY + rect.top;
    var sectionHeight = section.offsetHeight;
    var viewportHeight = window.innerHeight;
    var progress = (window.scrollY - sectionTop) / (sectionHeight - viewportHeight);
    progress = Math.max(0, Math.min(1, progress));

    if (model) {
      model.rotation.y = progress * Math.PI * 2;
    }

    // Fade out scroll hint
    if (hint) {
      hint.style.opacity = Math.max(0, 1 - progress * 5);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // Render loop — only when visible
  var isVisible = false;
  var animId = null;

  function renderLoop() {
    if (!isVisible) return;
    renderer.render(scene, camera);
    animId = requestAnimationFrame(renderLoop);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      isVisible = entry.isIntersecting;
      if (isVisible && !animId) {
        renderLoop();
      } else if (!isVisible && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    });
  }, { threshold: 0 });

  observer.observe(section);

  // Resize
  window.addEventListener('resize', function () {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();
