import * as THREE from 'three';

// --- CONFIGURATION ---
// These values define the core physics and game balance
const CONFIG = {
    G: 0.1,                 // Gravitational constant
    PLANET_RADIUS: 50,      // Size of the central planet
    PLANET_MASS: 5000,      // Strength of the planet's pull
    SHIP_ACCEL: 0.5,        // How fast the ship accelerates per frame
    SHIP_ROT_SPEED: 0.02,   // Rotation sensitivity
    ASTEROID_COUNT: 20,     // Number of asteroids in the field
    FIRE_RATE: 250          // Delay between laser shots (ms)
};

// --- GAME STATE ---
let scene, camera, renderer;
let shipVelocity = new THREE.Vector3();         // Vector tracking current drift
let shipRotation = new THREE.Euler(0, 0, 0, 'YXZ'); // Euler angles for 3D rotation
let keys = {};                                  // Map of currently pressed keys
let thrustLvl = 1;                              // Current thrust multiplier (1-9)
let lastFireTime = 0;                           // Throttle for laser firing
let gameActive = false;                         // True after ignition button pressed

// --- OBJECT ARRAYS ---
let planet, stars, asteroids = [], projectiles = [];

// --- UI ELEMENT CACHE ---
const ui = {
    velocity: document.getElementById('vel-val'),
    altitude: document.getElementById('alt-val'),
    thrustLvl: document.getElementById('thrust-lvl'),
    thrustBar: document.getElementById('thrust-bar'),
    igniteBtn: document.getElementById('ignite-btn'),
    bootScreen: document.getElementById('boot-screen')
};

/**
 * Main Initialization function
 * Sets up the 3D world, lights, textures, and event listeners
 */
function init() {
    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    // 2. WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 3. Central Planet Generation
    const planetGeom = new THREE.SphereGeometry(CONFIG.PLANET_RADIUS, 32, 32);
    const planetMat = new THREE.MeshPhongMaterial({
        color: 0x4400ff,
        emissive: 0x110044,
        shininess: 100
    });
    planet = new THREE.Mesh(planetGeom, planetMat);
    scene.add(planet);

    // 4. Planet Glow (Aura) - A slightly larger sphere for atmosphere effect
    const auraGeom = new THREE.SphereGeometry(CONFIG.PLANET_RADIUS * 1.2, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide
    });
    const aura = new THREE.Mesh(auraGeom, auraMat);
    scene.add(aura);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft global light
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00f2ff, 2, 500); // Central light from planet
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // 6. Starfield Generation - Random particles in space
    const starGeom = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 5000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starCoords.push(x, y, z);
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
    stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // 7. Initial Asteroid Spawn
    for (let i = 0; i < CONFIG.ASTEROID_COUNT; i++) {
        spawnAsteroid();
    }

    // 8. Start Position
    camera.position.set(0, 0, 150);

    // 9. Input & Window Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        // Handle numeric keys for thrust power levels
        if (e.key >= '1' && e.key <= '9') {
            thrustLvl = parseInt(e.key);
            ui.thrustLvl.innerText = thrustLvl;
            ui.thrustBar.style.width = `${(thrustLvl / 9) * 100}%`;
        }
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    ui.igniteBtn.onclick = () => {
        ui.bootScreen.style.display = 'none';
        gameActive = true;
    };

    animate();
}

/**
 * Spawns a new asteroid in a mathematical orbit around the planet
 */
function spawnAsteroid() {
    const radius = 2 + Math.random() * 5; // Variation in size
    const geom = new THREE.IcosahedronGeometry(radius, 0);
    const mat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
    const asteroid = new THREE.Mesh(geom, mat);

    // Position in a ring orbit (donut shape)
    const orbitDist = 100 + Math.random() * 100;
    const angle = Math.random() * Math.PI * 2;
    asteroid.position.set(Math.cos(angle) * orbitDist, (Math.random() - 0.5) * 50, Math.sin(angle) * orbitDist);

    // Set stable orbital velocity (v = sqrt(G*M / r))
    const vMag = Math.sqrt(CONFIG.G * CONFIG.PLANET_MASS / orbitDist);
    asteroid.userData.velocity = new THREE.Vector3(
        -Math.sin(angle) * vMag,
        (Math.random() - 0.5) * 0.5,
        Math.cos(angle) * vMag
    );

    scene.add(asteroid);
    asteroids.push(asteroid);
}

/**
 * Handles per-frame keyboard input for flight control
 */
