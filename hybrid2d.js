// --- HYBRID 2D ORBITAL ENGINE ---

// 1. Classes
class Particle {
    constructor(x, y, vx, vy, color) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = 1.0; this.color = color;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.02; }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class Laser {
    constructor(x, y, angle, speed) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
    }
    update(planets, gravityConstant, width, height) {
        planets.forEach(p => {
            let dx = p.x - this.x; let dy = p.y - this.y;
            let distSq = dx * dx + dy * dy;
            let dist = Math.sqrt(distSq);
            if (dist > p.radius) {
                let force = gravityConstant * 500 / distSq;
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            }
        });
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.01;
    }
    draw(ctx) {
        ctx.fillStyle = '#00f2ff';
        ctx.globalAlpha = this.life;
        ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Asteroid {
    constructor(x, y, vx, vy, radius) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.radius = radius;
        this.points = [];
        const segs = 8;
        for (let i = 0; i < segs; i++) {
            let a = (i / segs) * Math.PI * 2;
            let d = radius * (0.8 + Math.random() * 0.4);
            this.points.push({ x: Math.cos(a) * d, y: Math.sin(a) * d });
        }
    }
    update(planets, gravityConstant) {
        planets.forEach(p => {
            let dx = p.x - this.x; let dy = p.y - this.y;
            let distSq = dx * dx + dy * dy;
            let dist = Math.sqrt(distSq);
            if (dist > p.radius) {
                let force = gravityConstant * 1000 / distSq;
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            } else {
                this.vx *= -0.8; this.vy *= -0.8;
            }
        });
        this.x += this.vx; this.y += this.vy;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = '#94a3b8';
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
}

class Planet {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
    }
    draw(ctx) {
        let grad = ctx.createRadialGradient(this.x - 10, this.y - 10, 5, this.x, this.y, this.radius);
        grad.addColorStop(0, '#fff'); grad.addColorStop(1, this.color);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    }
}

// 2. State & Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ui = {
    modeText: document.getElementById('view-mode-text'),
    vel: document.getElementById('vel-val'),
    gravSlider: document.getElementById('gravity-slider'),
    gravDisp: document.getElementById('gravity-display'),
    thrustLvl: document.getElementById('thrust-lvl'),
    thrustBar: document.getElementById('thrust-bar'),
    resetBtn: document.getElementById('reset-btn'),
    igniteBtn: document.getElementById('ignite-btn'),
    boot: document.getElementById('boot-screen')
};

let width, height;
let gameActive = false;
let currentMode = 'STRATEGIC MAP';
let gravityConstant = 0.2;
let thrustPower = 1;
let lastFireTime = 0;
const keys = {};

let planets = [], asteroids = [], lasers = [], particles = [];
const ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2,
    size: 15, thrust: 0.08, rotSpeed: 0.06
};

// 3. Logic
function init() {
    resize();
    resetGame();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.key >= '1' && e.key <= '9') {
            thrustPower = parseInt(e.key);
            ui.thrustLvl.innerText = thrustPower;
            ui.thrustBar.style.width = `${(thrustPower / 9) * 100}%`;
        }
        if (e.code === 'KeyV') toggleView();
        if (e.code === 'KeyR') resetGame();
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    ui.gravSlider.oninput = (e) => {
        gravityConstant = e.target.value / 1000;
        ui.gravDisp.innerText = (gravityConstant * 10).toFixed(1);
    };
    ui.resetBtn.onclick = resetGame;
    ui.igniteBtn.onclick = () => { ui.boot.style.display = 'none'; gameActive = true; };

    loop();
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

function resetGame() {
    ship.x = width / 2; ship.y = height / 2 - 200;
    ship.vx = 2; ship.vy = 0; ship.angle = 0;
    planets = [new Planet(width / 2, height / 2, 60, '#7000ff')];
    asteroids = []; lasers = []; particles = [];
    for (let i = 0; i < 10; i++) spawnAsteroid();
}

function spawnAsteroid() {
    let aRows = 100 + Math.random() * 300;
    let ang = Math.random() * Math.PI * 2;
    let ax = width / 2 + Math.cos(ang) * aRows;
    let ay = height / 2 + Math.sin(ang) * aRows;
    asteroids.push(new Asteroid(ax, ay, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 15 + Math.random() * 15));
}

function toggleView() {
    currentMode = (currentMode === 'STRATEGIC MAP') ? 'TACTICAL COCKPIT' : 'STRATEGIC MAP';
    ui.modeText.innerText = currentMode;
}

