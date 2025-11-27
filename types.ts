export enum AppMode {
  IDLE = 'IDLE',
  PREVIEW = 'PREVIEW',
  RECORDING = 'RECORDING'
}

export enum AiFeature {
  NONE = 'NONE',
  INTERVIEWER = 'INTERVIEWER',
  TELEPROMPTER = 'TELEPROMPTER'
}

export interface CanvasState {
  width: number;
  height: number;
  bgIndex: number;
  usePadding: boolean;
  aspectRatio: number;
  camEnabled: boolean;
  camX: number;
  camY: number;
  camSize: number;
  isFullCam: boolean; // New property
  zoom: number;
  panX: number;
  panY: number;
}

export const BG_COLORS = [
  ['#E0C3FC', '#8EC5FC'], 
  ['#FF9A9E', '#FECFEF'], 
  ['#a18cd1', '#fbc2eb'], 
  ['#f5f5f7', '#e1e1e6'], 
  ['#000000', '#1a1a1a']
];