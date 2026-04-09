'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useAudioEngine } from '@/hooks/useAudioEngine';

type CalibStep = 'low' | 'mid' | 'high' | 'done';

export default function CalibrationPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { settings, setSettings } = useAppStore();
  const { requestMic, detectPitch, isActive, stopMic } = useAudioEngine();

  const [step, setStep] = useState<CalibStep>('low');
  const [liveHz, setLiveHz] = useState('--');
  const [calibData, setCalibData] = useState({
    low: settings.calibrationData?.low ?? null,
    mid: settings.calibrationData?.mid ?? null,
    high: settings.calibrationData?.high ?? null,
  });

  const animRef = useRef<number | null>(null);

  const calibLoop = () => {
    const hz = Math.round(detectPitch());
    if (hz > 60 && hz < 1200) setLiveHz(String(hz));
    else setLiveHz('--');
    animRef.current = requestAnimationFrame(calibLoop);
  };

  useEffect(() => {
    const initMic = async () => {
      if (!isActive()) await requestMic();
      animRef.current = requestAnimationFrame(calibLoop);
    };
    initMic();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopMic();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordPitch = () => {
    if (liveHz === '--') return;
    const val = parseInt(liveHz, 10);
    
    if (step === 'low') {
      setCalibData({ ...calibData, low: val });
      setStep('mid');
    } else if (step === 'mid') {
      setCalibData({ ...calibData, mid: val });
      setStep('high');
    } else if (step === 'high') {
      const finalData = { ...calibData, high: val };
      setCalibData(finalData);
      setSettings({ calibrationData: finalData as any });
      setStep('done');
    }
  };

  const currentTitle = step === 'low' ? t('calib-lbl-low') : step === 'mid' ? t('calib-lbl-mid') : t('calib-lbl-high');

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <button className="btn-back" onClick={() => router.push('/settings')}>‹</button>
        <h2>{t('calib-header')}</h2>
        <div />
      </div>

      <div className="calibration-content" style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <p style={{ fontSize: '1rem', color: 'var(--clr-text-dim)' }}>
          {t('calib-desc')}
        </p>

        {step !== 'done' ? (
          <div style={{ width: '100%', maxWidth: '320px', background: '#ffffff', border: '2px solid var(--clr-border)', borderRadius: '20px', padding: '24px', boxShadow: '0 8px 24px rgba(138,61,224,0.06)' }}>
            <h3 style={{ fontSize: '2rem', color: 'var(--clr-primary)', marginBottom: '12px' }}>{currentTitle}</h3>
            
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--clr-accent)', marginBottom: '24px' }}>
              <span>{liveHz}</span><span style={{ fontSize: '1rem', color: 'var(--clr-text-dim)' }}> Hz</span>
            </div>
            
            <button className="btn btn-primary btn-xl" onClick={recordPitch}>
              {t('btn-calib-record')}
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '320px', background: '#ffffff', border: '2px solid #10b981', borderRadius: '20px', padding: '24px', boxShadow: '0 8px 24px rgba(16,185,129,0.1)' }}>
            <h3 style={{ fontSize: '2rem', color: '#10b981', marginBottom: '12px' }}>✅ {t('calib-done')}</h3>
            <button className="btn btn-primary btn-xl" onClick={() => router.push('/settings')}>
              {t('btn-back')} {t('btn-settings')}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', maxWidth: '320px', marginTop: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-dim)' }}>{t('calib-lbl-low')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{calibData.low ?? '--'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-dim)' }}>{t('calib-lbl-mid')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{calibData.mid ?? '--'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-dim)' }}>{t('calib-lbl-high')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{calibData.high ?? '--'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
