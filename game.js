// --- 1. Class and Function Definitions ---

class Particle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Laser {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.radius = 2;
    }

    update(planets, gravityConstant, width, height) {
        const subSteps = 4;
        for (let s = 0; s < subSteps; s++) {
            planets.forEach(p => {
                const { dx, dy, distSq } = getToroidalDist(this.x, this.y, p.x, p.y);
                const dist = Math.sqrt(distSq);

                if (dist > p.radius) {
                    // Constant adjusted for sub-stepping and slightly shallower falloff (1.8 instead of 2.0)
                    // This makes the field reach out much further
                    const force = (gravityConstant * 1500 / Math.pow(dist, 1.8)) / subSteps;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }
            });

            this.x += this.vx / subSteps;
            this.y += this.vy / subSteps;

            if (this.x < 0) this.x += width;
            if (this.x > width) this.x -= width;
            if (this.y < 0) this.y += height;
            if (this.y > height) this.y -= height;
        }
        this.life -= 0.01;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f2ff';
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Asteroid {
    constructor(x, y, vx, vy, radius) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.points = [];
        const segments = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const dist = radius * (0.8 + Math.random() * 0.4);
            this.points.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
        }
    }

    update(planets, gravityConstant, width, height) {
        const subSteps = 4;
        for (let s = 0; s < subSteps; s++) {
            planets.forEach(p => {
                const { dx, dy, distSq } = getToroidalDist(this.x, this.y, p.x, p.y);
                const dist = Math.sqrt(distSq);

                if (dist > p.radius) {
                    const force = (gravityConstant * 3000 / Math.pow(dist, 1.8)) / subSteps;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                } else {
                    this.vx *= -0.8;
                    this.vy *= -0.8;
                    const overlap = p.radius + this.radius - dist;
                    this.x -= (dx / dist) * overlap;
                    this.y -= (dy / dist) * overlap;
                }
            });

            this.x += this.vx / subSteps;
            this.y += this.vy / subSteps;

            if (this.x < -50) this.x += width + 100;
            if (this.x > width + 50) this.x -= width + 100;
            if (this.y < -50) this.y += height + 100;
            if (this.y > height + 50) this.y -= height + 100;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Planet {
    constructor(x, y, radius, color1, color2) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color1 = color1;
        this.color2 = color2;
    }

    draw(ctx) {
        const gradient = ctx.createRadialGradient(this.x, this.y, this.radius * 0.8, this.x, this.y, this.radius * 2);
        gradient.addColorStop(0, this.color1 + '4D');
        gradient.addColorStop(1, this.color1 + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        const bodyGradient = ctx.createRadialGradient(this.x - 10, this.y - 10, 10, this.x, this.y, this.radius);
        bodyGradient.addColorStop(0, this.color2);
        bodyGradient.addColorStop(1, this.color1);
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- 2. Initial Setup and DOM References ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const speedVal = document.getElementById('speed-val');
const thrustValDisplay = document.getElementById('thrust-val');
const gravitySlider = document.getElementById('gravity-slider');
const gravityDisplay = document.getElementById('gravity-display');
const planetsSlider = document.getElementById('planets-slider');
const planetsDisplay = document.getElementById('planets-display');
const asteroidsSlider = document.getElementById('asteroids-slider');
const asteroidsDisplay = document.getElementById('asteroids-display');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');

// Game State Values
let width, height;
let particles = [];
let lasers = [];
let asteroids = [];
let planets = [];
let maxAsteroids = 8;
let gameActive = false;
let gravityConstant = 0.2;
let lastFireTime = 0;
const FIRE_RATE = 200;

// Input State
const keys = {};
let thrustPower = 1;
const SHOW_TRAJECTORY = true;
const BRAKE_DAMPING = 0.98;

// --- 3. Functional Logic ---

function initPlanets(count) {
    planets = [];
    const colors = [
        { c1: '#7000ff', c2: '#00f2ff' },
        { c1: '#ff3c00', c2: '#ffcc00' },
        { c1: '#00ff88', c2: '#0088ff' }
    ];

    if (count === 1) {
        planets.push(new Planet(width / 2, height / 2, 60, colors[0].c1, colors[0].c2));
    } else if (count === 2) {
        planets.push(new Planet(width * 0.3, height / 2, 50, colors[0].c1, colors[0].c2));
        planets.push(new Planet(width * 0.7, height / 2, 50, colors[1].c1, colors[1].c2));
    } else if (count === 3) {
        planets.push(new Planet(width * 0.25, height * 0.3, 40, colors[0].c1, colors[0].c2));
        planets.push(new Planet(width * 0.75, height * 0.3, 40, colors[1].c1, colors[1].c2));
        planets.push(new Planet(width / 2, height * 0.7, 50, colors[2].c1, colors[2].c2));
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    if (planetsSlider) {
        initPlanets(parseInt(planetsSlider.value));
    }
}

function getToroidalDist(x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    if (dx > width / 2) dx -= width;
    if (dx < -width / 2) dx += width;
    if (dy > height / 2) dy -= height;
    if (dy < -height / 2) dy += height;
    return { dx, dy, distSq: dx * dx + dy * dy };
}

function resetGame() {
    particles = [];
    lasers = [];
    asteroids = [];
    ship.vx = 0;
    ship.vy = 0;
    ship.x = 150;
    ship.y = 150;
    ship.angle = -Math.PI / 2;
    initPlanets(parseInt(planetsSlider.value));
}

const ship = {
    x: 150,
    y: 150,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    rotationSpeed: 0.05,
    thrust: 0.05,
    size: 3.75,

    update() {
        if (!gameActive) return;

        if (keys['KeyA'] || keys['ArrowLeft']) this.angle -= this.rotationSpeed;
        if (keys['KeyD'] || keys['ArrowRight']) this.angle += this.rotationSpeed;

        if (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) {
            const acceleration = this.thrust * (thrustPower / 2);
            this.vx += Math.cos(this.angle) * acceleration;
            this.vy += Math.sin(this.angle) * acceleration;

            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(
                    this.x - Math.cos(this.angle) * this.size,
                    this.y - Math.sin(this.angle) * this.size,
                    (Math.random() - 0.5) * 2 - Math.cos(this.angle) * 2,
                    (Math.random() - 0.5) * 2 - Math.sin(this.angle) * 2,
                    '#00f2ff'
                ));
            }
        }

        if (keys['KeyF'] || keys['KeyM'] || keys['ShiftLeft']) {
            const now = Date.now();
            if (now - lastFireTime > FIRE_RATE) {
                lasers.push(new Laser(
                    this.x + Math.cos(this.angle) * this.size,
                    this.y + Math.sin(this.angle) * this.size,
                    this.angle,
                    7
                ));
                lastFireTime = now;
            }
        }

        // Retro-Brake (Active Dampening)
        if (keys['KeyS'] || keys['ArrowDown']) {
            this.vx *= BRAKE_DAMPING;
            this.vy *= BRAKE_DAMPING;
        }

        const subSteps = 4;
        for (let s = 0; s < subSteps; s++) {
            planets.forEach(p => {
                const { dx, dy, distSq } = getToroidalDist(this.x, this.y, p.x, p.y);
                const dist = Math.sqrt(distSq);

                if (dist > p.radius) {
                    // Shallow falloff for longer range (1.8)
                    const force = (gravityConstant * 4000 / Math.pow(dist, 1.8)) / subSteps;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                } else {
                    const overlap = p.radius - dist;
                    this.x -= (dx / dist) * overlap;
                    this.y -= (dy / dist) * overlap;
                    this.vx *= -0.5;
                    this.vy *= -0.5;
                }
            });

            this.x += this.vx / subSteps;
            this.y += this.vy / subSteps;

            if (this.x < 0) this.x += width;
            if (this.x > width) this.x -= width;
            if (this.y < 0) this.y += height;
            if (this.y > height) this.y -= height;
        }

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        speedVal.innerText = speed.toFixed(2);
    },

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) {
            ctx.fillStyle = '#ff3c00';
            ctx.beginPath();
            ctx.moveTo(-this.size, 0);
            ctx.lineTo(-this.size - (15 * 0.25) * (thrustPower / 3), 0);
            ctx.lineTo(-this.size, 1.25);
            ctx.closePath();
            ctx.fill();
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#05070a';
        ctx.beginPath();
        ctx.moveTo(this.size, 0);
        ctx.lineTo(-this.size, -this.size / 1.5);
        ctx.lineTo(-this.size / 2, 0);
        ctx.lineTo(-this.size, this.size / 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
};

const stars = Array.from({ length: 200 }, () => ({
    x: Math.random() * 2000,
    y: Math.random() * 2000,
    size: Math.random() * 2,
    opacity: Math.random()
}));

function drawStars(ctx, width, height) {
    ctx.fillStyle = '#fff';
    stars.forEach(s => {
        ctx.globalAlpha = s.opacity;
        ctx.beginPath();
        ctx.arc(s.x % width, s.y % height, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}

function spawnAsteroid() {
    if (asteroids.length >= maxAsteroids) return;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * width; y = -40; }
    else if (side === 1) { x = width + 40; y = Math.random() * height; }
    else if (side === 2) { x = Math.random() * width; y = height + 40; }
    else { x = -40; y = Math.random() * height; }
    const angle = Math.atan2(height / 2 - y, width / 2 - x) + (Math.random() - 0.5);
    const speed = 1 + Math.random() * 2;
    asteroids.push(new Asteroid(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 20 + Math.random() * 30));
}

// --- 4. Event Listeners ---

window.addEventListener('resize', resize);

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.key >= '1' && e.key <= '9') {
        thrustPower = parseInt(e.key);
        thrustValDisplay.innerText = thrustPower;
    }
    if (e.code === 'KeyR' && gameActive) {
        resetGame();
    }
});

window.addEventListener('keyup', (e) => keys[e.code] = false);

gravitySlider.addEventListener('input', (e) => {
    gravityConstant = e.target.value / 1000;
    gravityDisplay.innerText = (gravityConstant * 10).toFixed(1);
});

planetsSlider.addEventListener('input', (e) => {
    const count = parseInt(e.target.value);
    planetsDisplay.innerText = count;
    initPlanets(count);
});

asteroidsSlider.addEventListener('input', (e) => {
    maxAsteroids = parseInt(e.target.value);
    asteroidsDisplay.innerText = maxAsteroids;
});

startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    gameActive = true;
    initPlanets(parseInt(planetsSlider.value));
});

// --- 5. Main Loop ---

function loop() {
    ctx.clearRect(0, 0, width, height);

    drawStars(ctx, width, height);
    planets.forEach(p => p.draw(ctx));

    // Trajectory Projection
    if (gameActive && SHOW_TRAJECTORY) {
        let tx = ship.x;
        let ty = ship.y;
        let tvx = ship.vx;
        let tvy = ship.vy;

        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.4)';
        ctx.moveTo(tx, ty);

        for (let i = 0; i < 150; i++) {
            planets.forEach(p => {
                const { dx, dy, distSq } = getToroidalDist(tx, ty, p.x, p.y);
                const dist = Math.sqrt(distSq);
                if (dist > p.radius) {
                    const force = gravityConstant * 4000 / Math.pow(dist, 1.8);
                    tvx += (dx / dist) * force;
                    tvy += (dy / dist) * force;
                }
            });
            tx += tvx;
            ty += tvy;

            if (tx < 0) tx += width; if (tx > width) tx -= width;
            if (ty < 0) ty += height; if (ty > height) ty -= height;

            ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ship.update();
    ship.draw(ctx);

    lasers = lasers.filter(l => l.life > 0);
    lasers.forEach(l => {
        l.update(planets, gravityConstant, width, height);
        l.draw(ctx);
    });

    asteroids.forEach((a, aIdx) => {
        a.update(planets, gravityConstant, width, height);
        a.draw(ctx);

        lasers.forEach((l) => {
            const dx = a.x - l.x;
            const dy = a.y - l.y;
            if (Math.sqrt(dx * dx + dy * dy) < a.radius) {
                l.life = 0;
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(a.x, a.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, '#94a3b8'));
                }
                if (a.radius > 15) {
                    asteroids.push(new Asteroid(a.x, a.y, a.vx + (Math.random() - 0.5) * 2, a.vy + (Math.random() - 0.5) * 2, a.radius / 2));
                    asteroids.push(new Asteroid(a.x, a.y, a.vx + (Math.random() - 0.5) * 2, a.vy + (Math.random() - 0.5) * 2, a.radius / 2));
                }
                asteroids.splice(aIdx, 1);
            }
        });

        const dx = a.x - ship.x;
        const dy = a.y - ship.y;
        if (Math.sqrt(dx * dx + dy * dy) < a.radius + ship.size / 2) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / dist;
            const ny = dy / dist;
            ship.vx -= nx * 2;
            ship.vy -= ny * 2;
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(ship.x, ship.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, '#ff3c00'));
            }
        }
    });

    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw(ctx);
    });

    requestAnimationFrame(loop);
}

// Initial Kickoff
resize();
setInterval(() => {
    if (gameActive) spawnAsteroid();
}, 2000);
loop();
