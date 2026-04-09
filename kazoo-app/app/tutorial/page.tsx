'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

export default function TutorialPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);

  const SLIDES = [
    {
      anim: (
        <div className="tutorial-anim">
          <div className="tut-phone-icon">📱</div>
          <div className="tut-arrow-down">↕</div>
        </div>
      ),
      title: t('tut0-title'),
      text: t('tut0-desc'),
    },
    {
      anim: (
        <div className="tutorial-anim">
          <div className="tut-wave-row">
            {[0,1,2,3,4].map(i => <div key={i} className={`tut-wave w${i}`} />)}
          </div>
        </div>
      ),
      title: t('tut1-title'),
      text: t('tut1-desc'),
    },
    {
      anim: (
        <div className="tutorial-anim">
          <div className="tut-note-demo">
            <div className="tut-note falling" />
            <div className="tut-target-zone">{t('tut-target')}</div>
          </div>
        </div>
      ),
      title: t('tut2-title'),
      text: <span>{t('tut2-desc')}</span>,
    },
    {
      anim: (
        <div className="tutorial-anim">
          <div className="tut-thermo-demo">
            <div className="tut-thermo-bar">
              <div className="tut-thermo-fill animated" />
              <div className="tut-thermo-icon">🎵</div>
            </div>
            <div className="tut-thermo-labels">
              <span>{t('tut-stable')}</span>
              <span>{t('tut-erratic')}</span>
            </div>
          </div>
        </div>
      ),
      title: t('tut3-title'),
      text: <span>{t('tut3-desc')}</span>,
    },
    {
      anim: (
        <div className="tutorial-anim">
          <div className="tut-badges-row">
            <div className="tut-badge unlocked">🌟</div>
            <div className="tut-badge">🔒</div>
            <div className="tut-badge">🔒</div>
          </div>
          <div className="tut-calendar-mini">
            <div className="tut-cal-day active">M</div>
            <div className="tut-cal-day">T</div>
            <div className="tut-cal-day">W</div>
          </div>
        </div>
      ),
      title: t('tut4-title'),
      text: t('tut4-desc'),
    },
  ];

  const total = SLIDES.length;
  const slide = SLIDES[idx];

  const goNext = () => {
    if (idx < total - 1) setIdx(idx + 1);
    else router.push('/game');
  };
  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <button className="btn-back" onClick={() => router.push('/')}>{t('btn-back')}</button>
        <h2>{t('tut-header')}</h2>
        <div />
      </div>

      <div className="tutorial-content">
        <div className="tutorial-slides">
          <div className="tutorial-slide active">
            {slide.anim}
            <h3>{slide.title}</h3>
            <p>{slide.text}</p>
          </div>
        </div>

        <div className="tutorial-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`dot${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)} />
          ))}
        </div>

        <div className="tutorial-nav-buttons">
          <button
            className="btn btn-glass"
            onClick={goPrev}
            style={{ visibility: idx === 0 ? 'hidden' : 'visible' }}
          >{t('btn-tut-prev')}</button>
          <button className="btn btn-primary" onClick={goNext}>
            {idx === total - 1 ? t('btn-tut-finish') : t('btn-tut-next')}
          </button>
        </div>
      </div>
    </div>
  );
}
