// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function LandingPage() {
<<<<<<< HEAD
  const [showLoginModal, setShowLoginModal] = useState(false);
=======
>>>>>>> aa728d9 (admin UI)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="landing-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .landing-root {
          min-height: 100vh;
          background-color: #090d16;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .landing-root * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Navigation Header */
        .site-header {
          border-bottom: 1px solid #22304d;
          background: rgba(9, 13, 22, 0.9);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 0.85rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-icon {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          padding: 0.5rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-title {
          font-weight: 700;
          font-size: 1.1rem;
          letter-spacing: -0.01em;
          color: #ffffff;
        }

        .brand-badge {
          font-size: 0.75rem;
          color: #94a3b8;
          border: 1px solid #22304d;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          margin-left: 0.5rem;
          background: #131b2e;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.55rem 1rem;
          border-radius: 7px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-primary {
          background: #f59e0b;
          color: #090d16;
        }
        .btn-primary:hover {
          background: #d97706;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
        }

        .btn-secondary {
          background: #131b2e;
          color: #e2e8f0;
          border: 1px solid #22304d;
        }
        .btn-secondary:hover {
          background: #1a253f;
          border-color: #3b507d;
        }

        .btn-install {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .btn-install:hover {
          background: rgba(16, 185, 129, 0.25);
        }

        /* Hero Container */
        .hero-container {
          max-width: 1150px;
          margin: 0 auto;
          padding: 3.5rem 1.5rem 3rem;
          flex: 1;
        }

        .badge-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 0.3rem 0.85rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .pulse-indicator {
          width: 8px;
          height: 8px;
          background: #f59e0b;
          border-radius: 50%;
          box-shadow: 0 0 8px #f59e0b;
        }

        .hero-headline {
          font-size: clamp(2.1rem, 4.5vw, 3.4rem);
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 1.25rem;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .hero-subtext {
          font-size: 1.15rem;
          color: #94a3b8;
          max-width: 760px;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 3rem;
        }

        /* Road Path Showcase Card */
        .road-showcase {
          position: relative;
          width: 100%;
<<<<<<< HEAD
          height: 380px;
          border-radius: 16px;
=======
          height: clamp(300px, 35vw, 420px);
          border-radius: 20px;
>>>>>>> aa728d9 (admin UI)
          overflow: hidden;
          border: 1px solid #22304d;
          margin-bottom: 4rem;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          background-color: #131b2e;
        }

        .road-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
<<<<<<< HEAD
          background: linear-gradient(180deg, rgba(9, 13, 22, 0.2) 0%, rgba(9, 13, 22, 0.85) 100%);
=======
          background: linear-gradient(90deg, rgba(9, 13, 22, 0.08) 30%, rgba(9, 13, 22, 0.28) 100%), linear-gradient(180deg, rgba(9, 13, 22, 0.04) 20%, rgba(9, 13, 22, 0.82) 100%);
>>>>>>> aa728d9 (admin UI)
          display: flex;
          align-items: flex-end;
          padding: 1.5rem;
        }

        .road-pill-badge {
          background: rgba(19, 27, 46, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid #22304d;
          padding: 0.6rem 1rem;
          border-radius: 10px;
<<<<<<< HEAD
=======
          max-width: 100%;
>>>>>>> aa728d9 (admin UI)
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .road-pill-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffffff;
        }

        .road-pill-sub {
          font-size: 0.75rem;
          color: #94a3b8;
<<<<<<< HEAD
=======
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .road-showcase {
            height: clamp(250px, 72vw, 330px);
            border-radius: 14px;
          }

          .road-overlay {
            padding: 1rem;
          }

          .road-pill-badge {
            align-items: flex-start;
            gap: 0.6rem;
            padding: 0.75rem;
          }

          .road-pill-sub {
            font-size: 0.68rem;
          }
>>>>>>> aa728d9 (admin UI)
        }

        /* Feature Card Grid */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          border-top: 1px solid #22304d;
          padding-top: 3.5rem;
        }

        .card {
          background: #131b2e;
          border: 1px solid #22304d;
          border-radius: 12px;
          padding: 1.75rem;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          border-color: #3b507d;
        }

        .card-icon {
          display: inline-block;
          margin-bottom: 1rem;
        }

        .card-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .card-desc {
          font-size: 0.925rem;
          color: #94a3b8;
          line-height: 1.6;
        }

<<<<<<< HEAD
        /* Modal Overlay */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 7, 14, 0.8);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1.25rem;
        }

        .modal-box {
          background: #131b2e;
          border: 1px solid #22304d;
          border-radius: 14px;
          width: 100%;
          max-width: 430px;
          padding: 2rem;
          position: relative;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }

        .modal-close-btn {
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }
        .modal-close-btn:hover {
          color: #ffffff;
        }

        .input-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 0.4rem;
        }

        .text-input {
          width: 100%;
          padding: 0.75rem 0.9rem;
          background: #090d16;
          border: 1px solid #22304d;
          border-radius: 7px;
          color: #f1f5f9;
          font-size: 0.95rem;
          outline: none;
          margin-bottom: 1.25rem;
        }
        .text-input:focus {
          border-color: #f59e0b;
        }

=======
>>>>>>> aa728d9 (admin UI)
        /* Institutional Footer */
        .page-footer {
          border-top: 1px solid #22304d;
          padding: 2.25rem 1.5rem;
          text-align: center;
          font-size: 0.825rem;
          color: #64748b;
          line-height: 1.7;
          background: #060910;
        }
      `}} />

      {/* Top Header */}
      <header className="site-header">
        <div className="brand-group">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <span className="brand-title">Road Defect Collector</span>
            <span className="brand-badge">Ga Central Municipal</span>
          </div>
        </div>

        <div className="header-actions">
          {isInstallable && (
            <button onClick={handleInstallClick} className="btn btn-install">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Install Web App</span>
            </button>
          )}

<<<<<<< HEAD
          <button onClick={() => setShowLoginModal(true)} className="btn btn-secondary">
=======
          <Link href="/admin/login" className="btn btn-secondary">
>>>>>>> aa728d9 (admin UI)
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            <span>Officer Portal</span>
<<<<<<< HEAD
          </button>
=======
          </Link>
>>>>>>> aa728d9 (admin UI)
        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-container">
        <div className="badge-tag">
          <span className="pulse-indicator"></span>
          <span>Municipal Urban Roads Partnership</span>
        </div>

        <h1 className="hero-headline">
          Monitoring Road Infrastructure in Ga Central Municipality
        </h1>

        <p className="hero-subtext">
          A mobile-friendly reporting and quality-review system connecting citizens and municipal engineers in Ga Central (Sowutuom, Santa Maria, Anyaa, and Ablekuma) to monitor road defects, ensure public privacy, and track maintenance lifecycles[cite: 3, 4].
        </p>

        <div className="hero-actions">
          <Link href="/collect" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>Report Road Defect</span>
          </Link>

          <Link href="/reports" className="btn btn-secondary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <span>Public Tracking Map</span>
          </Link>

          <Link href="/drone" className="btn btn-secondary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Drone AI Pilot</span>
          </Link>
        </div>

        {/* Road Path Visual Showcase */}
        <div className="road-showcase">
          <Image
            src="/road-banner.jpg"
<<<<<<< HEAD
            alt=""
            fill
            sizes="(max-width: 1150px) calc(100vw - 3rem), 1102px"
            preload
=======
            alt="A pothole-damaged road in Ga Central Municipality"
            fill
            sizes="(max-width: 1150px) calc(100vw - 3rem), 1102px"
            preload
            unoptimized
>>>>>>> aa728d9 (admin UI)
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
          <div className="road-overlay">
            <div className="road-pill-badge">
              <div style={{ color: '#f59e0b' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 0 0-8-8z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <div className="road-pill-title">Ga Central Defect Inspection Corridor</div>
                <div className="road-pill-sub">Automated GPS intake &bull; YOLOS Tiny Privacy Protection &bull; Verification Triage</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="feature-grid">
          <div className="card">
            <div className="card-icon" style={{ color: '#10b981' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3 className="card-title">Privacy-By-Design Blurring</h3>
            <p className="card-desc">
              Complies with Ghana Data Protection Act (Act 843). Automatically detects and blurs human faces, vehicle bodies, and license plates before storage[cite: 3].
            </p>
          </div>

          <div className="card">
            <div className="card-icon" style={{ color: '#f59e0b' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 0 0-8-8z"/>
              </svg>
            </div>
            <h3 className="card-title">GPS &amp; Digital Addresses</h3>
            <p className="card-desc">
              Captures high-precision device GPS coordinates, timestamps, and GhanaPostGPS digital addresses for rapid assembly engineer dispatch[cite: 3, 4].
            </p>
          </div>

          <div className="card">
            <div className="card-icon" style={{ color: '#38bdf8' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h3 className="card-title">Maintenance Lifecycles</h3>
            <p className="card-desc">
              Follow repair progress through transparent before, in-progress, and after inspection photo timelines and verification stages[cite: 3].
            </p>
          </div>
        </div>
      </main>

<<<<<<< HEAD
      {/* Municipal Officer Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <button 
              onClick={() => setShowLoginModal(false)} 
              className="modal-close-btn"
              aria-label="Close modal"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.4rem', color: '#ffffff' }}>
              Officer Sign-In
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Enter the Ga Central Municipal Assembly review key to manage queues, reviews, and repair lifecycles[cite: 3, 4].
            </p>

            <form action="/admin/login" method="POST">
              <div>
                <label className="input-label">Administrator Password</label>
                <input
                  type="password"
                  name="password"
                  placeholder="Enter administrator password"
                  required
                  autoFocus
                  className="text-input"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem' }}
              >
                Sign In to Review Portal
              </button>
            </form>
          </div>
        </div>
      )}

=======
>>>>>>> aa728d9 (admin UI)
      {/* Collaboration Footer */}
      <footer className="page-footer">
        Pentecost University &bull; Faculty of Engineering and Computing &bull; Department of Industrial Software Engineering[cite: 4]
        <br />
        Project Supervisor: Mr. Harry Atieku-Boateng &bull; Ga Central Municipal Assembly (GCMA) Academic Pilot[cite: 4]
      </footer>
    </div>
  );
}