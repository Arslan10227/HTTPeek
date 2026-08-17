export {};

declare global {
  interface Window {
    runtime?: {
      EventsOn: (eventName: string, callback: (...args: any[]) => void) => () => void;
      EventsEmit: (eventName: string, ...args: any[]) => void;
    };
    go?: {
      main?: {
        App?: {
          StartProxy: (port: number, enableSSL: boolean, enableSystemProxy: boolean) => Promise<void>;
          StopProxy: () => Promise<void>;
          GetStatus: () => Promise<any>;
          SetSystemProxy: (enable: boolean) => Promise<void>;
          InstallRootCA: () => Promise<void>;
          UninstallRootCA: () => Promise<void>;
          CheckCAInstalled: () => Promise<boolean>;
          GetCADetails: () => Promise<any>;
          ExportRootCA: () => Promise<string>;
          ListADBDevices: () => Promise<any[]>;
          InstallAndroidRootCA: (deviceSerial: string) => Promise<any>;
          GetLocalIPs: () => Promise<string[]>;
          SendCustomRequest: (reqJSON: string) => Promise<any>;
          ResumeBreakpoint: (requestId: string, isResponse: boolean, modifiedJSON: string) => Promise<void>;
          AbortBreakpoint: (requestId: string, isResponse: boolean) => Promise<void>;
          ToolboxEncode: (action: string, input: string) => Promise<string>;
          ToolboxAES: (action: string, mode: string, input: string, key: string, iv: string) => Promise<string>;
        };
      };
    };
  }
}
