import {
  KeyRound,
  Lock,
  Play,
  ShieldCheck,
  Ticket,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import gateClosedBg from "@/assets/backgrounds/login-gate-closed.jpg";
import gateInsideBg from "@/assets/backgrounds/login-gate-inside.jpg";
import gateOpenBg from "@/assets/backgrounds/login-gate-open.jpg";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/context/AuthContext";
import { cyberAudio } from "@/lib/cyber-audio";
import type { AuthUser } from "@/types/auth";

type GatePhase = "locked" | "verifying" | "granted" | "opening" | "entering";

const OPEN_DELAY = 420;
const ENTER_DELAY = 1500;
const NAVIGATE_DELAY = 2750;

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<GatePhase>("locked");
  const [transitionDestination, setTransitionDestination] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => cyberAudio.isEnabled());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    [gateClosedBg, gateOpenBg, gateInsideBg].forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });

    return () => {
      timers.current.forEach(window.clearTimeout);
      cyberAudio.stop();
    };
  }, []);

  function clearSequence() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }

  function runGateSequence(destination?: string) {
    clearSequence();
    setTransitionDestination(destination ?? null);
    setPhase("granted");
    cyberAudio.playAccessGranted();

    timers.current.push(
      window.setTimeout(() => {
        setPhase("opening");
        cyberAudio.playGateOpening();
      }, OPEN_DELAY),
      window.setTimeout(() => setPhase("entering"), ENTER_DELAY),
      window.setTimeout(() => {
        if (destination) {
          navigate(destination, { replace: true });
        } else {
          setPhase("locked");
          setTransitionDestination(null);
        }
      }, NAVIGATE_DELAY),
    );
  }

  function handleLoginSuccess(authenticatedUser: AuthUser, requestedPath: string) {
    const destination = authenticatedUser.role === "admin"
      ? "/admin"
      : requestedPath.startsWith("/staff") ? requestedPath : "/staff";
    runGateSequence(destination);
  }

  function toggleSound() {
    setSoundEnabled(cyberAudio.toggle());
  }

  const isTransitioning = phase === "granted" || phase === "opening" || phase === "entering";
  if (!isLoading && user && !transitionDestination) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
  }

  return (
    <main className={`gate-login gate-phase-${phase}`} aria-busy={isTransitioning}>
      <div className="gate-inside-layer" aria-hidden="true" />
      <div className="gate-open-layer" aria-hidden="true" />
      <div className="gate-door gate-door-left" aria-hidden="true" />
      <div className="gate-door gate-door-right" aria-hidden="true" />
      <div className="gate-light-seam" aria-hidden="true" />
      <div className="gate-floor-light" aria-hidden="true" />
      <div className="gate-vignette" aria-hidden="true" />

      <button className="gate-brand" type="button" onClick={() => navigate("/")}>
        <span><Ticket size={19} /></span>
        <strong>TICKETBOX QR<small>OPERATIONS AIRLOCK</small></strong>
      </button>

      <button className="gate-audio" type="button" onClick={toggleSound}>
        {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        AUDIO {soundEnabled ? "ON" : "OFF"}
      </button>

      <section className="gate-login-shell">
        <div className="gate-terminal">
          <div className="gate-terminal-scan" aria-hidden="true" />
          <div className="gate-terminal-status">
            <span className="gate-status-dot" />
            {phase === "verifying" ? "VERIFYING CLEARANCE" : isTransitioning ? "ACCESS GRANTED" : "SECURITY GATE LOCKED"}
            <small>NODE 07</small>
          </div>

          <header className="gate-terminal-header">
            <div>
              <p>LEVEL-4 SECURE ACCESS</p>
              <h1>{isTransitioning ? "Welcome, operator" : "Command access"}</h1>
              <span>Authenticate to enter the event operations center.</span>
            </div>
            <i>{isTransitioning ? <ShieldCheck size={24} /> : <KeyRound size={24} />}</i>
          </header>

          <LoginForm
            onLoginSuccess={handleLoginSuccess}
            onAuthenticatingChange={(authenticating) => setPhase(authenticating ? "verifying" : "locked")}
            isOpeningGate={isTransitioning}
          />

          <footer className="gate-terminal-footer">
            <Lock size={12} /> JWT SESSION PROTECTED <b>•</b> TLS READY
          </footer>
        </div>
      </section>

      <button
        className="gate-preview"
        type="button"
        onClick={() => !isTransitioning && runGateSequence()}
        disabled={isTransitioning}
      >
        <Play size={14} /> Preview airlock
      </button>

      <div className="gate-hud" aria-live="polite">
        <ShieldCheck size={30} />
        <strong>ACCESS AUTHORIZED</strong>
        <span>ENTERING OPERATIONS COMMAND CENTER</span>
      </div>
    </main>
  );
}
