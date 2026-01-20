
import React, { useState, useEffect } from 'react';
import { Toast, ToastType } from './Toast';
import { toastManager } from '@/utils/toastManager';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('info');
  const [toastDuration, setToastDuration] = useState(3000);

  useEffect(() => {
    const handleShow = (toast: any) => {
      console.log('ToastProvider: Received toast event');
      setToastMessage(toast.message);
      setToastType(toast.type);
      setToastDuration(toast.duration || 3000);
      setToastVisible(true);
    };

    toastManager.on('show', handleShow);

    return () => {
      toastManager.off('show', handleShow);
    };
  }, []);

  return (
    <>
      {children}
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        duration={toastDuration}
      />
    </>
  );
}
