import * as THREE from 'three';

// --- CONFIGURATION ---
const CONFIG = {
    G: 0.1,
    PLANET_RADIUS: 50,
    PLANET_MASS: 5000,
    SHIP_ACCEL: 0.6,
    SHIP_ROT_SPEED: 0.025,
    ASTEROID_COUNT: 25,
    FIRE_RATE: 200,
    VIEW_MODES: {
        STRATEGIC: 'STRATEGIC MAP',
        TACTICAL: 'TACTICAL COCKPIT'
    }
};

// --- GAME STATE ---
let scene, camera, renderer;
let currentViewMode = CONFIG.VIEW_MODES.STRATEGIC;
let gameActive = false;
let lastFireTime = 0;
let thrustLvl = 1;

// Physics objects
const ship = {
    position: new THREE.Vector3(0, 0, 150),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    mesh: null
};

const keys = {};
const asteroids = [];
const projectiles = [];
let planet, stars;

// UI Elements
const ui = {
    viewMode: document.getElementById('view-mode-text'),
    crosshair: document.getElementById('pilot-crosshair'),
    velocity: document.getElementById('vel-val'),
    altitude: document.getElementById('alt-val'),
    thrustLvl: document.getElementById('thrust-lvl'),
    thrustBar: document.getElementById('thrust-bar'),
    igniteBtn: document.getElementById('ignite-btn'),
    bootScreen: document.getElementById('boot-screen')
};

/**
 * Initialize the Game
 */
function init() {
    // 1. Scene & Camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020408);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 3. Planet
    const planetGeom = new THREE.SphereGeometry(CONFIG.PLANET_RADIUS, 64, 64);
    const planetMat = new THREE.MeshPhongMaterial({
        color: 0x4400ff,
        emissive: 0x110044,
        shininess: 100,
        flatShading: false
    });
    planet = new THREE.Mesh(planetGeom, planetMat);
    scene.add(planet);

    // Atmosphere Glow
    const auraGeom = new THREE.SphereGeometry(CONFIG.PLANET_RADIUS * 1.15, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide
    });
    scene.add(new THREE.Mesh(auraGeom, auraMat));

    // 4. Lighting
    scene.add(new THREE.AmbientLight(0x404040, 0.5));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(100, 100, 100);
    scene.add(sunLight);

    const planetLight = new THREE.PointLight(0x00f2ff, 2, 600);
    scene.add(planetLight);

    // 5. Starfield
    const starGeom = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 8000; i++) {
        starPos.push((Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000);
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    stars = new THREE.Points(starGeom, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 }));
    scene.add(stars);

    // 6. Ship Mesh (Visible in Strategic Mode)
    const shipGeom = new THREE.ConeGeometry(1, 4, 8);
    shipGeom.rotateX(Math.PI / 2); // Align with Z-forward
    const shipMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x333333 });
    ship.mesh = new THREE.Mesh(shipGeom, shipMat);
    scene.add(ship.mesh);

    // 7. Asteroids
    for (let i = 0; i < CONFIG.ASTEROID_COUNT; i++) spawnAsteroid();

    // 8. View Initialization
    updateView();

    // 9. Events
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    ui.igniteBtn.onclick = () => {
        ui.bootScreen.style.display = 'none';
        gameActive = true;
    };

    animate();
}

function spawnAsteroid() {
    const size = 2 + Math.random() * 6;
    const geom = new THREE.IcosahedronGeometry(size, 1);
    const mat = new THREE.MeshPhongMaterial({
        color: 0x888888,
        flatShading: true,
        specular: 0x444444
    });
    const a = new THREE.Mesh(geom, mat);

    // Distribution in a disk
    const dist = 120 + Math.random() * 200;
    const angle = Math.random() * Math.PI * 2;
    a.position.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 40, Math.sin(angle) * dist);

    // Orbital velocity
    const vMag = Math.sqrt(CONFIG.G * CONFIG.PLANET_MASS / dist);
    a.userData.velocity = new THREE.Vector3(-Math.sin(angle) * vMag, (Math.random() - 0.5) * 0.2, Math.cos(angle) * vMag);

    scene.add(a);
    asteroids.push(a);
}

function onKeyDown(e) {
    keys[e.code] = true;
    if (e.key >= '1' && e.key <= '9') {
        thrustLvl = parseInt(e.key);
        ui.thrustLvl.innerText = thrustLvl;
        ui.thrustBar.style.width = `${(thrustLvl / 9) * 100}%`;
    }
    if (e.code === 'KeyV') {
        toggleView();
    }
}

function toggleView() {
    currentViewMode = (currentViewMode === CONFIG.VIEW_MODES.STRATEGIC)
        ? CONFIG.VIEW_MODES.TACTICAL
        : CONFIG.VIEW_MODES.STRATEGIC;

    updateView();
}

