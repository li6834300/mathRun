
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  BOSS_FIGHT = 'BOSS_FIGHT',
  LEVEL_TRANSITION = 'LEVEL_TRANSITION', // New state for between levels
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum EntityType {
  BLOCK = 'BLOCK', 
  ENEMY = 'ENEMY', 
  BOSS = 'BOSS'    
}

export enum BlockType {
  ADD = 'ADD',
  MULT = 'MULT',
  SUB = 'SUB',
  DIV = 'DIV',
  DEATH = 'DEATH' 
}

export interface Entity {
  id: number;
  type: EntityType;
  x: number; 
  y: number; 
  z: number; 
  width: number;
  height: number;
  color: string;
}

export interface Block extends Entity {
  type: EntityType.BLOCK;
  blockType: BlockType;
  value: number; 
  text: string;
  textColor: string;
}

export interface Enemy extends Entity {
  type: EntityType.ENEMY;
  power: number; 
}

export interface Boss extends Entity {
  type: EntityType.BOSS;
  maxHealth: number;
  currentHealth: number;
  level: number;
}

export type GameEntity = Block | Enemy | Boss;

export interface Player {
  x: number;
  y: number; 
  z: number; 
  width: number;
  height: number;
  speed: number; 
  lean: number; // For visual banking when turning
}

export interface HighScoreData {
  score: number;
  name: string;
  maxLevel: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number; 
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
