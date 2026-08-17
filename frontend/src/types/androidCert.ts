export interface InstallStepResult {
  method: string;
  status: 'unavailable' | 'skipped' | 'running' | 'success' | 'failed';
  message: string;
}

export interface ADBDeviceInfo {
  serial: string;
  state: string;
  model: string;
  rooted: boolean;
}

export interface AndroidInstallResult {
  success: boolean;
  adbAvailable: boolean;
  deviceSerial: string;
  rooted: boolean;
  subjectHash: string;
  certFileName: string;
  steps: InstallStepResult[];
}
