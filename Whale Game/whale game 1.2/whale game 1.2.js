// Game constants and state
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const messageBox = document.getElementById('message-box');
const finalScoreDisplay = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

let keys = {};
let gameLoopId;
let score = 0;
let isGameOver = true;
let whaleHit = false; 
let flareSpeed = 4;
const VIEWPORT_MARGIN = 200; 

// --- World and Wave Constants ---
const surfaceWorldY = -150; 
const waveAmplitude = 15;
const waveLength = 60;
let waveOffset = 0; 
const DODGE_DEPTH = 600; 

// --- WORLD BOUNDARIES ---
const WORLD_WIDTH = 3000; 
const WORLD_DEPTH = 1200; 
const WORLD_LEFT = -WORLD_WIDTH / 2;
const WORLD_RIGHT = WORLD_WIDTH / 2;
const WORLD_BOTTOM = surfaceWorldY + WORLD_DEPTH;

// Utility function to safely get CSS variables in JavaScript
const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Whale object now tracks its absolute world position
const whale = {
    worldX: 0,
    worldY: 0,
    radius: 25, // Slightly bigger whale - controls vertical height
    moveStep: 8,
    screenX: 0, 
    screenY: 0, 
    
    // NEW: Define collision box offsets based on the drawn shape
    // The whale is drawn from -114 (tail tip) to +31 (nose tip) relative to center.
    COLLISION_OFFSET_LEFT: -114, 
    COLLISION_OFFSET_RIGHT: 31,

    draw: function() {
        const whaleColor = whaleHit ? getCssVar('--ui-accent') : getCssVar('--whale-color'); 
        const centerX = this.screenX;
        const centerY = this.screenY + Math.sin(frameCount * 0.05) * 2; // Subtle vertical bobbing

        ctx.fillStyle = whaleColor;
        ctx.beginPath();
        
        // Draw main whale body using Bezier curves for organic shape
        const bodyWidth = this.radius * 2.5;
        const bodyHeight = this.radius; // Defined locally here

        // Nose tip
        ctx.moveTo(centerX + bodyWidth / 2, centerY);
        
        // Top curve
        ctx.bezierCurveTo(
            centerX + bodyWidth * 0.4, centerY - bodyHeight * 1.2, // Control 1 (Upper back)
            centerX - bodyWidth * 0.9, centerY - bodyHeight * 0.8, // Control 2 (Base of tail)
            centerX - bodyWidth * 1.5, centerY // End (Tail base)
        );

        // Bottom curve
        ctx.bezierCurveTo(
            centerX - bodyWidth * 0.9, centerY + bodyHeight * 0.8, // Control 2 (Base of tail)
            centerX + bodyWidth * 0.4, centerY + bodyHeight * 1.2, // Control 1 (Under belly)
            centerX + bodyWidth / 2, centerY // Back to Nose tip
        );
        
        ctx.closePath();
        ctx.fill();

        // Draw flickering tail fin (based on frame count)
        const tailX = centerX - bodyWidth * 1.5;
        ctx.fillStyle = getCssVar('--sea-blue-mid');
        ctx.beginPath();
        ctx.moveTo(tailX, centerY);
        // Simple flicker animation by changing the tip position
        const flicker = Math.sin(frameCount * 0.3) * 5; 
        ctx.lineTo(tailX - 20, centerY - 15 + flicker);
        ctx.lineTo(tailX - 20, centerY + 15 - flicker);
        ctx.closePath();
        ctx.fill();


        // Eye (small white dot)
        ctx.fillStyle = whaleHit ? 'black' : getCssVar('--text-light');
        ctx.beginPath();
        ctx.arc(centerX + bodyWidth * 0.3, centerY - bodyHeight * 0.4, 3, 0, Math.PI * 2);
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
        
        // ENFORCE WORLD BOUNDARIES
        const boundRadius = this.radius * 1.5; // Use a slightly larger radius for bounding 
        this.worldX = Math.max(WORLD_LEFT + boundRadius, 
                               Math.min(WORLD_RIGHT - boundRadius, this.worldX));
        this.worldY = Math.max(surfaceWorldY + this.radius * 0.6, this.worldY);
        this.worldY = Math.min(WORLD_BOTTOM - boundRadius, this.worldY);
    }
};

let bubbles = [];

function generateBubbles() {
    bubbles = []; 
    const bubbleAreaWidth = WORLD_RIGHT - WORLD_LEFT;
    const bubbleAreaHeight = WORLD_BOTTOM - surfaceWorldY;
    
    for(let i = 0; i < 150; i++) { 
        bubbles.push({
            worldX: WORLD_LEFT + Math.random() * bubbleAreaWidth, 
            worldY: surfaceWorldY + Math.random() * bubbleAreaHeight, 
            radius: Math.random() * 5 + 2, 
            opacity: Math.random() * 0.4 + 0.1 
        });
    }
}

