
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, GameEntity, EntityType, BlockType, Player, HighScoreData, Particle, Block, Enemy, Boss } from './types';
import { 
  GAME_SPEED_INITIAL, 
  GAME_SPEED_MAX,
  SPEED_SCALE_PER_POINT,
  PLAYER_LATERAL_SPEED, 
  SPAWN_RATE_INITIAL, 
  SPAWN_RATE_MIN,
  SPAWN_Z,
  PLAYER_Z,
  ROAD_WIDTH,
  BLOCK_SIZE,
  PLAYER_SIZE,
  COLORS, 
  STORAGE_KEY,
  FOV,
  CAMERA_HEIGHT,
  CAMERA_DIST,
  HORIZON_Y,
  LEVEL_DISTANCE_BASE,
  LEVEL_DISTANCE_SCALING,
  BOSS_BASE_HEALTH,
  BOSS_HP_SCALING
} from './constants';
import { audio } from './audio';
import { Trophy, Play, RotateCcw, Skull, Crown, Zap } from 'lucide-react';

const App: React.FC = () => {
  // -- React State --
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScoreData, setHighScoreData] = useState<HighScoreData>({ score: 0, name: 'None', maxLevel: 1 });
  const [newHighScore, setNewHighScore] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [distanceTraveled, setDistanceTraveled] = useState(0);

  // -- Refs --
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(GameState.START);
  
  // Game Logic Refs
  const playerRef = useRef<Player>({ 
    x: 0, 
    y: 0, 
    z: PLAYER_Z,
    width: PLAYER_SIZE, 
    height: PLAYER_SIZE * 2, 
    speed: PLAYER_LATERAL_SPEED,
    lean: 0
  });
  
  const entitiesRef = useRef<GameEntity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const gameSpeedRef = useRef(GAME_SPEED_INITIAL);
  const lastSpawnTimeRef = useRef(0);
  const distanceRef = useRef(0);
  const nextBossDistanceRef = useRef(LEVEL_DISTANCE_BASE);
  const shakeIntensityRef = useRef(0);
  
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchDirection = useRef<number>(0);

  // -- Initialization --
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHighScoreData(JSON.parse(saved));
      } catch (e) { console.error(e); }
    }

    audio.init();

    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef.current!);
      audio.stopMusic();
    };
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // -- 3D Projection --
  const project3D = (x: number, y: number, z: number, canvasWidth: number, canvasHeight: number) => {
    // Screen shake
    const shakeX = (Math.random() - 0.5) * shakeIntensityRef.current;
    const shakeY = (Math.random() - 0.5) * shakeIntensityRef.current;

    const cameraZ = z + CAMERA_DIST;
    const scale = FOV / (cameraZ > 0 ? cameraZ : 0.001);
    
    const screenX = (x * scale) + (canvasWidth / 2) + shakeX;
    const horizonPixelY = canvasHeight * HORIZON_Y;
    const screenY = horizonPixelY - ((y - CAMERA_HEIGHT) * scale) + shakeY;

    return { x: screenX, y: screenY, scale };
  };

  // -- Game Helper Functions --

  const spawnEntity = () => {
    if (gameStateRef.current === GameState.BOSS_FIGHT || gameStateRef.current === GameState.LEVEL_TRANSITION) return;

    const laneCount = 5;
    const laneWidth = ROAD_WIDTH / laneCount;
    const laneIndex = Math.floor(Math.random() * laneCount) - 2;
    const x = laneIndex * laneWidth;
    
    const rand = Math.random();
    let entity: GameEntity;

    // Difficulty scaling: More enemies/bad blocks at higher levels
    const badChance = 0.3 + (levelRef.current * 0.05);

    if (rand < Math.min(0.6, badChance)) { 
        // Enemy or Bad Block
        if (Math.random() < 0.5) {
             const power = Math.floor(Math.random() * 20) + 5 + Math.floor(scoreRef.current * 0.1) + (levelRef.current * 5);
             entity = {
                 id: Date.now() + Math.random(),
                 type: EntityType.ENEMY,
                 x, y: 0, z: SPAWN_Z,
                 width: BLOCK_SIZE, height: BLOCK_SIZE,
                 color: COLORS.ENEMY,
                 power
             } as Enemy;
        } else {
             // Negative Block
             let blockType: BlockType;
             let value = 0;
             let text = '';
             let color = '';
             
             if (Math.random() < 0.1) {
                blockType = BlockType.DEATH;
                text = "☠";
                value = 0;
                color = COLORS[BlockType.DEATH];
             } else {
                if (Math.random() < 0.7) {
                    value = Math.floor(Math.random() * 25) + 5;
                    blockType = BlockType.SUB;
                    text = `-${value}`;
                    color = COLORS[BlockType.SUB];
                } else {
                    value = 2;
                    blockType = BlockType.DIV;
                    text = `÷${value}`;
                    color = COLORS[BlockType.DIV];
                }
             }
             entity = {
                id: Date.now() + Math.random(),
                type: EntityType.BLOCK,
                x, y: 0, z: SPAWN_Z,
                width: BLOCK_SIZE, height: BLOCK_SIZE,
                blockType, text, color, value, textColor: '#fff'
             } as Block;
        }
    } else {
        // Positive Block
        let blockType: BlockType;
        let value = 0;
        let text = "";
        let color = "";
        
        if (Math.random() < 0.2) { 
            value = Math.random() < 0.7 ? 2 : 3;
            blockType = BlockType.MULT; 
            text = `x${value}`; 
            color = COLORS[BlockType.MULT]; 
        } else { 
            value = Math.floor(Math.random() * 45) + 5;
            blockType = BlockType.ADD; 
            text = `+${value}`; 
            color = COLORS[BlockType.ADD]; 
        }
        
        entity = {
            id: Date.now() + Math.random(),
            type: EntityType.BLOCK,
            x, y: 0, z: SPAWN_Z,
            width: BLOCK_SIZE, height: BLOCK_SIZE,
            blockType, text, color, value,
            textColor: '#fff'
        } as Block;
    }

    entitiesRef.current.push(entity);
  };

  const spawnBoss = () => {
     setGameState(GameState.BOSS_FIGHT);
     gameStateRef.current = GameState.BOSS_FIGHT;
     
     // Calculate Boss HP based on Level
     const hp = Math.floor(BOSS_BASE_HEALTH * Math.pow(BOSS_HP_SCALING, levelRef.current - 1));

     const boss: Boss = {
         id: Date.now(),
         type: EntityType.BOSS,
         x: 0, y: 0, z: SPAWN_Z,
         width: ROAD_WIDTH * 1.5, // Boss spans WIDER than full width to be unavoidable
         height: BLOCK_SIZE * 3.5,
         color: COLORS.BOSS,
         maxHealth: hp,
         currentHealth: hp,
         level: levelRef.current
     };
     entitiesRef.current.push(boss);
  };

  const handleLevelUp = () => {
      // Logic for beating the boss
      setGameState(GameState.LEVEL_TRANSITION);
      gameStateRef.current = GameState.LEVEL_TRANSITION;
      
      levelRef.current += 1;
      setLevel(levelRef.current);
      
      // Bonus score for kill
      scoreRef.current += 100 * (levelRef.current - 1);
      setScore(scoreRef.current);
      
      audio.playWin();
      
      // Calculate next boss distance
      const nextDist = LEVEL_DISTANCE_BASE * Math.pow(LEVEL_DISTANCE_SCALING, levelRef.current - 1);
      nextBossDistanceRef.current = distanceRef.current + nextDist;

      // Resume after short delay
      setTimeout(() => {
          setGameState(GameState.PLAYING);
          gameStateRef.current = GameState.PLAYING;
          // Heal player a bit?
      }, 2000);
  };

  const createParticles = (x: number, y: number, color: string, count = 8, scale = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 200 + 50) * scale;
      particlesRef.current.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        color,
        size: (Math.random() * 5 + 2) * scale
      });
    }
  };

  const updateParticles = (dt: number) => {
    particlesRef.current.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vy += 300 * dt; // Gravity
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const endGame = (victory = false) => {
    setGameState(victory ? GameState.VICTORY : GameState.GAME_OVER);
    gameStateRef.current = victory ? GameState.VICTORY : GameState.GAME_OVER;
    
    audio.stopMusic();
    if (victory) audio.playWin();
    else audio.playGameOver();
    
    if (scoreRef.current > highScoreData.score) {
      setNewHighScore(true);
    }
  };

  const resetGame = () => {
    scoreRef.current = 20; 
    setScore(20);
    levelRef.current = 1;
    setLevel(1);
    
    gameSpeedRef.current = GAME_SPEED_INITIAL;
    entitiesRef.current = [];
    particlesRef.current = [];
    distanceRef.current = 0;
    nextBossDistanceRef.current = LEVEL_DISTANCE_BASE;
    setDistanceTraveled(0);
    setNewHighScore(false);
    
    setGameState(GameState.PLAYING);
    gameStateRef.current = GameState.PLAYING;
    
    lastTimeRef.current = performance.now();
    lastSpawnTimeRef.current = performance.now();
    playerRef.current.x = 0;

    audio.startMusic();
    window.focus();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  };

  // -- Main Game Loop --
  const gameLoop = (time: number) => {
    const currentGameState = gameStateRef.current;
    
    const canvas = canvasRef.current;
    if (!canvas) {
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;

    // Decay screenshake
    if (shakeIntensityRef.current > 0) {
        shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - dt * 30);
    }

    // -- Update Logic --
    if (currentGameState === GameState.PLAYING || currentGameState === GameState.BOSS_FIGHT || currentGameState === GameState.LEVEL_TRANSITION) {
        
        // Input Handling
        let moveDir = 0;
        if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) moveDir = -1;
        if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) moveDir = 1;
        if (touchDirection.current !== 0) moveDir = touchDirection.current;

        // Player Move
        // Keep lateral speed constant to fix high-speed controllability issues
        playerRef.current.speed = PLAYER_LATERAL_SPEED; 
        
        playerRef.current.x += moveDir * playerRef.current.speed * dt;
        
        // Player Lean (Visual)
        const targetLean = moveDir * 25; // Max 25 degree lean
        playerRef.current.lean += (targetLean - playerRef.current.lean) * 10 * dt; // Smooth interpolation

        const xLimit = (ROAD_WIDTH / 2) - (playerRef.current.width / 4); 
        if (playerRef.current.x < -xLimit) playerRef.current.x = -xLimit;
        if (playerRef.current.x > xLimit) playerRef.current.x = xLimit;

        // Move World
        const speed = gameSpeedRef.current;
        if (currentGameState !== GameState.LEVEL_TRANSITION) {
            distanceRef.current += speed * dt;
        }
        setDistanceTraveled(Math.floor(distanceRef.current / 100));

        // Spawn Boss Check
        if (currentGameState === GameState.PLAYING && distanceRef.current > nextBossDistanceRef.current) {
            spawnBoss();
        }

        // Spawn Entities (Paused during transition)
        const currentSpawnDelay = Math.max(SPAWN_RATE_MIN, SPAWN_RATE_INITIAL - (scoreRef.current * 1.5) - (levelRef.current * 50));
        if (currentGameState !== GameState.LEVEL_TRANSITION && time - lastSpawnTimeRef.current > currentSpawnDelay) {
            spawnEntity();
            lastSpawnTimeRef.current = time;
        }

        // Update Entities
        for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
            const ent = entitiesRef.current[i];
            
            ent.z -= speed * dt;

            // Collision
            // Increased depth to 150 to catch collisions even at high speeds (prevent skipping)
            const zCollisionDepth = 150; 
            
            if (ent.z < zCollisionDepth && ent.z > -zCollisionDepth) {
                const pHalfW = playerRef.current.width / 2;
                const eHalfW = ent.width / 2;
                
                const isBoss = ent.type === EntityType.BOSS;
                // If boss, ignore X check (unavoidable). Otherwise check overlap.
                const xCollision = isBoss || Math.abs(ent.x - playerRef.current.x) < (pHalfW + eHalfW * 0.8);

                if (xCollision) {
                    
                    const pProj = project3D(playerRef.current.x, playerRef.current.y, playerRef.current.z, canvas.width, canvas.height);
                    
                    if (ent.type === EntityType.BLOCK) {
                        const block = ent as Block;
                        createParticles(pProj.x, pProj.y, ent.color, 15);
                        switch (block.blockType) {
                            case BlockType.ADD: scoreRef.current += block.value; audio.playCollect(); break;
                            case BlockType.MULT: scoreRef.current *= block.value; audio.playCollect(); break;
                            case BlockType.SUB: scoreRef.current -= block.value; audio.playNegative(); shakeIntensityRef.current = 5; break;
                            case BlockType.DIV: scoreRef.current = Math.floor(scoreRef.current / block.value); audio.playNegative(); shakeIntensityRef.current = 5; break;
                            case BlockType.DEATH: scoreRef.current = -1; audio.playDeath(); shakeIntensityRef.current = 20; break;
                        }
                    } else if (ent.type === EntityType.ENEMY) {
                        const enemy = ent as Enemy;
                        scoreRef.current -= enemy.power;
                        audio.playCrash();
                        createParticles(pProj.x, pProj.y, ent.color, 20);
                        shakeIntensityRef.current = 10;
                    } else if (ent.type === EntityType.BOSS) {
                         const boss = ent as Boss;
                         // BATTLE CALCULATION
                         const damage = boss.currentHealth;
                         
                         scoreRef.current -= damage;
                         
                         shakeIntensityRef.current = 30;
                         createParticles(pProj.x, pProj.y, COLORS.BOSS, 50, 2);
                         
                         if (scoreRef.current > 0) {
                             handleLevelUp(); // Survived
                         } else {
                             audio.playDeath();
                             endGame(false);
                         }
                    }

                    // Remove entity
                    entitiesRef.current.splice(i, 1);
                    setScore(Math.floor(scoreRef.current));

                    if (scoreRef.current < 0) {
                        endGame(false);
                    }
                    continue;
                }
            }

            if (ent.z < -200) {
                entitiesRef.current.splice(i, 1);
            }
        }

        updateParticles(dt);
        
        // Speed Scaling
        if (currentGameState === GameState.PLAYING) {
             const targetSpeed = GAME_SPEED_INITIAL + (scoreRef.current * SPEED_SCALE_PER_POINT) + ((levelRef.current - 1) * 100);
             gameSpeedRef.current = Math.min(GAME_SPEED_MAX, targetSpeed);
        }
    }

    // -- Rendering --
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Sky & Ground (Color shifts with Level)
    const levelColors = [
        { skyT: '#0f172a', skyB: '#1e293b', ground: '#020617' }, // Lvl 1: Blue/Dark
        { skyT: '#2a0a0f', skyB: '#450a0a', ground: '#1a0505' }, // Lvl 2: Red
        { skyT: '#172554', skyB: '#1e3a8a', ground: '#020617' }, // Lvl 3: Deep Blue
        { skyT: '#022c22', skyB: '#064e3b', ground: '#020617' }, // Lvl 4: Green
        { skyT: '#2e1065', skyB: '#581c87', ground: '#020617' }, // Lvl 5: Purple
    ];
    const theme = levelColors[(levelRef.current - 1) % levelColors.length];

    const horizonPixelY = canvas.height * HORIZON_Y;
    const gradient = ctx.createLinearGradient(0, 0, 0, horizonPixelY);
    gradient.addColorStop(0, theme.skyT); 
    gradient.addColorStop(1, theme.skyB); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, horizonPixelY);

    ctx.fillStyle = theme.ground; 
    ctx.fillRect(0, horizonPixelY, canvas.width, canvas.height - horizonPixelY);

    // 2. Road
    ctx.save();
    const pFarL = project3D(-ROAD_WIDTH/2, 0, 2500, canvas.width, canvas.height);
    const pFarR = project3D(ROAD_WIDTH/2, 0, 2500, canvas.width, canvas.height);
    const pNearL = project3D(-ROAD_WIDTH/2, 0, -100, canvas.width, canvas.height);
    const pNearR = project3D(ROAD_WIDTH/2, 0, -100, canvas.width, canvas.height);

    ctx.fillStyle = COLORS.ROAD_MAIN;
    ctx.beginPath();
    ctx.moveTo(pFarL.x, pFarL.y);
    ctx.lineTo(pFarR.x, pFarR.y);
    ctx.lineTo(pNearR.x, pNearR.y);
    ctx.lineTo(pNearL.x, pNearL.y);
    ctx.fill();

    // Grid Lines
    ctx.strokeStyle = COLORS.ROAD_STRIPE;
    ctx.lineWidth = 1;
    const gridSpacing = 300;
    const gridOffset = (distanceRef.current) % gridSpacing;
    for (let z = 3000; z > 0; z -= gridSpacing) {
        const drawZ = z - gridOffset;
        if (drawZ <= 0) continue;
        const pL = project3D(-ROAD_WIDTH/2, 0, drawZ, canvas.width, canvas.height);
        const pR = project3D(ROAD_WIDTH/2, 0, drawZ, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(pR.x, pR.y);
        ctx.stroke();
    }
    
    // Lanes
    ctx.lineWidth = 2;
    const laneWidth = ROAD_WIDTH / 5;
    for (let i = -2; i <= 2; i++) {
        const lx = i * laneWidth;
        const pf = project3D(lx, 0, 3000, canvas.width, canvas.height);
        const pn = project3D(lx, 0, -100, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(pf.x, pf.y);
        ctx.lineTo(pn.x, pn.y);
        ctx.stroke();
    }
    ctx.restore();

    // 3. Entities
    const renderList = [...entitiesRef.current];
    renderList.sort((a, b) => b.z - a.z);

    renderList.forEach(ent => {
        const proj = project3D(ent.x, ent.y, ent.z, canvas.width, canvas.height);
        const w = ent.width * proj.scale;
        const h = ent.height * proj.scale;
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(proj.x, proj.y, w/1.5, w/4, 0, 0, Math.PI*2);
        ctx.fill();

        if (ent.type === EntityType.BLOCK) {
            const r = 5 * proj.scale;
            ctx.fillStyle = ent.color;
            ctx.beginPath();
            ctx.roundRect(proj.x - w/2, proj.y - h, w, h, r);
            ctx.fill();
            // Block Shine
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(proj.x - w/2, proj.y - h, w, h*0.3);

            const block = ent as Block;
            ctx.fillStyle = block.textColor;
            ctx.font = `bold ${28 * proj.scale}px 'Roboto'`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(block.text, proj.x, proj.y - h/2);
        } 
        else if (ent.type === EntityType.ENEMY) {
            // Spiked Mine
            ctx.fillStyle = ent.color;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y - h/2, w/2, 0, Math.PI * 2);
            ctx.fill();
            // Spikes
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 3 * proj.scale;
            for(let i=0; i<8; i++) {
                const ang = (Math.PI*2/8)*i + (time * 2);
                const sx = proj.x + Math.cos(ang) * w/1.4;
                const sy = (proj.y - h/2) + Math.sin(ang) * h/1.4;
                ctx.beginPath();
                ctx.moveTo(proj.x, proj.y-h/2);
                ctx.lineTo(sx, sy);
                ctx.stroke();
            }
            const enemy = ent as Enemy;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${24 * proj.scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(enemy.power.toString(), proj.x, proj.y - h * 1.1);
        }
        else if (ent.type === EntityType.BOSS) {
            // Big Boss Block
            const boss = ent as Boss;
            ctx.fillStyle = ent.color;
            ctx.fillRect(proj.x - w/2, proj.y - h, w, h);
            
            // Health Bar
            const barW = w * 0.8; // Smaller bar relative to huge boss
            const barH = 10 * proj.scale;
            ctx.fillStyle = '#000';
            ctx.fillRect(proj.x - barW/2, proj.y - h - barH*2, barW, barH);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(proj.x - barW/2, proj.y - h - barH*2, barW * (boss.currentHealth / boss.maxHealth), barH);

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${40 * proj.scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(boss.currentHealth.toString(), proj.x, proj.y - h/2);
            ctx.font = `bold ${20 * proj.scale}px sans-serif`;
            ctx.fillText(`BOSS LVL ${boss.level}`, proj.x, proj.y - h - 25 * proj.scale);
        }
    });

    // 4. Draw Character (Cyber Knight)
    drawCyberCharacter(ctx, canvas, distanceRef.current, playerRef.current.lean);

    // 5. Particles
    drawParticles(ctx);

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const drawCyberCharacter = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, distance: number, lean: number) => {
    const { x, y, z, width, height } = playerRef.current;
    const proj = project3D(x, y, z, canvas.width, canvas.height);
    const s = proj.scale;
    const px = proj.x;
    const py = proj.y;
    
    // Character Params based on Score (Evolution)
    let primaryColor = '#94a3b8'; // Base Grey
    let secondaryColor = '#3b82f6'; // Base Blue
    let hasArmor = false;
    let hasWings = false;

    if (scoreRef.current >= 100) { // Mk.2
        primaryColor = '#b91c1c'; // Red
        secondaryColor = '#1e293b'; // Dark
        hasArmor = true;
    }
    if (scoreRef.current >= 300) { // Mk.3
        primaryColor = '#f59e0b'; // Gold
        secondaryColor = '#000000'; // Black
        hasWings = true;
    }

    const leanRad = (lean * Math.PI) / 180;
    
    // Animation cycle
    const stride = distance / 30; 
    const lLegZ = Math.sin(stride);
    const rLegZ = Math.sin(stride + Math.PI);
    
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(leanRad * 0.5); // Tilt body
    ctx.scale(s, s);

    // -- SHADOW --
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.6, width * 0.2, 0, 0, Math.PI*2);
    ctx.fill();

    // Helper: Draw rounded limb
    const drawLimb = (lx: number, ly: number, lw: number, lh: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(lx - lw/2, ly, lw, lh, 5);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(lx - lw/4, ly, lw/2, lh);
    };

    const legLen = 40;
    const bodyW = 35;
    const bodyH = 45;
    
    // -- LEGS --
    // Right Leg (Back)
    const rKneeY = -legLen + (rLegZ * 10);
    drawLimb(10, -legLen * 2 + (rLegZ * 5), 12, legLen, '#334155');

    // Left Leg (Front)
    const lKneeY = -legLen + (lLegZ * 10);
    drawLimb(-10, -legLen * 2 + (lLegZ * 5), 12, legLen, '#334155');

    // -- BODY (Torso) --
    ctx.fillStyle = primaryColor;
    // Trapezoid Body
    ctx.beginPath();
    ctx.moveTo(-bodyW/2, -legLen*2);
    ctx.lineTo(bodyW/2, -legLen*2);
    ctx.lineTo(bodyW/1.5, -legLen*2 - bodyH);
    ctx.lineTo(-bodyW/1.5, -legLen*2 - bodyH);
    ctx.fill();
    
    // Armor Plate detail
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(-10, -legLen*2 - bodyH + 10, 20, 25);

    // -- HEAD --
    const headSize = 24;
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, -legLen*2 - bodyH - headSize/2, headSize/2, 0, Math.PI*2);
    ctx.fill();
    
    // Visor (Glowing)
    ctx.fillStyle = '#06b6d4'; // Cyan glow
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10;
    ctx.fillRect(-10, -legLen*2 - bodyH - headSize/2 - 2, 20, 4);
    ctx.shadowBlur = 0;

    // -- ARMS --
    // Shoulders
    if (hasArmor) {
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(-22, -legLen*2 - bodyH + 5, 12, 0, Math.PI*2); // L
        ctx.arc(22, -legLen*2 - bodyH + 5, 12, 0, Math.PI*2); // R
        ctx.fill();
    }

    // Arms swinging opposite to legs
    drawLimb(-22, -legLen*2 - bodyH + 5, 10, 30, primaryColor); // L
    drawLimb(22, -legLen*2 - bodyH + 5, 10, 30, primaryColor); // R

    // -- WINGS / JETPACK (Mk.3) --
    if (hasWings) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Left Wing
        ctx.moveTo(-10, -legLen*2 - bodyH + 20);
        ctx.lineTo(-60, -legLen*2 - bodyH - 20);
        ctx.lineTo(-20, -legLen*2 - bodyH + 10);
        // Right Wing
        ctx.moveTo(10, -legLen*2 - bodyH + 20);
        ctx.lineTo(60, -legLen*2 - bodyH - 20);
        ctx.lineTo(20, -legLen*2 - bodyH + 10);
        ctx.stroke();

        // Thruster Particles
        if (Math.random() > 0.5) {
            ctx.fillStyle = '#3b82f6';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(-20 + Math.random()*10, -legLen*2 - bodyH + 20, Math.random()*8, 0, Math.PI*2);
            ctx.arc(20 + Math.random()*10, -legLen*2 - bodyH + 20, Math.random()*8, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    // Score Float
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.scale(1, 1); // Reset scale for text? No, keep it scaled
    ctx.fillText(scoreRef.current.toString(), 0, -160);

    ctx.restore();
  };

  const handleResize = useCallback(() => {
    if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = playerNameInput.trim() || 'Anonymous';
    const newData = { score: score, name: name, maxLevel: Math.max(level, highScoreData.maxLevel) };
    setHighScoreData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    setNewHighScore(false);
  };

  // -- Touch Controls --
  const handleTouchStart = (side: 'left' | 'right') => {
    touchDirection.current = side === 'left' ? -1 : 1;
  };

  const handleTouchEnd = () => {
    touchDirection.current = 0;
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden select-none" onClick={() => window.focus()}>
      
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Touch Control Zones */}
      <div 
        className="absolute top-0 left-0 w-1/2 h-full z-10 opacity-0"
        onTouchStart={() => handleTouchStart('left')}
        onTouchEnd={handleTouchEnd}
      ></div>
      <div 
        className="absolute top-0 right-0 w-1/2 h-full z-10 opacity-0"
        onTouchStart={() => handleTouchStart('right')}
        onTouchEnd={handleTouchEnd}
      ></div>

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-20 font-sans">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-yellow-300 text-xs font-bold uppercase tracking-widest opacity-80">
            <Trophy size={14} />
            <span>Top: {highScoreData.name} - {highScoreData.score}</span>
          </div>
          <div className="text-white text-4xl font-light tracking-tighter drop-shadow-md">
            {score}
          </div>
        </div>
        
        {/* Progress & Level */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center w-1/3">
             <div className="text-cyan-400 font-bold tracking-[0.2em] mb-1 text-sm">LEVEL {level}</div>
             <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-300 ease-linear"
                    style={{ width: `${Math.min(100, (distanceTraveled / ((nextBossDistanceRef.current - (LEVEL_DISTANCE_BASE * Math.pow(LEVEL_DISTANCE_SCALING, level-2)))/100)) * 100)}%` }} // Rough progress calc
                ></div>
             </div>
             {gameState === GameState.BOSS_FIGHT && (
                 <div className="mt-2 text-red-500 font-bold animate-pulse text-xs tracking-widest">BOSS BATTLE</div>
             )}
        </div>
      </div>
      
      {/* Level Transition Overlay */}
      {gameState === GameState.LEVEL_TRANSITION && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
              <div className="bg-black/50 backdrop-blur-md p-10 rounded-2xl border border-cyan-500/30 animate-in zoom-in duration-300 flex flex-col items-center">
                  <Zap size={64} className="text-yellow-400 mb-4 animate-bounce" />
                  <h2 className="text-6xl font-black text-white italic tracking-tighter drop-shadow-lg">LEVEL UP!</h2>
                  <p className="text-cyan-300 tracking-widest mt-2">ENTERING ZONE {level}</p>
              </div>
          </div>
      )}

      {/* Start Screen */}
      {gameState === GameState.START && (
        <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center z-30 text-white backdrop-blur-sm game-overlay">
          <h1 className="text-6xl md:text-8xl font-thin tracking-tighter text-white mb-2 drop-shadow-lg">
            MATH<span className="font-bold text-cyan-400">RUN</span>
          </h1>
          <p className="text-cyan-200/80 mb-10 font-sans text-sm tracking-[0.2em] uppercase">
            Calculate • Evolve • Survive
          </p>
          <button 
            onClick={resetGame}
            className="group relative px-10 py-4 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-full text-white font-bold text-lg uppercase tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
          >
            <span className="flex items-center gap-3">
              <Play fill="currentColor" size={20} />
              Start Run
            </span>
          </button>
        </div>
      )}

      {/* Game Over / Victory */}
      {(gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) && (
        <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-30 text-white backdrop-blur-lg animate-in fade-in duration-500 game-overlay">
          
          {gameState === GameState.VICTORY ? (
               <Crown size={80} className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
          ) : (
               <Skull size={64} className="text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
          )}

          <h2 className={`text-5xl font-thin tracking-tighter uppercase mb-2 ${gameState === GameState.VICTORY ? 'text-yellow-400' : 'text-white'}`}>
             {gameState === GameState.VICTORY ? 'Victory' : 'Game Over'}
          </h2>
          
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-xl mb-8 text-center min-w-[320px] shadow-2xl">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Final Score</p>
            <p className="text-6xl font-light text-white mb-2">{score}</p>
            <p className="text-cyan-400 text-sm font-bold tracking-widest mb-6">REACHED LEVEL {level}</p>
            
            {newHighScore ? (
              <div className="animate-in slide-in-from-bottom duration-500">
                <div className="flex items-center justify-center gap-2 text-yellow-400 font-bold mb-4 text-sm tracking-wide">
                  <Trophy size={16} />
                  <span>NEW HIGH SCORE</span>
                </div>
                <form onSubmit={handleNameSubmit} className="flex flex-col gap-3">
                  <input 
                    type="text" 
                    maxLength={10}
                    placeholder="ENTER NAME"
                    value={playerNameInput}
                    onChange={(e) => setPlayerNameInput(e.target.value)}
                    autoFocus
                    className="bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-center text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 focus:bg-black/30 transition-all font-mono"
                  />
                  <button 
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                  >
                    SAVE RECORD
                  </button>
                </form>
              </div>
            ) : (
                <div className="text-xs text-slate-500 font-mono border-t border-white/5 pt-4">
                    BEST: {highScoreData.name} — {highScoreData.score}
                </div>
            )}
          </div>

          {!newHighScore && (
            <button 
              onClick={resetGame}
              className="px-8 py-3 bg-white text-slate-900 font-bold uppercase tracking-wider hover:bg-slate-200 transition-all rounded-full flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-white/20 hover:scale-105 active:scale-95"
            >
              <RotateCcw size={18} />
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
