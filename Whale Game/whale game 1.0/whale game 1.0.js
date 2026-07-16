// Game constants and state
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const messageBox = document.getElementById('message-box');
const finalScoreDisplay = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

// Input tracking for continuous movement
let keys = {};

let gameLoopId;
let score = 0;
let isGameOver = true;
let flareSpeed = 4;
const VIEWPORT_MARGIN = 200; // Extra distance to keep objects in memory

// --- Wave Constants (NEW) ---
const surfaceWorldY = -150; // World Y position of the water surface (above the whale's starting point 0)
const waveAmplitude = 15;
const waveLength = 60;
let waveOffset = 0; // For subtle, independent wave movement
const DODGE_DEPTH = 600; // Flares must fall this far past the surface to be considered dodged

// Whale object now tracks its absolute world position
const whale = {
    worldX: 0,
    worldY: 0,
    radius: 20,
    moveStep: 8,
    // Whale is always drawn at the center of the screen
    screenX: 0,
    screenY: 0,

    draw: function() {
        // Draw whale at its fixed screen position (center)
        ctx.fillStyle = '#457b9d'; // Whale color
        ctx.beginPath();
        ctx.arc(this.screenX, this.screenY, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Simple tail fin (triangle)
        ctx.fillStyle = '#1d3557';
        ctx.beginPath();
        ctx.moveTo(this.screenX - this.radius, this.screenY);
        ctx.lineTo(this.screenX - this.radius - 15, this.screenY - 10);
        ctx.lineTo(this.screenX - this.radius - 15, this.screenY + 10);
        ctx.closePath();
        ctx.fill();

        // Eye (small white dot)
        ctx.fillStyle = '#f1faee';
        ctx.beginPath();
        ctx.arc(this.screenX + this.radius / 2, this.screenY - this.radius / 3, 3, 0, Math.PI * 2);
        ctx.fill();
    },
    update: function() {
        // Update whale's world position based on input
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.worldX -= this.moveStep;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            this.worldX += this.moveStep;
        }
        if (keys['ArrowUp'] || keys['KeyW']) {
            this.worldY -= this.moveStep;
        }
        if (keys['ArrowDown'] || keys['KeyS']) {
            this.worldY += this.moveStep;
        }
    }
};

// Background bubbles array to demonstrate scrolling
let bubbles = [];

function generateBubbles() {
    // Create a set of static background bubbles across a large area
    for(let i = 0; i < 50; i++) {
        bubbles.push({
            worldX: Math.random() * 2000 - 1000, // Wide horizontal range
            worldY: Math.random() * 2000 - 1000, // Wide vertical range
            radius: Math.random() * 5 + 2, // Small to large bubbles
            opacity: Math.random() * 0.4 + 0.1 // Varying opacity for depth
        });
    }
}