function update() {
    if (!gameActive) return;

    if (keys['KeyA'] || keys['ArrowLeft']) ship.angle -= ship.rotSpeed;
    if (keys['KeyD'] || keys['ArrowRight']) ship.angle += ship.rotSpeed;

    if (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) {
        let acc = ship.thrust * (thrustPower / 2);
        ship.vx += Math.cos(ship.angle) * acc;
        ship.vy += Math.sin(ship.angle) * acc;
        // Particles
        for (let i = 0; i < 2; i++) particles.push(new Particle(ship.x, ship.y, (Math.random() - 0.5) - Math.cos(ship.angle) * 2, (Math.random() - 0.5) - Math.sin(ship.angle) * 2, '#00f2ff'));
    }

    if (keys['KeyF'] && Date.now() - lastFireTime > 200) {
        lasers.push(new Laser(ship.x, ship.y, ship.angle, 8));
        lastFireTime = Date.now();
    }

    // Gravity
    planets.forEach(p => {
        let dx = p.x - ship.x; let dy = p.y - ship.y;
        let distSq = dx * dx + dy * dy;
        let dist = Math.sqrt(distSq);
        if (dist > p.radius) {
            let force = gravityConstant * 2000 / distSq;
            ship.vx += (dx / dist) * force;
            ship.vy += (dy / dist) * force;
        } else {
            ship.vx *= -0.5; ship.vy *= -0.5;
        }
    });

    ship.x += ship.vx; ship.y += ship.vy;

    asteroids.forEach(a => a.update(planets, gravityConstant));
    lasers.forEach(l => l.update(planets, gravityConstant, width, height));
    particles.forEach(p => p.update());

    lasers = lasers.filter(l => l.life > 0);
    particles = particles.filter(p => p.life > 0);

    ui.vel.innerText = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy).toFixed(2);
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    if (currentMode === 'TACTICAL COCKPIT') {
        ctx.save();
        // The "Front Window" is effectively at the center of the screen
        // We move the ship slightly back from center to see the nose
        const lookHeight = height * 0.4;
        const shipScreenY = height * 0.85;

        ctx.translate(width / 2, shipScreenY);
        // Rotate the world opposite to the ship's angle so ship points UP
        ctx.rotate(-ship.angle - Math.PI / 2);
        ctx.translate(-ship.x, -ship.y);
        renderScene();
        ctx.restore();

        // Overlay Cockpit
        drawCockpitOverlay();

        // Draw the ship's nose pointing UP in screen space
        drawShip(width / 2, shipScreenY, -Math.PI / 2, true);
    } else {
        ctx.save();
        // Strategic: Ship is in world coords, camera follows loosely
        ctx.translate(width / 2 - ship.x, height / 2 - ship.y);
        renderScene();
        drawShip(ship.x, ship.y, ship.angle);
        ctx.restore();
    }
}

function renderScene() {
    // Stars with basic coverage
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 150; i++) {
        let sx = (i * 379.5) % 3000; let sy = (i * 154.3) % 3000;
        ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
        ctx.beginPath(); ctx.arc(sx, sy, 0.8 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    planets.forEach(p => p.draw(ctx));
    asteroids.forEach(a => a.draw(ctx));
    lasers.forEach(l => l.draw(ctx));
    particles.forEach(p => p.draw(ctx));
}

function drawCockpitOverlay() {
    // 1. Dashboard (Bottom)
    const dashGrad = ctx.createLinearGradient(0, height * 0.75, 0, height);
    dashGrad.addColorStop(0, '#0a101a');
    dashGrad.addColorStop(1, '#020508');
    ctx.fillStyle = dashGrad;
    ctx.fillRect(0, height * 0.75, width, height * 0.25);

    // 2. Cockpit Frame (Pillars)
    ctx.fillStyle = '#050a14';
    // Left Pillar
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width * 0.15, height * 0.75);
    ctx.lineTo(width * 0.05, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    // Right Pillar
    ctx.beginPath();
    ctx.moveTo(width, height);
    ctx.lineTo(width * 0.85, height * 0.75);
    ctx.lineTo(width * 0.95, 0);
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.fill();
    // Top Frame
    ctx.fillRect(0, 0, width, height * 0.05);

    // 3. HUD Details
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.2)';
    ctx.lineWidth = 1;
    // Aiming Reticle Circle
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.4, 40, 0, Math.PI * 2);
    ctx.stroke();
    // Horizon Line
    ctx.beginPath();
    ctx.moveTo(width / 2 - 100, height * 0.4);
    ctx.lineTo(width / 2 - 50, height * 0.4);
    ctx.moveTo(width / 2 + 50, height * 0.4);
    ctx.lineTo(width / 2 + 100, height * 0.4);
    ctx.stroke();

    // 4. Glass Reflection Effect
    const reflGrad = ctx.createLinearGradient(0, 0, width, height);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    reflGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = reflGrad;
    ctx.fillRect(width * 0.15, height * 0.05, width * 0.7, height * 0.7);
}

function drawShip(x, y, angle, isCockpit = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (isCockpit) {
        // Just the nose and some interior structure
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(-10, -15);
        ctx.lineTo(-10, 15);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#050a14';
        ctx.fill();
    } else {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-10, -7);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 7);
        ctx.closePath();
        ctx.stroke();
    }
    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

init();
