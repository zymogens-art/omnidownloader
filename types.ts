
export enum DownloadStatus {
  PENDING = 'PENDING',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  DOWNLOADING = 'DOWNLOADING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER'
}

export interface MediaItem {
  id: string;
  originalUrl: string;
  directUrl?: string;
  filename: string;
  originalFilename?: string; // Stored to allow resetting renames
  type: MediaType;
  status: DownloadStatus;
  progress: number;
  error?: string;
  // Simulated metadata for enhanced UI
  simulatedSize?: string;
  simulatedSpeed?: string;
  simulatedEta?: string;
}

export interface AnalysisResult {
  url: string;
  type: MediaType;
  suggestedFilename: string;
  isDirectLink: boolean;
}