function drawBubbles() {
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;

    bubbles.forEach(b => {
        const screenX = b.worldX - viewportWorldX;
        const screenY = b.worldY - viewportWorldY;

        if (screenX > -b.radius && screenX < canvas.width + b.radius &&
            screenY > -b.radius && screenY < canvas.height + b.radius) {
            
            ctx.fillStyle = `rgba(241, 250, 238, ${b.opacity})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, b.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

// --- NEW: DRAW SUNKEN LIGHT BEAMS (CAUSTICS) ---
function drawCaustics() {
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;
    const waveScreenY = surfaceWorldY - viewportWorldY;

    if (waveScreenY > canvas.height + 50) return; // Skip if surface is way off-screen

    // Draw caustics only from the surface down to a certain depth (e.g., 2/3 of screen)
    const depthLimit = Math.min(canvas.height, waveScreenY + 400);

    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        // Start X position based on world position for scrolling effect
        const startX = (i * 120 + frameCount * 3) % (canvas.width * 2) - canvas.width;

        for (let x = 0; x < canvas.width; x += 10) {
            // Calculate a wavy, scrolling light pattern
            const noise = Math.sin((x * 0.05) + frameCount * 0.01) * 30;
            const alphaFade = 1 - (x / canvas.width); // Fade horizontally

            const y1 = waveScreenY + x * 0.5 + noise; 
            const y2 = depthLimit; 

            if (x === 0) {
                ctx.moveTo(startX + x, y1);
            } else {
                ctx.lineTo(startX + x, y1);
            }
        }
        
        // Create a diagonal band shape and fill it
        ctx.lineTo(canvas.width + startX, depthLimit);
        ctx.lineTo(startX, depthLimit);
        ctx.closePath();

        // Fade vertically based on distance from the surface
        const gradient = ctx.createLinearGradient(0, waveScreenY, 0, depthLimit);
        gradient.addColorStop(0, getCssVar('--caustics-light'));
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}

// Draws the deep sea gradient
function drawSeaBackground() {
    const viewportWorldY = whale.worldY - whale.screenY;
    const waveScreenY = surfaceWorldY - viewportWorldY;

    // Draw the absolute bottom layer (Darkest Sea) to ensure background coverage
    ctx.fillStyle = getCssVar('--sea-blue-dark');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the Sea Gradient (Mid-Blue fading to Dark-Blue)
    const gradient = ctx.createLinearGradient(0, waveScreenY, 0, canvas.height);
    gradient.addColorStop(0, getCssVar('--sea-blue-mid')); 
    gradient.addColorStop(1, getCssVar('--sea-blue-dark')); 
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, Math.max(0, waveScreenY), canvas.width, canvas.height - Math.max(0, waveScreenY));

    // Draw caustics on top of the gradient
    drawCaustics();
}

// Draws the sky (atmosphere) layer
function drawSky() {
    const viewportWorldY = whale.worldY - whale.screenY;
    const waveScreenY = surfaceWorldY - viewportWorldY;

    if (waveScreenY > 0) {
        ctx.fillStyle = getCssVar('--sky-blue');
        ctx.fillRect(0, 0, canvas.width, waveScreenY);
        ctx.strokeStyle = '#a8dadc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, waveScreenY);
        ctx.lineTo(canvas.width, waveScreenY);
        ctx.stroke();
    }
}

// --- ENHANCED SEABED DRAWING FUNCTION ---
function drawSeabed() {
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;
    const seabedScreenY = WORLD_BOTTOM - viewportWorldY;

    if (seabedScreenY < canvas.height) {
        // 1. Draw solid ground
        ctx.fillStyle = getCssVar('--seabed-color'); 
        ctx.fillRect(0, seabedScreenY, canvas.width, canvas.height - seabedScreenY);

        // 2. Draw simple coral/rock structures
        ctx.fillStyle = '#4e3a47'; // Slightly lighter color for texture
        const structures = [
            { x: -500, w: 100, h: 40 }, { x: 100, w: 70, h: 30 }, 
            { x: 700, w: 150, h: 60 }, { x: -100, w: 50, h: 20 },
            { x: -1200, w: 200, h: 80 }
        ];

        structures.forEach(s => {
            // Calculate screen X
            const screenX = s.x - viewportWorldX;
            const screenY = seabedScreenY;
            
            // Draw a bumpy/rocky shape
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            // Use a curve for a rounded top
            ctx.quadraticCurveTo(screenX + s.w / 2, screenY - s.h, screenX + s.w, screenY);
            ctx.lineTo(screenX + s.w, canvas.height);
            ctx.lineTo(screenX, canvas.height);
            ctx.closePath();
            ctx.fill();
        });
    }
}

function drawWaves() {
    const viewportWorldY = whale.worldY - whale.screenY;
    const waveScreenY = surfaceWorldY - viewportWorldY;

    waveOffset += 0.05; 
    
    ctx.fillStyle = getCssVar('--sea-blue-mid');
    ctx.strokeStyle = getCssVar('--text-light');
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0, waveScreenY);

    const viewportWorldX = whale.worldX - whale.screenX;

    for (let x = 0; x <= canvas.width; x += 10) {
        const worldX = viewportWorldX + x;
        const y = waveScreenY + waveAmplitude * Math.sin((worldX + waveOffset * waveLength) / waveLength);
        ctx.lineTo(x, y);
    }

    // Fill the area below the wave line with a slight transparency
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Redraw the main wave line on top
    ctx.beginPath();
    ctx.moveTo(0, waveScreenY);
    for (let x = 0; x <= canvas.width; x += 10) {
        const worldX = viewportWorldX + x;
        const y = waveScreenY + waveAmplitude * Math.sin((worldX + waveOffset * waveLength) / waveLength);
        ctx.lineTo(x, y);
    }
    ctx.stroke();
}


// Flare object array
let flares = [];
const flareWidth = 25; 
const flareHeight = 60;
let frameCount = 0;
let flareInterval = 20; 
const TRAIL_MAX_AGE = 30; // Max points in trail

function createFlare() {
    const worldX = WORLD_LEFT + flareWidth + Math.random() * (WORLD_RIGHT - WORLD_LEFT - 2 * flareWidth);
    const worldY = surfaceWorldY - 500; 

    flares.push({
        worldX: worldX,
        worldY: worldY, 
        width: flareWidth,
        height: flareHeight,
        scored: false,
        trail: [] // NEW: Array to hold smoke/bubble trail points
    });
}

// --- NEW: DRAW FLARE TRAIL ---
function drawFlareTrail(f) {
    // Increased the base opacity to make the trail more visible
    f.trail.forEach(p => {
        // Calculate opacity based on age (fades out)
        const opacity = 1 - (p.age / TRAIL_MAX_AGE);
        // Increased max alpha from 0.4 to 0.7
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.7})`; 

        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, p.radius * opacity, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFlares() {
    const viewportWorldX = whale.worldX - whale.screenX;
    const viewportWorldY = whale.worldY - whale.screenY;

    flares.forEach(f => {
        const screenX = f.worldX - viewportWorldX;
        const screenY = f.worldY - viewportWorldY;

        // Update screen positions for the trail before drawing the flare
        f.trail.forEach(p => {
            p.screenX = p.worldX - viewportWorldX;
            p.screenY = p.worldY - viewportWorldY;
        });
        drawFlareTrail(f); // Draw the trail first

        // Determine transparency (more transparent underwater)
        let flareAlpha = 1.0;
        if (f.worldY > surfaceWorldY) {
            // Fade out slightly underwater
            flareAlpha = 0.7; 
        }

        ctx.globalAlpha = flareAlpha;

        // Draw Flare (Orange/Red Fire)
        ctx.fillStyle = getCssVar('--flare-orange');
        ctx.beginPath();
        ctx.moveTo(screenX + f.width / 2, screenY);
        ctx.lineTo(screenX + f.width, screenY + f.height);
        ctx.lineTo(screenX, screenY + f.height);
        ctx.closePath();
        ctx.fill();

        // Add a bright yellow glow/center
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(screenX + f.width/2, screenY + f.height * 0.4, 8, 0, Math.PI * 2); 
        ctx.fill();

        ctx.globalAlpha = 1.0; // Reset alpha
    });
}

function updateFlares() {
    flareSpeed = 4 + Math.floor(score / 10) * 0.5; 

    for (let i = flares.length - 1; i >= 0; i--) {
        let f = flares[i];
        
        // 1. Update Flare position
        f.worldY += flareSpeed;

        // 2. Update Trail
        if (frameCount % 3 === 0) { // Add a new trail point every few frames
            f.trail.push({
                worldX: f.worldX + f.width / 2 + (Math.random() - 0.5) * 5,
                worldY: f.worldY + f.height,
                radius: Math.random() * 3 + 1,
                age: 0
            });
        }
        // Age and clean up existing trail points
        for (let j = f.trail.length - 1; j >= 0; j--) {
            f.trail[j].age++;
            // Make bubbles rise slightly (Increased speed from 0.5 to 1.0)
            f.trail[j].worldY -= 1.0; 
            if (f.trail[j].age > TRAIL_MAX_AGE) {
                f.trail.splice(j, 1);
            }
        }

        // 3. Collision Check (Using a bounding box that covers the whale's full drawn shape)
        const whaleHitAreaTop = whale.screenY - whale.radius;
        const whaleHitAreaBottom = whale.screenY + whale.radius;
        const viewportWorldX = whale.worldX - whale.screenX;
        
        const screenX = f.worldX - viewportWorldX;
        const screenY = f.worldY - (whale.worldY - whale.screenY); // Corrected screenY calculation

        // Check vertical overlap using whale's radius (vertical dimension)
        if (screenY + f.height > whaleHitAreaTop && screenY < whaleHitAreaBottom) {
            
            // Check horizontal overlap using full whale body width
            const whaleLeft = whale.screenX + whale.COLLISION_OFFSET_LEFT;
            const whaleRight = whale.screenX + whale.COLLISION_OFFSET_RIGHT;

            // Check for overlap on X-axis: Flare's right edge (screenX + f.width) must be past whale's left edge (whaleLeft) 
            // AND Flare's left edge (screenX) must be before whale's right edge (whaleRight).
            if (screenX < whaleRight && screenX + f.width > whaleLeft) {
                handleCollision(); 
                return; 
            }
        }

        // 4. Scoring and Culling
        if (!f.scored && f.worldY > surfaceWorldY + DODGE_DEPTH) {
            score++;
            f.scored = true;
            scoreDisplay.textContent = `Flares Dodged: ${score}`;
        }
        
        const horizontalCull = Math.abs(f.worldX - whale.worldX) > canvas.width / 2 + VIEWPORT_MARGIN;
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

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    
    whale.screenX = canvas.width / 2;
    whale.screenY = canvas.height / 2;

    if (isGameOver) {
         whale.draw();
    }
}
window.addEventListener('resize', resizeCanvas);


// Main game loop
function gameLoop() {
    if (isGameOver && !whaleHit) { 
        return;
    }

    // 1. Clear & Background Layers (Crucial Order for Sky/Sea)
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    drawSky();             
    drawSeaBackground();   
    
    // 2. Update and Draw World Elements
    if (!isGameOver) { 
        whale.update();
        updateFlares();
    }
    
    drawBubbles();          
    drawSeabed();           
    drawWaves();            
    drawFlares();
    whale.draw(); 

    gameLoopId = requestAnimationFrame(gameLoop);
}

function startGame() {
    if (!isGameOver) return;

    isGameOver = false;
    whaleHit = false; 
    score = 0;
    whale.worldX = 0; 
    whale.worldY = 0; 
    flares = [];
    frameCount = 0;
    flareSpeed = 4;

    scoreDisplay.textContent = `Flares Dodged: ${score}`;
    messageBox.classList.remove('visible');

    generateBubbles();

    gameLoop();
}

function handleCollision() { 
    if (isGameOver) return;

    isGameOver = true; 
    whaleHit = true;

    setTimeout(() => {
        cancelAnimationFrame(gameLoopId);

        finalScoreDisplay.innerHTML = `Flares Dodged: ${score}`;
        messageBox.querySelector('h2').textContent = "Whale Struck!";
        messageBox.querySelector('p').textContent = "A burning flare hit the whale. Game Over!";
        messageBox.classList.add('visible');
        whaleHit = false; 
    }, 250); // Flash for 250ms
}

// Input Handlers (unchanged)
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
canvas.addEventListener('touchstart', (e) => { 
    if (isGameOver) startGame(); 
    e.preventDefault(); // Prevent scrolling on touch
});
restartButton.addEventListener('click', startGame);

// Run initial setup after everything loads
window.onload = function() {
    resizeCanvas(); 
    messageBox.innerHTML = `
        <h2>Whale Defender: Deep Dive</h2>
        <p>Protect the whale from the burning flares dropped from the surface!</p>
        <p style="margin-top: 15px;">**Controls:** Use the **Arrow Keys** or **W/A/S/D** to move.</p>
        <p style="margin-top: 5px; color: ${getCssVar('--flare-orange')}">Current Danger Level: INTENSE (Flares are fast!)</p>
        <button id="start-button">Start Dive</button>
    `;
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', startGame);
    messageBox.classList.add('visible');
    generateBubbles();
    whale.draw(); 
}