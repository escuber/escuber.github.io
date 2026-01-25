const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const speedVal = document.getElementById('speed-val');
const thrustValDisplay = document.getElementById('thrust-val');
const gravitySlider = document.getElementById('gravity-slider');
const gravityDisplay = document.getElementById('gravity-display');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');

// Game State
let width, height;
let particles = [];
let lasers = [];
let asteroids = [];
let gameActive = false;
let gravityConstant = 0.2;
let lastFireTime = 0;
const FIRE_RATE = 200; // ms

// Input State
const keys = {};
let thrustPower = 1;

// Resize Handler
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

window.addEventListener('resize', resize);
resize();

// Input Listeners
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.key >= '1' && e.key <= '9') {
        thrustPower = parseInt(e.key);
        thrustValDisplay.innerText = thrustPower;
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

gravitySlider.addEventListener('input', (e) => {
    gravityConstant = e.target.value / 1000;
    gravityDisplay.innerText = (gravityConstant * 10).toFixed(1);
});

startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    gameActive = true;
});

// Particle System for Thrust
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

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Laser class
class Laser {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.radius = 2;
    }

    update() {
        // Gravity on lasers
        const dx = planet.x - this.x;
        const dy = planet.y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist > planet.radius) {
            const force = gravityConstant * 2000 / distSq;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.01;

        // Screen wrap
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    draw() {
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

// Asteroid class
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

    update() {
        // Gravity on asteroids
        const dx = planet.x - this.x;
        const dy = planet.y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist > planet.radius) {
            const force = gravityConstant * 5000 / distSq;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
        } else {
            // Collision with planet
            this.vx *= -0.8;
            this.vy *= -0.8;
            const overlap = planet.radius + this.radius - dist;
            this.x -= (dx / dist) * overlap;
            this.y -= (dy / dist) * overlap;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Screen wrap
        if (this.x < -50) this.x = width + 50;
        if (this.x > width + 50) this.x = -50;
        if (this.y < -50) this.y = height + 50;
        if (this.y > height + 50) this.y = -50;
    }

    draw() {
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

// Planet Object
const planet = {
    x: 0,
    y: 0,
    radius: 60,
    color1: '#7000ff',
    color2: '#00f2ff',
    draw() {
        this.x = width / 2;
        this.y = height / 2;

        // Glow
        const gradient = ctx.createRadialGradient(this.x, this.y, this.radius * 0.8, this.x, this.y, this.radius * 2);
        gradient.addColorStop(0, 'rgba(112, 0, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(112, 0, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const bodyGradient = ctx.createRadialGradient(this.x - 10, this.y - 10, 10, this.x, this.y, this.radius);
        bodyGradient.addColorStop(0, this.color2);
        bodyGradient.addColorStop(1, this.color1);
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
};

// Ship Object
const ship = {
    x: 200,
    y: 200,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    rotationSpeed: 0.05,
    thrust: 0.05,
    size: 15,

    update() {
        if (!gameActive) return;

        // Rotation
        if (keys['KeyA'] || keys['ArrowLeft']) this.angle -= this.rotationSpeed;
        if (keys['KeyD'] || keys['ArrowRight']) this.angle += this.rotationSpeed;

        // Thrust
        if (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) {
            const acceleration = this.thrust * (thrustPower / 2);
            this.vx += Math.cos(this.angle) * acceleration;
            this.vy += Math.sin(this.angle) * acceleration;

            // Particles
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(
                    this.x - Math.cos(this.angle) * 10,
                    this.y - Math.sin(this.angle) * 10,
                    (Math.random() - 0.5) * 2 - Math.cos(this.angle) * 2,
                    (Math.random() - 0.5) * 2 - Math.sin(this.angle) * 2,
                    '#00f2ff'
                ));
            }
        }

        // Fire Laser
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

        // Gravity
        const dx = planet.x - this.x;
        const dy = planet.y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist > planet.radius) {
            const force = gravityConstant * 5000 / distSq;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
        } else {
            // Collision with planet (soft bounce/reset)
            const overlap = planet.radius - dist;
            this.x -= (dx / dist) * overlap;
            this.y -= (dy / dist) * overlap;
            this.vx *= -0.5;
            this.vy *= -0.5;
        }

        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;

        // Screen wrap
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

        // Update UI
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        speedVal.innerText = speed.toFixed(2);
    },

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Flame effect if thrusting
        if (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) {
            ctx.fillStyle = '#ff3c00';
            ctx.beginPath();
            ctx.moveTo(-this.size, 0);
            ctx.lineTo(-this.size - 15 * (thrustPower / 3), 0);
            ctx.lineTo(-this.size, 5);
            ctx.closePath();
            ctx.fill();
        }

        // Ship body
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

// Background Stars
const stars = Array.from({ length: 200 }, () => ({
    x: Math.random() * 2000,
    y: Math.random() * 2000,
    size: Math.random() * 2,
    opacity: Math.random()
}));

function drawStars() {
    ctx.fillStyle = '#fff';
    stars.forEach(s => {
        ctx.globalAlpha = s.opacity;
        ctx.beginPath();
        ctx.arc(s.x % width, s.y % height, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}

// Asteroid Spawning
function spawnAsteroid() {
    if (asteroids.length > 8) return;

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

setInterval(() => {
    if (gameActive) spawnAsteroid();
}, 2000);

// Main Loop
function loop() {
    ctx.clearRect(0, 0, width, height);

    drawStars();
    planet.draw();

    ship.update();
    ship.draw();

    // Lasers
    lasers = lasers.filter(l => l.life > 0);
    lasers.forEach(l => {
        l.update();
        l.draw();
    });

    // Asteroids
    asteroids.forEach((a, aIdx) => {
        a.update();
        a.draw();

        // Check for laser hits
        lasers.forEach((l, lIdx) => {
            const dx = a.x - l.x;
            const dy = a.y - l.y;
            if (Math.sqrt(dx * dx + dy * dy) < a.radius) {
                // Hit!
                l.life = 0;
                // Explode particles
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(a.x, a.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, '#94a3b8'));
                }

                if (a.radius > 15) {
                    // Split
                    asteroids.push(new Asteroid(a.x, a.y, a.vx + (Math.random() - 0.5) * 2, a.vy + (Math.random() - 0.5) * 2, a.radius / 2));
                    asteroids.push(new Asteroid(a.x, a.y, a.vx + (Math.random() - 0.5) * 2, a.vy + (Math.random() - 0.5) * 2, a.radius / 2));
                }
                asteroids.splice(aIdx, 1);
            }
        });

        // Check for ship hit
        const dx = a.x - ship.x;
        const dy = a.y - ship.y;
        if (Math.sqrt(dx * dx + dy * dy) < a.radius + ship.size / 2) {
            // Ship bounce
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / dist;
            const ny = dy / dist;
            ship.vx -= nx * 2;
            ship.vy -= ny * 2;
            // Particles
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(ship.x, ship.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, '#ff3c00'));
            }
        }
    });

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    requestAnimationFrame(loop);
}

// Initialize ship position
ship.x = 150;
ship.y = 150;

loop();
