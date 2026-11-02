"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Layers,
  Cpu,
  Vote,
  Radio,
  Flame,
  Network,
  ArrowLeft,
  Zap,
  CheckCircle2,
  Sliders,
  ExternalLink,
} from "lucide-react";

import "./architecture.css";

import SectionAOverview from "./components/SectionAOverview";
import SectionBLifecycle from "./components/SectionBLifecycle";
import SectionCConsensus from "./components/SectionCConsensus";
import SectionDVotingPower from "./components/SectionDVotingPower";
import SectionEStakingPrecompile from "./components/SectionEStakingPrecompile";
import SectionFSlashing from "./components/SectionFSlashing";
import SectionGFullArchitecture from "./components/SectionGFullArchitecture";

export default function ArchitecturePage() {
  const [activeNav, setActiveNav] = useState("overview");

  // Track scroll position to highlight active nav pill
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "section-overview",
        "section-lifecycle",
        "section-consensus",
        "section-voting-power",
        "section-precompile",
        "section-slashing",
        "section-full-architecture",
      ];

      const scrollPos = window.scrollY + 160;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          const id = sections[i].replace("section-", "");
          setActiveNav(id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setActiveNav(id);
    const target = document.getElementById(`section-${id}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="arch-page">
      {/* ── Top Main Navbar ────────────────────────────────────────── */}
      <header className="navbar">
        <div className="brand-wrapper">
          <div className="brand-logo">99</div>
          <div className="brand-meta">
            <div className="brand-title">
              <span>Chain99</span>
              <span className="badge-chain">L1 PoS</span>
            </div>
            <div className="brand-sub">Interactive Architecture Explorer</div>
          </div>
        </div>

        <div className="nav-actions">
          <div className="network-status-badge">
            <span className="pulse-dot" />
            <span>CometBFT PoS Online (Port 8545)</span>
          </div>

          <Link href="/stress-test" className="btn btn-secondary btn-sm" style={{ border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399" }}>
            <Zap size={14} /> Stress Testing
          </Link>

          <Link href="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="arch-container">
        {/* ── Hero Banner ────────────────────────────────────────────── */}
        <section className="arch-hero">
          <div className="arch-hero-badge">
            <Zap size={14} /> Production Engineering Specification
          </div>
          <h1 className="arch-title">Inside Chain99 Layer 1</h1>
          <p className="arch-subtitle">
            Explore how transactions execute, validators reach consensus, and
            the blockchain achieves deterministic single-block finality through
            Cosmos EVM v20, Cosmos SDK v0.50, and CometBFT v0.38.
          </p>

          {/* Quick Technical Specs Pills */}
          <div className="arch-kpi-bar">
            <div className="arch-kpi-pill">
              <span>Consensus:</span>
              <strong>CometBFT v0.38.12</strong>
            </div>
            <div className="arch-kpi-pill">
              <span>Execution:</span>
              <strong>Cosmos EVM v20.0.0</strong>
            </div>
            <div className="arch-kpi-pill">
              <span>Framework:</span>
              <strong>Cosmos SDK v0.50.9</strong>
            </div>
            <div className="arch-kpi-pill">
              <span>Chain ID:</span>
              <code>9999 (chain_9999-1)</code>
            </div>
            <div className="arch-kpi-pill">
              <span>Finality:</span>
              <strong>1-Block Deterministic (~1.4s)</strong>
            </div>
            <div className="arch-kpi-pill">
              <span>Staking Precompile:</span>
              <code>0x...0800</code>
            </div>
          </div>
        </section>

        {/* ── Sticky Sub-Navigation Bar ──────────────────────────────── */}
        <nav className="arch-nav-sticky">
          <div className="arch-nav-scroll">
            {[
              { id: "overview", label: "A. System Overview", icon: Layers },
              { id: "lifecycle", label: "B. Tx Lifecycle (9 Steps)", icon: Zap },
              { id: "consensus", label: "C. CometBFT Consensus", icon: Vote },
              { id: "voting-power", label: "D. Voting Power Sim", icon: Sliders },
              { id: "precompile", label: "E. EVM Precompile (0x800)", icon: Cpu },
              { id: "slashing", label: "F. Slashing & Security", icon: Flame },
              { id: "full-architecture", label: "G. Full Architecture Map", icon: Network },
            ].map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.id;

              return (
                <button
                  key={nav.id}
                  className={`arch-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => scrollToSection(nav.id)}
                >
                  <Icon size={14} />
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Section A: Architecture Overview ───────────────────────── */}
        <SectionAOverview />

        {/* ── Section B: Complete Transaction Lifecycle ──────────────── */}
        <SectionBLifecycle />

        {/* ── Section C: CometBFT Consensus Visualization ────────────── */}
        <SectionCConsensus />

        {/* ── Section D: Validator Voting Power Simulator ────────────── */}
        <SectionDVotingPower />

        {/* ── Section E: Staking & EVM Precompile ─────────────────────── */}
        <SectionEStakingPrecompile />

        {/* ── Section F: Punishments & Slashing ──────────────────────── */}
        <SectionFSlashing />

        {/* ── Section G: Full Architecture Diagram ──────────────────── */}
        <SectionGFullArchitecture />
      </div>
    </div>
  );
}

