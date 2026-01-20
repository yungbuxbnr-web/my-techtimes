
import { EventEmitter } from 'events';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

class ToastManager extends EventEmitter {
  private toastQueue: ToastMessage[] = [];
  private currentToast: ToastMessage | null = null;

  show(message: string, type: ToastType = 'info', duration: number = 3000) {
    console.log('ToastManager: Showing toast -', type, ':', message);
    const toast: ToastMessage = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      duration,
    };

    if (!this.currentToast) {
      this.currentToast = toast;
      this.emit('show', toast);
      
      setTimeout(() => {
        this.currentToast = null;
        this.processQueue();
      }, duration + 500);
    } else {
      this.toastQueue.push(toast);
    }
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  }

  private processQueue() {
    if (this.toastQueue.length > 0) {
      const nextToast = this.toastQueue.shift();
      if (nextToast) {
        this.currentToast = nextToast;
        this.emit('show', nextToast);
        
        setTimeout(() => {
          this.currentToast = null;
          this.processQueue();
        }, nextToast.duration! + 500);
      }
    }
  }
}

export const toastManager = new ToastManager();