function drawBackgroundElements() {
    // Calculate the world coordinates of the viewport's top-left corner
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;

    bubbles.forEach(b => {
        // Calculate screen position: object.world - viewport.world
        const screenX = b.worldX - viewportWorldX;
        const screenY = b.worldY - viewportWorldY;

        // Only draw if on screen (plus a margin)
        if (screenX > -b.radius && screenX < canvas.width + b.radius &&
            screenY > -b.radius && screenY < canvas.height + b.radius) {

            ctx.fillStyle = `rgba(241, 250, 238, ${b.opacity})`; // Off-white/light blue
            ctx.beginPath();
            ctx.arc(screenX, screenY, b.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

// --- New Wave Drawing Function ---
function drawWaves() {
    // Calculate the world coordinates of the viewport's top-left corner
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;

    // Calculate the screen Y position of the wave line
    const waveScreenY = surfaceWorldY - viewportWorldY;

    // Subtle independent wave movement for realism
    // *** CHANGE: Increased speed from 0.5 to 2.0 for visible animation ***
    waveOffset += 2.0;

    // 1. Draw the light surface fill
    ctx.fillStyle = 'rgba(168, 218, 220, 0.5)'; // Transparent light blue
    ctx.beginPath();
    ctx.moveTo(0, 0); // Start at top left

    // Follow the wave line
    for (let x = 0; x <= canvas.width + 10; x += 10) {
        const currentWorldX = viewportWorldX + x;
        // Sine wave calculation
        const y = waveScreenY + Math.sin(currentWorldX / waveLength + waveOffset / 100) * waveAmplitude;
        ctx.lineTo(x, y);
    }

    // Close the shape back to the top right corner
    ctx.lineTo(canvas.width, 0);
    ctx.closePath();
    ctx.fill();

    // 2. Draw the main wave line
    ctx.strokeStyle = '#a8dadc'; // Light blue/cyan for surface
    ctx.lineWidth = 3;
    ctx.beginPath();

    // Loop and draw the sine wave again for the line detail
    for (let x = -10; x <= canvas.width + 10; x += 10) {
        const currentWorldX = viewportWorldX + x;
        const y = waveScreenY + Math.sin(currentWorldX / waveLength + waveOffset / 100) * waveAmplitude;
        if (x === -10) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}
// ---------------------------------

// Flare object array
let flares = [];
const flareWidth = 15;
const flareHeight = 40;
let frameCount = 0;
let flareInterval = 40;

function createFlare() {
    // Generate a flare with a worldX position within the current viewport
    const viewportWorldXStart = whale.worldX - whale.screenX;

    // Random world X position within the viewport bounds
    const worldX = viewportWorldXStart + Math.random() * canvas.width;

    // World Y position is just above the fixed surface Y
    const worldY = surfaceWorldY - flareHeight;

    flares.push({
        worldX: worldX,
        worldY: worldY,
        width: flareWidth,
        height: flareHeight,
        scored: false
    });
}

function drawFlares() {
    // Calculate the world coordinates of the viewport's top-left corner
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;

    flares.forEach(f => {
        // Calculate screen position
        const screenX = f.worldX - viewportWorldX;
        const screenY = f.worldY - viewportWorldY;

        // Draw Flare (Orange/Red Fire)
        ctx.fillStyle = '#ff9900';
        ctx.beginPath();
        ctx.moveTo(screenX + f.width / 2, screenY);
        ctx.lineTo(screenX + f.width, screenY + f.height);
        ctx.lineTo(screenX, screenY + f.height);
        ctx.closePath();
        ctx.fill();

        // Add a bright yellow glow/center
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(screenX + f.width/2, screenY + 15, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function updateFlares() {
    flareSpeed = 4 + Math.floor(score / 10) * 0.5; // Gradually increase speed

    for (let i = flares.length - 1; i >= 0; i--) {
        let f = flares[i];

        // 1. Flares always fall down in world Y space
        f.worldY += flareSpeed;

        // 2. Determine screen position for collision and culling
        const viewportWorldX = whale.worldX - whale.screenX;
        const viewportWorldY = whale.worldY - whale.screenY;
        const screenX = f.worldX - viewportWorldX;
        const screenY = f.worldY - viewportWorldY;

        // 3. Check for scoring (flare passes far below the surface)
        if (!f.scored && f.worldY > surfaceWorldY + DODGE_DEPTH) {
            score++;
            f.scored = true;
            scoreDisplay.textContent = `Flares Dodged: ${score}`;
        }

        // 4. Collision Check (Screen coordinates for simplicity)
        // Collision is between the flare's screen position and the whale's fixed screen position (centerX, centerY)
        const whaleHitAreaTop = whale.screenY - whale.radius;
        const whaleHitAreaBottom = whale.screenY + whale.radius;

        if (screenY + f.height > whaleHitAreaTop && screenY < whaleHitAreaBottom) {
            // Check horizontal overlap
            if (screenX < whale.screenX + whale.radius && screenX + f.width > whale.screenX - whale.radius) {
                gameOver();
                return; // Exit loop immediately on game over
            }
        }

        // 5. Culling (Remove flares that are far away from the viewport)
        const horizontalCull = Math.abs(f.worldX - whale.worldX) > canvas.width / 2 + VIEWPORT_MARGIN;
        // Only cull if it's far below the whale's current worldY
        const verticalCull = f.worldY > whale.worldY + VIEWPORT_MARGIN * 2;

        if (horizontalCull || verticalCull) {
            flares.splice(i, 1);
        }
    }

    // Generate new flare
    frameCount++;
    if (frameCount % flareInterval === 0) {
        createFlare();
    }
}

// Initial sizing for responsiveness
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    // Set whale's fixed screen position (center of canvas)
    whale.screenX = canvas.width / 2;
    whale.screenY = canvas.height / 2;

    // In game over state, re-draw the whale in the center
    if (isGameOver) {
         whale.draw();
    }
}
window.addEventListener('resize', resizeCanvas);

// Main game loop
function gameLoop() {
    if (isGameOver) {
        return;
    }

    // 1. Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Update and Draw
    whale.update();
    drawBackgroundElements(); // Draw far background elements (bubbles)
    drawWaves();              // Draw the surface waves (NOW ANIMATED!)
    updateFlares();
    drawFlares();
    whale.draw(); // Draw whale fixed in the center

    gameLoopId = requestAnimationFrame(gameLoop);
}

function startGame() {
    if (!isGameOver) return;

    isGameOver = false;
    score = 0;
    // Reset world position to zero
    whale.worldX = 0;
    whale.worldY = 0;
    flares = [];
    frameCount = 0;
    flareSpeed = 4;

    scoreDisplay.textContent = `Flares Dodged: ${score}`;
    messageBox.classList.remove('visible');

    // Generate the initial set of bubbles if they don't exist
    if (bubbles.length === 0) {
        generateBubbles();
    }

    gameLoop();
}

function gameOver() {
    if (isGameOver) return;

    isGameOver = true;
    cancelAnimationFrame(gameLoopId);

    finalScoreDisplay.innerHTML = `Flares Dodged: ${score}`;
    messageBox.querySelector('h2').textContent = "Whale Struck!";
    messageBox.querySelector('p').textContent = "A burning flare hit the poor whale.";
    messageBox.classList.add('visible');
}

// Input Handlers
document.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        keys[e.code] = true;
        e.preventDefault();
    }
    if (isGameOver && (e.code === 'Space' || e.code === 'Enter')) {
        startGame();
    }
});

document.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        keys[e.code] = false;
    }
});

// Touch/Click for starting the game
canvas.addEventListener('click', () => { if (isGameOver) startGame(); });
canvas.addEventListener('touchstart', () => { if (isGameOver) startGame(); });
restartButton.addEventListener('click', startGame);

// Run initial setup after everything loads
window.onload = function() {
    resizeCanvas();
    // Show the initial "Game Over" box as an instruction screen
    messageBox.innerHTML = `
        <h2>Open World Dive!</h2>
        <p>Swim infinitely through the ocean and dodge the flares.</p>
        <p>The whale stays centered while the world scrolls around you, and now the **waves are visibly rolling!**</p>
        <p style="margin-top: 15px;">**Controls:** Use the **Arrow Keys** or **W/A/S/D**.</p>
        <button id="start-button">Start Dive</button>
    `;
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', startGame);
    messageBox.classList.add('visible');
    generateBubbles(); // Generate bubbles for the first time
    whale.draw();
}