// Game constants and state
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = document.getElementById('score-display');
        const messageBox = document.getElementById('message-box');
        
        let keys = {};
        let gameLoopId;
        let score = 0;
        let isGameOver = true;
        let whaleHit = false; 
        let flareSpeed = 4;
        const VIEWPORT_MARGIN = 200; 
        
        // --- World and Wave Constants ---
        const surfaceWorldY = -150; 
        const waveAmplitude = 18; 
        const waveLength = 80;
        let waveOffset = 0; 
        const DODGE_DEPTH = 600; 
        
        // --- WORLD BOUNDARIES ---
        const WORLD_WIDTH = 3000; 
        const WORLD_DEPTH = 1500; 
        const WORLD_LEFT = -WORLD_WIDTH / 2;
        const WORLD_RIGHT = WORLD_WIDTH / 2;
        const WORLD_BOTTOM = surfaceWorldY + WORLD_DEPTH;

        // Utility function to safely get CSS variables in JavaScript
        const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

        // Whale object now tracks its absolute world position
        const whale = {
            worldX: 0,
            worldY: 0,
            radius: 25, 
            moveStep: 8,
            screenX: 0, 
            screenY: 0, 
            
            // Collision box offsets based on the drawn shape
            COLLISION_OFFSET_LEFT: -114, 
            COLLISION_OFFSET_RIGHT: 31,

            draw: function() {
                const whaleColor = whaleHit ? getCssVar('--ui-accent') : getCssVar('--whale-color'); 
                const whaleColorDark = getCssVar('--whale-color-dark');
                const centerX = this.screenX;
                const centerY = this.screenY + Math.sin(frameCount * 0.05) * 2; // Subtle vertical bobbing
                
                // Whale dimensions
                const bodyWidth = this.radius * 2.5;
                const bodyHeight = this.radius; 
                const noseX = centerX + bodyWidth / 2;
                const tailX = centerX - bodyWidth * 1.5;

                // --- 0. Define main body path for reuse ---
                const drawWhaleBodyPath = () => {
                    ctx.beginPath();
                    ctx.moveTo(noseX, centerY);
                    ctx.bezierCurveTo(
                        centerX + bodyWidth * 0.4, centerY - bodyHeight * 1.2, 
                        centerX - bodyWidth * 0.9, centerY - bodyHeight * 0.8, 
                        tailX, centerY 
                    );
                    ctx.bezierCurveTo(
                        centerX - bodyWidth * 0.9, centerY + bodyHeight * 0.8, 
                        centerX + bodyWidth * 0.4, centerY + bodyHeight * 1.2, 
                        noseX, centerY 
                    );
                    ctx.closePath();
                };

                // --- 1. Main Body (Gradient) ---
                drawWhaleBodyPath();
                const gradient = ctx.createLinearGradient(centerX - bodyWidth, centerY - bodyHeight, centerX + bodyWidth, centerY + bodyHeight);
                gradient.addColorStop(0, whaleColorDark);
                gradient.addColorStop(0.5, whaleColor);
                gradient.addColorStop(1, whaleColorDark);
                ctx.fillStyle = gradient;
                ctx.fill();

                // --- 2. Outline (subtle) ---
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; // Very faint dark outline
                ctx.lineWidth = 2;
                drawWhaleBodyPath();
                ctx.stroke();

                // --- 3. Shading and Highlight ---
                
                // Specular Highlight (dynamic, subtle)
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(frameCount * 0.08) * 0.05})`; // Pulsating highlight
                ctx.beginPath();
                ctx.ellipse(centerX + bodyWidth * 0.2, centerY - bodyHeight * 0.6, bodyWidth * 0.3, bodyHeight * 0.1, -Math.PI / 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';


                // --- 4. Tail Fin ---
                ctx.fillStyle = whaleColorDark;
                ctx.beginPath();
                ctx.moveTo(tailX, centerY);
                const flicker = Math.sin(frameCount * 0.3) * 5; 
                ctx.lineTo(tailX - 25, centerY - 18 + flicker); // Wider tail
                ctx.lineTo(tailX - 25, centerY + 18 - flicker); // Wider tail
                ctx.closePath();
                ctx.fill();

                // --- 5. Dorsal Fin ---
                ctx.fillStyle = whaleColorDark;
                ctx.beginPath();
                ctx.moveTo(centerX - bodyWidth * 0.4, centerY - bodyHeight * 0.8);
                ctx.quadraticCurveTo(
                    centerX - bodyWidth * 0.3, centerY - bodyHeight * 1.2,
                    centerX - bodyWidth * 0.2, centerY - bodyHeight * 0.8
                );
                ctx.closePath();
                ctx.fill();

                // --- 6. Pectoral Fin (one visible side) ---
                ctx.fillStyle = whaleColorDark;
                ctx.beginPath();
                ctx.ellipse(centerX - bodyWidth * 0.1, centerY + bodyHeight * 0.6, bodyWidth * 0.3, bodyHeight * 0.2, Math.PI / 6, 0, Math.PI * 2);
                ctx.fill();


                // --- 7. Detailed Eye ---
                const eyeX = centerX + bodyWidth * 0.3;
                const eyeY = centerY - bodyHeight * 0.4;

                // White sclera
                ctx.fillStyle = getCssVar('--text-light');
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
                ctx.fill();

                // Dark pupil
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(eyeX + 1, eyeY, 3, 0, Math.PI * 2); // Slight offset for realism
                ctx.fill();

                // Small white highlight on pupil
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(eyeX + 2, eyeY - 2, 1.5, 0, Math.PI * 2);
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
                const boundRadius = this.radius * 1.5; 
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
            
            for(let i = 0; i < 300; i++) { 
                bubbles.push({
                    worldX: WORLD_LEFT + Math.random() * bubbleAreaWidth, 
                    worldY: surfaceWorldY + Math.random() * bubbleAreaHeight, 
                    radius: Math.random() * 4 + 1, 
                    opacity: Math.random() * 0.3 + 0.05, 
                    speedY: Math.random() * 0.5 + 0.1, 
                    life: Math.random() * 100 
                });
            }
        }
        
        function drawBubbles() {
            const viewportWorldX = whale.worldX - whale.screenX;
            const viewportWorldY = whale.worldY - whale.screenY;

            bubbles.forEach(b => {
                b.worldY -= b.speedY * 0.1; 

                if (b.worldY < surfaceWorldY) {
                    b.worldY = WORLD_BOTTOM;
                }

                const screenX = b.worldX - viewportWorldX;
                const screenY = b.worldY - viewportWorldY;

                if (screenX > -b.radius && screenX < canvas.width + b.radius &&
                    screenY > -b.radius && screenY < canvas.height + b.radius) {
                    
                    const shimmer = Math.sin(b.life + frameCount * 0.03) * 0.1;
                    ctx.fillStyle = `rgba(241, 250, 238, ${b.opacity + shimmer})`;
                    
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, b.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
        
        function drawCaustics() {
            const viewportWorldX = whale.worldX - whale.screenX;
            const viewportWorldY = whale.worldY - whale.screenY;
            const waveScreenY = surfaceWorldY - viewportWorldY;

            if (waveScreenY > canvas.height + 50) return; 

            const depthLimit = Math.min(canvas.height, waveScreenY + 500);

            for (let i = 0; i < 6; i++) { 
                ctx.beginPath();
                const startX = (i * 150 + frameCount * 2.5) % (canvas.width * 3) - canvas.width * 1.5; 

                for (let x = 0; x < canvas.width; x += 15) {
                    const noise = Math.sin((x * 0.03) + frameCount * 0.005) * 50; 
                    const y1 = waveScreenY + x * 0.3 + noise; 

                    if (x === 0) {
                        ctx.moveTo(startX + x, y1);
                    } else {
                        ctx.lineTo(startX + x, y1);
                    }
                }
                
                ctx.lineTo(canvas.width + startX, depthLimit);
                ctx.lineTo(startX, depthLimit);
                ctx.closePath();

                const gradient = ctx.createLinearGradient(0, waveScreenY, 0, depthLimit);
                gradient.addColorStop(0, getCssVar('--caustics-light'));
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }

        function drawSeaBackground() {
            const viewportWorldY = whale.worldY - whale.screenY;
            const waveScreenY = surfaceWorldY - viewportWorldY;
            
            const darkBlue = getCssVar('--sea-blue-dark');
            const midBlue = getCssVar('--sea-blue-mid');

            // Draw the absolute bottom layer (Darkest Sea)
            ctx.fillStyle = darkBlue;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the Sea Gradient (Mid-Blue fading to Dark-Blue)
            const gradient = ctx.createLinearGradient(0, waveScreenY, 0, canvas.height);
            gradient.addColorStop(0, midBlue); 
            gradient.addColorStop(1, darkBlue); 
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, Math.max(0, waveScreenY), canvas.width, canvas.height - Math.max(0, waveScreenY));

            drawCaustics();
        }

        function drawDepthHaze() {
            const maxDepth = WORLD_BOTTOM - surfaceWorldY;
            const currentDepth = whale.worldY - surfaceWorldY;
            const depthRatio = Math.min(1, currentDepth / maxDepth);
            
            const hazeOpacity = depthRatio * 0.4; 
            
            if (hazeOpacity > 0.01) {
                ctx.fillStyle = `rgba(0, 0, 0, ${hazeOpacity})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        function drawSky() {
            const viewportWorldY = whale.worldY - whale.screenY;
            const waveScreenY = surfaceWorldY - viewportWorldY;

            if (waveScreenY > 0) {
                ctx.fillStyle = getCssVar('--sky-blue');
                ctx.fillRect(0, 0, canvas.width, waveScreenY);
                ctx.strokeStyle = '#6d9aa3'; 
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, waveScreenY);
                ctx.lineTo(canvas.width, waveScreenY);
                ctx.stroke();
            }
        }
        
        function drawSeabed() {
            const viewportWorldX = whale.worldX - whale.screenX;
            const viewportWorldY = whale.worldY - whale.screenY;
            const seabedScreenY = WORLD_BOTTOM - viewportWorldY;

            if (seabedScreenY < canvas.height) {
                // 1. Draw solid ground
                ctx.fillStyle = getCssVar('--seabed-color'); 
                ctx.fillRect(0, seabedScreenY, canvas.width, canvas.height - seabedScreenY);

                // 2. Draw simple coral/rock structures
                ctx.fillStyle = '#4e3a47'; 
                const structures = [
                    { x: -500, w: 100, h: 40 }, { x: 100, w: 70, h: 30 }, 
                    { x: 700, w: 150, h: 60 }, { x: -100, w: 50, h: 20 },
                    { x: -1200, w: 200, h: 80 }
                ];

                structures.forEach(s => {
                    const screenX = s.x - viewportWorldX;
                    const screenY = seabedScreenY;
                    
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY);
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
                const y = waveScreenY + waveAmplitude * Math.sin((worldX + waveOffset * waveLength) / waveLength) + 
                          5 * Math.sin(worldX / 30); 
                ctx.lineTo(x, y);
            }

            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            ctx.beginPath();
            ctx.moveTo(0, waveScreenY);
            for (let x = 0; x <= canvas.width; x += 10) {
                const worldX = viewportWorldX + x;
                const y = waveScreenY + waveAmplitude * Math.sin((worldX + waveOffset * waveLength) / waveLength) + 
                          5 * Math.sin(worldX / 30); 
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }


        let flares = [];
        const flareWidth = 25; 
        const flareHeight = 60;
        let frameCount = 0;
        let flareInterval = 20; 
        const TRAIL_MAX_AGE = 40; 
        const SPARK_MAX_AGE = 15; 

        function createFlare() {
            const worldX = WORLD_LEFT + flareWidth + Math.random() * (WORLD_RIGHT - WORLD_LEFT - 2 * flareWidth);
            const worldY = surfaceWorldY - 500; 

            flares.push({
                worldX: worldX,
                worldY: worldY, 
                width: flareWidth,
                height: flareHeight,
                scored: false,
                trail: [],
                sparks: [] 
            });
        }

        function drawFlareTrail(f) {
            f.trail.forEach(p => {
                const opacity = 1 - (p.age / TRAIL_MAX_AGE);
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.4})`; 
                ctx.beginPath();
                ctx.arc(p.screenX, p.screenY, p.radius * opacity, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        function drawFlareSparks(f) {
            ctx.globalCompositeOperation = 'lighter'; 
            f.sparks.forEach(s => {
                const opacity = 1 - (s.age / SPARK_MAX_AGE);
                ctx.fillStyle = `rgba(255, 120, 0, ${opacity})`; 
                ctx.beginPath();
                ctx.arc(s.screenX, s.screenY, s.radius * opacity, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalCompositeOperation = 'source-over'; 
        }

        function drawFlares() {
            const viewportWorldX = whale.worldX - whale.screenX;
            const viewportWorldY = whale.worldY - whale.screenY;

            flares.forEach(f => {
                const screenX = f.worldX - viewportWorldX;
                const screenY = f.worldY - viewportWorldY;

                f.trail.forEach(p => { p.screenX = p.worldX - viewportWorldX; p.screenY = p.worldY - viewportWorldY; });
                f.sparks.forEach(s => { s.screenX = s.worldX - viewportWorldX; s.screenY = s.worldY - viewportWorldY; });
                
                drawFlareTrail(f); 
                drawFlareSparks(f); 

                ctx.globalAlpha = 1.0;
                ctx.fillStyle = 'rgba(100, 30, 0, 0.8)'; 
                ctx.beginPath();
                ctx.moveTo(screenX + f.width / 2, screenY);
                ctx.lineTo(screenX + f.width * 0.8, screenY + f.height);
                ctx.lineTo(screenX + f.width * 0.2, screenY + f.height);
                ctx.closePath();
                ctx.fill();

                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 100, 0, 0.5)`; 
                ctx.beginPath();
                ctx.arc(screenX + f.width / 2, screenY + f.height * 0.5, f.width * 0.4, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalCompositeOperation = 'source-over'; 
            });
        }

        function updateFlares() {
            flareSpeed = 4 + Math.floor(score / 10) * 0.5; 

            for (let i = flares.length - 1; i >= 0; i--) {
                let f = flares[i];
                
                f.worldY += flareSpeed;

                if (frameCount % 2 === 0) { 
                    f.trail.push({
                        worldX: f.worldX + f.width / 2 + (Math.random() - 0.5) * 8, 
                        worldY: f.worldY + f.height,
                        radius: Math.random() * 4 + 1.5,
                        age: 0
                    });
                }
                for (let j = f.trail.length - 1; j >= 0; j--) {
                    f.trail[j].age++;
                    f.trail[j].worldY -= 1.0; 
                    if (f.trail[j].age > TRAIL_MAX_AGE) {
                        f.trail.splice(j, 1);
                    }
                }
                
                if (frameCount % 1 === 0) { 
                    f.sparks.push({
                        worldX: f.worldX + f.width / 2 + (Math.random() - 0.5) * f.width,
                        worldY: f.worldY + f.height * 0.3 + (Math.random() - 0.5) * f.height * 0.6,
                        radius: Math.random() * 2 + 1,
                        age: 0,
                        speedX: (Math.random() - 0.5) * 1.5, 
                        speedY: (Math.random() - 1) * 2 
                    });
                }
                for (let j = f.sparks.length - 1; j >= 0; j--) {
                    f.sparks[j].age++;
                    f.sparks[j].worldX += f.sparks[j].speedX;
                    f.sparks[j].worldY += f.sparks[j].speedY;
                    if (f.sparks[j].age > SPARK_MAX_AGE) {
                        f.sparks.splice(j, 1);
                    }
                }


                const whaleHitAreaTop = whale.screenY - whale.radius;
                const whaleHitAreaBottom = whale.screenY + whale.radius;
                const viewportWorldX = whale.worldX - whale.screenX;
                
                const screenX = f.worldX - viewportWorldX;
                const screenY = f.worldY - (whale.worldY - whale.screenY); 

                if (screenY + f.height > whaleHitAreaTop && screenY < whaleHitAreaBottom) {
                    
                    const whaleLeft = whale.screenX + whale.COLLISION_OFFSET_LEFT;
                    const whaleRight = whale.screenX + whale.COLLISION_OFFSET_RIGHT;

                    if (screenX < whaleRight && screenX + f.width > whaleLeft) {
                        handleCollision(); 
                        return; 
                    }
                }

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


        function gameLoop() {
            if (isGameOver && !whaleHit) { 
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height); 

            drawSky();             
            drawSeaBackground();   
            
            if (!isGameOver) { 
                whale.update();
                updateFlares();
            }
            
            drawBubbles();          
            drawSeabed();           
            drawWaves();            
            drawFlares();
            whale.draw(); 
            
            drawDepthHaze();

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

                const restartBtn = document.getElementById('restart-button-modal');
                if(restartBtn) restartBtn.removeEventListener('click', startGame);

                messageBox.innerHTML = `
                    <h2>Whale Struck!</h2>
                    <p>A burning flare hit the poor whale. Game Over!</p>
                    <div id="final-score">Score: ${score}</div>
                    <button id="restart-button-modal">Start New Dive</button>
                `;
                document.getElementById('restart-button-modal').addEventListener('click', startGame);
                messageBox.classList.add('visible');
                whaleHit = false; 
            }, 250); 
        }

        document.addEventListener('keydown', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
                keys[e.code] = true;
                e.preventDefault(); 
            }
            if (isGameOver && (e.code === 'Space' || e.code === 'Enter') && messageBox.classList.contains('visible')) {
                const startButton = document.getElementById('start-button') || document.getElementById('restart-button-modal');
                if (startButton) startButton.click();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
                keys[e.code] = false;
            }
        });

        const handleStartClick = () => { if (isGameOver) startGame(); };
        canvas.addEventListener('click', handleStartClick);
        canvas.addEventListener('touchstart', (e) => { 
            if (isGameOver) handleStartClick(); 
            e.preventDefault(); 
        });

        window.onload = function() {
            resizeCanvas(); 
            messageBox.innerHTML = `
                <h2>Whale Defender: Deep Dive</h2>
                <p>Protect the whale from the burning flares dropped from the surface!</p>
                <p style="margin-top: 15px;">**Controls:** Use the **Arrow Keys** or **W/A/S/D** to move.</p>
                <p style="margin-top: 5px; color: ${getCssVar('--flare-orange')}">Current Danger: Avoid the light and dive deep!</p>
                <button id="start-button">Start Dive</button>
            `;
            const startButton = document.getElementById('start-button');
            startButton.addEventListener('click', startGame);
            messageBox.classList.add('visible');
            generateBubbles();
            whale.draw(); 
        }