function updateView() {
    ui.viewMode.innerText = currentViewMode;
    if (currentViewMode === CONFIG.VIEW_MODES.TACTICAL) {
        ui.crosshair.style.display = 'flex';
        ship.mesh.visible = false;
        camera.fov = 85; // Wider for cockpit
    } else {
        ui.crosshair.style.display = 'none';
        ship.mesh.visible = true;
        camera.fov = 60; // Narrower for map
    }
    camera.updateProjectionMatrix();
}

function handleInput() {
    if (!gameActive) return;

    // Movement is based on current orientation
    // We use ship.rotation even in strategic mode for consistency
    if (keys['KeyW'] || keys['ArrowUp']) ship.rotation.x -= CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyS'] || keys['ArrowDown']) ship.rotation.x += CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyA'] || keys['ArrowLeft']) ship.rotation.y += CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyD'] || keys['ArrowRight']) ship.rotation.y -= CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyQ']) ship.rotation.z += CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyE']) ship.rotation.z -= CONFIG.SHIP_ROT_SPEED;

    // Apply Thrust
    if (keys['Space']) {
        const direction = new THREE.Vector3(0, 0, -1).applyEuler(ship.rotation);
        ship.velocity.add(direction.multiplyScalar(CONFIG.SHIP_ACCEL * (thrustLvl / 5) * 0.05));
    }

    // Combat
    if ((keys['KeyF'] || keys['ShiftLeft']) && Date.now() - lastFireTime > CONFIG.FIRE_RATE) {
        fire();
        lastFireTime = Date.now();
    }
}

function fire() {
    const geom = new THREE.CylinderGeometry(0.1, 0.1, 2.5);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
    const p = new THREE.Mesh(geom, mat);

    p.position.copy(ship.position);
    p.quaternion.setFromEuler(ship.rotation);

    const dir = new THREE.Vector3(0, 0, -1).applyEuler(ship.rotation);
    p.userData.velocity = dir.multiplyScalar(8).add(ship.velocity);
    p.userData.birth = Date.now();

    scene.add(p);
    projectiles.push(p);
}

function updatePhysics() {
    if (!gameActive) return;

    // Ship Gravity
    const toPlanet = new THREE.Vector3(0, 0, 0).sub(ship.position);
    const distSq = toPlanet.lengthSq();
    const dist = Math.sqrt(distSq);

    if (dist > CONFIG.PLANET_RADIUS) {
        // Stronger gravity for more dynamic orbital play
        const force = toPlanet.normalize().multiplyScalar((CONFIG.G * CONFIG.PLANET_MASS / Math.pow(dist, 1.8)) * 0.1);
        ship.velocity.add(force);
    } else {
        // Collision with planet
        const normal = ship.position.clone().normalize();
        ship.velocity.reflect(normal).multiplyScalar(0.4);
        ship.position.copy(normal.multiplyScalar(CONFIG.PLANET_RADIUS + 0.1));
    }

    ship.position.add(ship.velocity);
    ship.mesh.position.copy(ship.position);
    ship.mesh.setRotationFromEuler(ship.rotation);

    // Asteroids
    asteroids.forEach(a => {
        const aToP = new THREE.Vector3(0, 0, 0).sub(a.position);
        const dSq = aToP.lengthSq();
        const force = aToP.normalize().multiplyScalar((CONFIG.G * CONFIG.PLANET_MASS / dSq) * 0.05);
        a.userData.velocity.add(force);
        a.position.add(a.userData.velocity);
        a.rotation.x += 0.01;
        a.rotation.y += 0.01;
    });

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.position.add(p.userData.velocity);

        let hit = false;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const a = asteroids[j];
            if (p.position.distanceTo(a.position) < a.geometry.parameters.radius + 1) {
                scene.remove(a);
                asteroids.splice(j, 1);
                hit = true;
                spawnAsteroid();
                break;
            }
        }

        if (hit || Date.now() - p.userData.birth > 3000) {
            scene.remove(p);
            projectiles.splice(i, 1);
        }
    }

    // HUD
    const speed = ship.velocity.length();
    ui.velocity.innerText = speed.toFixed(2);
    ui.altitude.innerText = Math.max(0, dist - CONFIG.PLANET_RADIUS).toFixed(0);
}

function updateCamera() {
    if (currentViewMode === CONFIG.VIEW_MODES.TACTICAL) {
        // Cockpit view
        camera.position.copy(ship.position);
        camera.setRotationFromEuler(ship.rotation);

        // Tilt stars slightly for motion sensation
        stars.rotation.y += 0.0001;
    } else {
        // Strategic view
        const distance = 450;
        const targetPos = new THREE.Vector3(ship.position.x, ship.position.y + distance, ship.position.z);

        // Smooth camera movement
        camera.position.lerp(targetPos, 0.08);
        camera.up.set(0, 0, -1); // Align "up" with space forward
        camera.lookAt(ship.position);
    }
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    handleInput();
    updatePhysics();
    updateCamera();
    renderer.render(scene, camera);
}

init();
