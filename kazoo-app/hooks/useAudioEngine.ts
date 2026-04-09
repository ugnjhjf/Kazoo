'use client';
import { useRef, useCallback } from 'react';

interface AudioEngine {
  stream: MediaStream | null;
  audioCtx: AudioContext | null;
  analyser: AnalyserNode | null;
  dataArray: Float32Array<ArrayBuffer> | null;
  active: boolean;
}

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine>({
    stream: null,
    audioCtx: null,
    analyser: null,
    dataArray: null,
    active: false,
  });

  const requestMic = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 44100 });
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;
      source.connect(analyser);

      engineRef.current = { stream, audioCtx, analyser, dataArray, active: true };
      return true;
    } catch {
      return false;
    }
  }, []);

  const detectPitch = useCallback((): number => {
    const { analyser, dataArray, audioCtx, active } = engineRef.current;
    if (!active || !analyser || !dataArray || !audioCtx) return -1;
    analyser.getFloatTimeDomainData(dataArray);
    return autoCorrelate(dataArray, audioCtx.sampleRate);
  }, []);

  const getFrequencyData = useCallback((arr: Uint8Array<ArrayBuffer>) => {
    const { analyser, active } = engineRef.current;
    if (!active || !analyser) return;
    analyser.getByteFrequencyData(arr);
  }, []);

  const getTimeDomainData = useCallback((arr: Uint8Array<ArrayBuffer>) => {
    const { analyser, active } = engineRef.current;
    if (!active || !analyser) return;
    analyser.getByteTimeDomainData(arr);
  }, []);

  const calcStability = useCallback((history: number[]): number => {
    if (history.length < 4) return 0;
    const mean = history.reduce((a, v) => a + v, 0) / history.length;
    const variance = history.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(100, 100 - (stdDev / 80) * 100));
  }, []);

  const stopMic = useCallback(() => {
    const { stream, audioCtx } = engineRef.current;
    stream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close();
    engineRef.current = { stream: null, audioCtx: null, analyser: null, dataArray: null, active: false };
  }, []);

  const isActive = useCallback(() => engineRef.current.active, []);

  return { requestMic, detectPitch, getFrequencyData, getTimeDomainData, calcStability, stopMic, isActive, engineRef };
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const buf2 = buffer.slice(r1, r2);
  const c = new Array(buf2.length).fill(0);
  for (let i = 0; i < buf2.length; i++) {
    for (let j = 0; j < buf2.length - i; j++) {
      c[i] += buf2[j] * buf2[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < buf2.length; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }

  let T0 = maxPos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 -= b / (2 * a);

  return sampleRate / T0;
}
