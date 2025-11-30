
import { BlockType } from './types';

// -- 3D Rendering Constants --
export const FOV = 400; // Field of view
export const CAMERA_HEIGHT = 240; // Higher camera for better view of character
export const CAMERA_DIST = 400; // Distance behind
export const HORIZON_Y = 0.35; // Screen percentage

// -- World --
export const ROAD_WIDTH = 600; 
export const LANE_COUNT = 5;
export const SPAWN_Z = 3000; 
export const PLAYER_Z = 0; 

// -- Gameplay Balancing --
export const GAME_SPEED_INITIAL = 600; 
export const GAME_SPEED_MAX = 3000; // Significantly increased from 1800
export const SPEED_SCALE_PER_POINT = 0.2; 

export const PLAYER_LATERAL_SPEED = 900; // Snappier movement

export const SPAWN_RATE_INITIAL = 1000; 
export const SPAWN_RATE_MIN = 250; 

export const LEVEL_DISTANCE_BASE = 10000; // Distance for Level 1 (shorter for testing fun)
export const LEVEL_DISTANCE_SCALING = 1.2; // Each level is 20% longer
export const BOSS_BASE_HEALTH = 150; // Increased base HP from 100
export const BOSS_HP_SCALING = 1.8; // Increased scaling from 1.4 to 1.8 (Exponential difficulty)

export const BLOCK_SIZE = 80; 
export const PLAYER_SIZE = 70; 

export const COLORS = {
  [BlockType.ADD]: '#22c55e', 
  [BlockType.MULT]: '#3b82f6', 
  [BlockType.SUB]: '#ef4444', 
  [BlockType.DIV]: '#f97316', 
  [BlockType.DEATH]: '#000000', 
  ENEMY: '#dc2626', 
  BOSS: '#7f1d1d', 
  ROAD_MAIN: '#1e293b', 
  ROAD_STRIPE: '#334155', 
};

export const STORAGE_KEY = 'arrowRushSave_v4_levels';