function handleInput() {
    if (!gameActive) return;

    // --- ROTATION LOGIC ---
    // (Arrows are inverted on X-axis for flight-sim feel)
    if (keys['KeyW']) shipRotation.x -= CONFIG.SHIP_ROT_SPEED;
    if (keys['ArrowUp']) shipRotation.x += CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyS']) shipRotation.x += CONFIG.SHIP_ROT_SPEED;
    if (keys['ArrowDown']) shipRotation.x -= CONFIG.SHIP_ROT_SPEED;

    if (keys['KeyA']) shipRotation.y += CONFIG.SHIP_ROT_SPEED;
    if (keys['ArrowLeft']) shipRotation.y += CONFIG.SHIP_ROT_SPEED;
    if (keys['KeyD']) shipRotation.y -= CONFIG.SHIP_ROT_SPEED;
    if (keys['ArrowRight']) shipRotation.y -= CONFIG.SHIP_ROT_SPEED;

    if (keys['KeyQ']) shipRotation.z += CONFIG.SHIP_ROT_SPEED; // Roll Left
    if (keys['KeyE']) shipRotation.z -= CONFIG.SHIP_ROT_SPEED; // Roll Right

    // Apply rotation to the camera (the cockpit)
    camera.setRotationFromEuler(shipRotation);

    // --- THRUST LOGIC ---
    // Forward movement based on the ship's current orientation
    if (keys['Space'] || keys['ShiftRight'] || keys['ControlRight']) {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        shipVelocity.add(direction.multiplyScalar(CONFIG.SHIP_ACCEL * (thrustLvl / 5) * 0.05));
    }

    // --- COMBAT LOGIC ---
    if ((keys['KeyF'] || keys['ShiftLeft']) && Date.now() - lastFireTime > CONFIG.FIRE_RATE) {
        fireProjectile();
        lastFireTime = Date.now();
    }
}

/**
 * Fires a laser bolt from the ship's position
 */
function fireProjectile() {
    const geom = new THREE.CylinderGeometry(0.1, 0.1, 2);
    geom.rotateX(Math.PI / 2); // Align cylinder with flight path
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
    const p = new THREE.Mesh(geom, mat);

    p.position.copy(camera.position);
    p.quaternion.copy(camera.quaternion);

    // Calculate projectile vector: Forward Dir * Speed + Current Ship Speed
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    p.userData.velocity = dir.multiplyScalar(5).add(shipVelocity);
    p.userData.birth = Date.now();

    scene.add(p);
    projectiles.push(p);
}

/**
 * Core Physics Engine:
 * Calculates gravity, moves all objects, and checks for collisions
 */
function updatePhysics() {
    if (!gameActive) return;

    // 1. Gravity calculation for the Ship
    const shipToPlanet = new THREE.Vector3(0, 0, 0).sub(camera.position);
    const distSq = shipToPlanet.lengthSq();
    const dist = Math.sqrt(distSq);

    if (dist > CONFIG.PLANET_RADIUS) {
        // Newton's Law of Universal Gravitation
        const forceMag = (CONFIG.G * CONFIG.PLANET_MASS) / distSq;
        const force = shipToPlanet.normalize().multiplyScalar(forceMag * 0.05);
        shipVelocity.add(force);
    } else {
        // Collision with planet (Impulse bounce)
        shipVelocity.multiplyScalar(-0.2);
    }

    // Apply Ship Velocity to Position
    camera.position.add(shipVelocity);

    // 2. Gravitational forces on Asteroids
    asteroids.forEach(a => {
        const aToP = new THREE.Vector3(0, 0, 0).sub(a.position);
        const dSq = aToP.lengthSq();
        const fMag = (CONFIG.G * CONFIG.PLANET_MASS) / dSq;
        a.userData.velocity.add(aToP.normalize().multiplyScalar(fMag * 0.05));
        a.position.add(a.userData.velocity);

        // Idle rotation for asteroids
        a.rotation.x += 0.01;
        a.rotation.y += 0.01;
    });

    // 3. Projectile Updates & Collision Detection
    projectiles = projectiles.filter(p => {
        p.position.add(p.userData.velocity);

        let hit = false;
        // Check collision against all asteroids
        asteroids.forEach((a, idx) => {
            if (p.position.distanceTo(a.position) < a.geometry.parameters.radius + 1) {
                scene.remove(a);
                asteroids.splice(idx, 1);
                hit = true;
                spawnAsteroid(); // Ensure the field stays populated
            }
        });

        // Kill laser after 2 seconds or on impact
        if (Date.now() - p.userData.birth > 2000 || hit) {
            scene.remove(p);
            return false;
        }
        return true;
    });

    // 4. Update HUD Statistics
    ui.velocity.innerText = shipVelocity.length().toFixed(2);
    ui.altitude.innerText = (dist - CONFIG.PLANET_RADIUS).toFixed(0);
}

/**
 * Ensures the WebGL view stays fullscreen if the window is resized
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * High-performance Game Loop (60 FPS target)
 */
function animate() {
    requestAnimationFrame(animate);
    handleInput();      // Process user movement
    updatePhysics();    // Calculate orbital math
    renderer.render(scene, camera); // Redraw the world
}

// LIFT OFF!
init();
