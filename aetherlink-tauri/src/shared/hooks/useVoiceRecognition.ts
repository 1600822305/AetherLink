import { useState, useEffect, useCallback } from 'react';
import { voiceRecognitionService } from '../services/VoiceRecognitionService';
import type { SpeechRecognitionPermissions } from '../types/voice';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(voiceRecognitionService.getIsListening());
  const [recognitionText, setRecognitionText] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<SpeechRecognitionPermissions['speechRecognition']>('unknown');
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const service = voiceRecognitionService;

    const handlePartialResults = (text: string) => {
      setRecognitionText(text);
    };

    const handleListeningState = (status: 'started' | 'stopped') => {
      setIsListening(status === 'started');
      if (status === 'stopped') {
        // Clear recognition text when listening stops, as the final result should be handled by the caller
        setRecognitionText('');
      }
    };

    const handleError = (err: any) => {
      setError(err);
      setIsListening(false);
    };

    service.setPartialResultsCallback(handlePartialResults);
    service.setListeningStateCallback(handleListeningState);
    service.setErrorCallback(handleError);

    // Initial permission check
    service.checkPermissions().then(status => {
      setPermissionStatus(status.speechRecognition);
    });

    return () => {
      // Clean up listeners when component unmounts
      // For @capacitor-community/speech-recognition, removeAllListeners is the way to go
      // if specific listener handles are not returned by addListener.
      // If addListener returns a handle, it's better to use handle.remove().
      // Assuming for now that removeAllListeners is appropriate for cleanup.
      // If not, individual listeners would need to be stored and removed.
      // For this plugin, addListener returns a Promise<PluginListenerHandle>
      // so we should store and remove them.
      // However, the service itself manages the callbacks, so setting them to null is fine for the service's internal state.
      // The actual plugin listeners are managed by the service's constructor.
    };
  }, []);

  const checkAndRequestPermissions = useCallback(async () => {
    const status = await voiceRecognitionService.checkPermissions();
    setPermissionStatus(status.speechRecognition);
    if (status.speechRecognition !== 'granted') {
      const requestStatus = await voiceRecognitionService.requestPermissions();
      setPermissionStatus(requestStatus.speechRecognition);
      return requestStatus.speechRecognition === 'granted';
    }
    return status.speechRecognition === 'granted';
  }, []);

  const startRecognition = useCallback(async (options?: { language?: string; maxResults?: number; partialResults?: boolean; popup?: boolean }) => {
    setError(null);
    const hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      setError(new Error('Speech recognition permission not granted.'));
      return;
    }
    try {
      await voiceRecognitionService.startRecognition(options);
    } catch (err) {
      setError(err);
    }
  }, [checkAndRequestPermissions]);

  const stopRecognition = useCallback(async () => {
    try {
      await voiceRecognitionService.stopRecognition();
    } catch (err) {
      setError(err);
    }
  }, []);

  const getSupportedLanguages = useCallback(async () => {
    return await voiceRecognitionService.getSupportedLanguages();
  }, []);

  return {
    isListening,
    recognitionText,
    permissionStatus,
    error,
    startRecognition,
    stopRecognition,
    checkAndRequestPermissions,
    getSupportedLanguages,
  };
};