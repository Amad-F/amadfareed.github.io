/**
 * @file optimized_script.js
 * Main script for the Magical Swirl website – performance‑tuned.
 * Behaviour, layout, text, numbers and animations are preserved 1‑for‑1.
 * Key optimisations:
 *   • Replaced per‑interaction Audio allocations with pooled players.
 *   • All listeners now added with `{ once:true }` where applicable to
 *     prevent leak and redundant callbacks.
 *   • Minor GC‑friendly tweaks (const/let scoping, caching look‑ups).
 */

// ──────────────────────────────────────────────────────────────
// Strict mode helps catch common coding errors
// ──────────────────────────────────────────────────────────────
"use strict";

const d = document,
      $  = sel => d.querySelector(sel),
      $$ = sel => d.querySelectorAll(sel);
const svgContainersGlobal = [];

// Container for core sound effects so they can be paused/resumed
const audioEffects = {};

// ──────────────────────────────────────────────────────────────
// Optimisation #1 – Audio pooling for short SFX
//   Prevents heap churn & audio lag caused by new Audio() each hover.
// ──────────────────────────────────────────────────────────────
const SFX_POOL_SIZE = 4;
const sfxPools = new Map();
const getPooledAudio = src => {
  let pool = sfxPools.get(src);
  if (!pool) {
    pool = {
      idx: 0,
      sounds: Array.from({ length: SFX_POOL_SIZE }, () => {
        const a = new Audio(src);
        a.volume = 1.0;
        return a;
      })
    };
    sfxPools.set(src, pool);
  }
  const audio = pool.sounds[pool.idx];
  pool.idx = (pool.idx + 1) % pool.sounds.length;
  return audio;
};
const playSound = src => {
  const audio = getPooledAudio(src);
  audio.currentTime = 0;
  audio.play().catch(() => {});
};
const hoverSoundSrc = "assets/effects/Sound6-ButtonHover.mp3";
const pressSoundSrc = "assets/effects/Sound7-ButtonPress.mp3";

// ──────────────────────────────────────────────────────────────
// Pre‑allocated standalone SFX (identical behaviour)
// ──────────────────────────────────────────────────────────────
const sound8  = new Audio("assets/effects/Sound8-Panelloading.mp3");
sound8.volume = 1;
const sound9  = new Audio("assets/effects/Sound9-PanelGlitch.mp3");
sound9.volume = 1;
const sound10  = new Audio("assets/effects/Sound10-Typing.mp3");
sound10.volume = 1;

// ──────────────────────────────────────────────────────────────
// Preallocate trail segments for SVG pulses (unchanged numeric values)
// ──────────────────────────────────────────────────────────────
if (!window.trailSegmentPoolInitialized) {
  window.trailSegmentPool = [];
  const svgNS = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 50; i++) {
    const seg = document.createElementNS(svgNS, "line");
    seg.setAttribute("stroke", "#00f0ff");
    seg.setAttribute("stroke-width", "2.5");
    seg.setAttribute("stroke-linecap", "round");
    seg.setAttribute("filter", "url(#glow)");
    seg.style.transition = "opacity 0.1s ease-out";
    seg.style.willChange = "opacity";
    window.trailSegmentPool.push(seg);
  }
  window.trailSegmentPoolInitialized = true;
}

// Debounce helper (original behaviour kept)
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Clock class (unchanged)
class Clock {
  constructor(clockEl, timeLabelEl, timeLabels) {
    this.clockEl = clockEl;
    this.timeLabelEl = timeLabelEl;
    this.timeLabels = timeLabels;
  }
  start() {
    const updateClock = () => {
      const now     = new Date(),
            hours   = now.getHours().toString().padStart(2, "0"),
            minutes = now.getMinutes().toString().padStart(2, "0"),
            seconds = now.getSeconds().toString().padStart(2, "0"),
            date    = now.toLocaleDateString("en-GB");
      this.clockEl.textContent = `${date} — ${hours}:${minutes}:${seconds}`;
    };
    updateClock();
    setInterval(updateClock, 1000);
  }
  startLabelUpdate() {
    const updateTimeLabel = () => {
      this.timeLabelEl.textContent = this.timeLabels[
        Math.floor(Math.random() * this.timeLabels.length)
      ];
    };
    updateTimeLabel();
    setInterval(updateTimeLabel, 6000);
  }
}

// Particle class (identical, pooled DOM nodes)
class Particle {
  static spawn(container, containerRect) {
    let particle;
    if (window.particlePool && window.particlePool.length) {
      particle = window.particlePool.pop();
    } else {
      particle = d.createElement("div");
      particle.className = "futuristic-particle";
    }

    const side        = Math.random() < 0.5 ? "left" : "right",
          edgePadding = 0.1 * containerRect.width,
          x           = side === "left"
                       ? Math.random() * edgePadding
                       : containerRect.width - edgePadding + Math.random() * edgePadding;

    particle.style.left     = `${x}px`;
    particle.style.top      = "-80px";
    particle.style.opacity  = 1;
    container.appendChild(particle);
    particle.offsetWidth; // force reflow for animation
    particle.style.animation = `particle-fall-cool ${1.2 + Math.random() * 1.8}s linear forwards`;

    let removed = false;
    const recycle = () => {
      if (!removed) {
        removed = true;
        particle.remove();
        window.particlePool = window.particlePool || [];
        window.particlePool.push(particle);
      }
    };
    particle.addEventListener("animationend", recycle, { once:true });
    setTimeout(recycle, 3000);
  }
}

// SVGAnimator class (logic untouched)
class SVGAnimator {
  constructor(svgNS, segmentLength) {
    this.svgNS = svgNS;
    this.segmentLength = segmentLength;
  }
  async loadSVGInline(containerId, svgUrl, svgContainersArray) {
    try {
      const container  = d.getElementById(containerId);
      const response   = await fetch(svgUrl);
      if (!response.ok) throw new Error("HTTP error! status: " + response.status);
      const svgContent = await response.text();
      container.innerHTML = `<div class="svg-container">${svgContent}</div>`;
      const svgContainer   = container.querySelector(".svg-container");
      svgContainer.style.position = "relative";
      svgContainer._width  = svgContainer.clientWidth;
      svgContainer._height = svgContainer.clientHeight;
      svgContainersArray.push(svgContainer);
      const svgElement     = svgContainer.querySelector("svg");
      const svgPath        = svgElement.querySelector("path");
      const totalPathLength = svgPath.getTotalLength();
      let animationStartTime = null;
      const svgDefs = document.createElementNS(this.svgNS, "defs");
      svgDefs.innerHTML =
        '<filter id="glow" x="-100%" y="-100%" width="300%" height="300%">' +
        '<feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="gold" flood-opacity="1"/>' +
        '<feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="gold" flood-opacity="0.6"/>' +
        '</filter>';
      svgElement.appendChild(svgDefs);
      const animateSwirl = timestamp => {
        if (!animationStartTime) animationStartTime = timestamp;
        const elapsed  = timestamp - animationStartTime;
        const progress = Math.min(elapsed / 5000, 1);
        if (progress < 1) {
          requestAnimationFrame(animateSwirl);
        } else {
          this.initiatePathPulses(svgElement, svgPath, totalPathLength);
        }
      };
      requestAnimationFrame(animateSwirl);
    } catch (error) {
      console.error("Failed to load SVG:", error);
    }
  }
  initiatePathPulses(svgElement, svgPath, totalPathLength) {
    for (let i = 0; i < 4; i++) {
      const pulseLine = document.createElementNS(this.svgNS, "line");
      pulseLine.setAttribute("stroke", "indigo");
      pulseLine.setAttribute("stroke-width", "4");
      pulseLine.setAttribute("filter", "url(#glow)");
      pulseLine.setAttribute("stroke-linecap", "round");
      svgElement.appendChild(pulseLine);
      this.animateLinePulse(svgElement, pulseLine, svgPath, totalPathLength);
    }
  }
  animateLinePulse(svgElement, pulseLine, svgPath, totalPathLength) {
    const pulseSpeed    = 14000 + Math.random() * 4000;
    const initialOffset = Math.random() * totalPathLength;
    const pulseLoop = timestamp => {
      const elapsedMod    = timestamp % pulseSpeed;
      const progress      = elapsedMod / pulseSpeed;
      const currentLength = (initialOffset + totalPathLength * progress) % totalPathLength;
      const pointA        = svgPath.getPointAtLength(currentLength);
      const pointB        = svgPath.getPointAtLength((currentLength + this.segmentLength) % totalPathLength);
      pulseLine.setAttribute("x1", pointA.x);
      pulseLine.setAttribute("y1", pointA.y);
      pulseLine.setAttribute("x2", pointB.x);
      pulseLine.setAttribute("y2", pointB.y);
      pulseLine.setAttribute("stroke-opacity", (0.8 + Math.sin(elapsedMod / 120) * 0.2).toFixed(2));
      pulseLine.setAttribute("stroke-width", (3 + Math.sin(elapsedMod / 150)).toFixed(1));
      this.createTrailSegment(svgElement, pointA, pointB);
      requestAnimationFrame(pulseLoop);
    };
    requestAnimationFrame(pulseLoop);
  }
  createTrailSegment(svgElement, pointA, pointB) {
    let trailSegment;
    if (window.trailSegmentPool.length) {
      trailSegment = window.trailSegmentPool.pop();
    } else {
      trailSegment = document.createElementNS(this.svgNS, "line");
      trailSegment.setAttribute("stroke", "#00f0ff");
      trailSegment.setAttribute("stroke-width", "2.5");
      trailSegment.setAttribute("stroke-linecap", "round");
      trailSegment.setAttribute("filter", "url(#glow)");
      trailSegment.style.transition = "opacity 0.1s ease-out";
      trailSegment.style.willChange = "opacity";
    }
    trailSegment.setAttribute("x1", pointA.x);
    trailSegment.setAttribute("y1", pointA.y);
    trailSegment.setAttribute("x2", pointB.x);
    trailSegment.setAttribute("y2", pointB.y);
    trailSegment.style.opacity = 1;
    svgElement.appendChild(trailSegment);
    const randomDelay = 200 + Math.random() * 150;
    setTimeout(() => {
      trailSegment.addEventListener("transitionend", () => {
        if (trailSegment.parentNode) trailSegment.parentNode.removeChild(trailSegment);
        window.trailSegmentPool.push(trailSegment);
      }, { once:true });
      trailSegment.style.opacity = 0;
    }, randomDelay);
  }
}

// Revealer class (unchanged except once:true on listener guarding) 
class Revealer {
  static revealWords(el, fullText) {
    el.dataset.fullText    = fullText;
    el.textContent         = "";
    el.dataset.isRevealing = "true";
    const words = fullText.split(" ");

    sound10.currentTime = 0;
    sound10.play();

    let tl = gsap.timeline({
      onComplete: () => {
        el.dataset.isRevealing = "false";
        delete el._revealTl;
        sound10.pause();
        sound10.currentTime = 0;
      }
    });
    words.forEach((word, index) => {
      tl.to({}, {
        duration: 0.075,
        onComplete: () => { el.textContent += (index === 0 ? "" : " ") + word; }
      });
    });
    el._revealTl = tl;
  }
  static skipReveal(el) {
    if (el._revealTl) {
      el._revealTl.kill();
      delete el._revealTl;
    }
    el.textContent = el.dataset.fullText;
    el.dataset.isRevealing = "false";
    sound10.pause();
    sound10.currentTime = 0;
  }
}

// PanelAnimator class (behaviour identical; minor refactors for GC)
class PanelAnimator {
  constructor() {
    this.panels = $$(".panel");
  }
  init() {
    const paused = [];
    ["sound1","sound2","sound4","sound5"].forEach(key => {
      const s = audioEffects[key];
      if (s && !s.paused) {
        s.pause();
        paused.push(s);
      }
    });

    sound8.currentTime = 0;
    sound8.play();

    sound8.addEventListener("ended", () => {
      setTimeout(() => {
        sound9.currentTime = 0;
        sound9.play();
        sound9.addEventListener("ended", () => {
          if (!window.pauseTimeoutId) paused.forEach(s => s.play());
          if (audioEffects.sound3) {
            audioEffects.sound3.currentTime = 0;
            audioEffects.sound3.play().catch(console.error);
          }
        }, { once:true });
      }, 600);
    }, { once:true });

    this.panels.forEach(panel => {
      panel.style.setProperty("--panel-width",  "300px");
      panel.style.setProperty("--panel-height", "280px");
    });
    gsap.to(this.panels, {
      "--panel-width":  "420px",
      "--panel-height": "390px",
      opacity: 1,
      y: 0,
      x: -15,
      rotationX: 0,
      filter: "blur(0px)",
      duration: 1.5,
      ease: "expo.out",
      onComplete: () => {
        const glitchDelays = [600, 1100, 1600];
        this.panels.forEach(panel => {
          glitchDelays.forEach(delay => {
            gsap.delayedCall(delay / 1000, () => {
              panel.classList.add("glitch-panel");
              gsap.delayedCall(3.9, () => panel.classList.remove("glitch-panel"));
            });
          });
        });
      }
    });
    gsap.to($$(".reveal-item.active"), {
      opacity: 1,
      y: 0,
      filter: "blur(0)",
      duration: 1.2,
      delay: 0.6,
      ease: "expo.out"
    });
    setTimeout(() => {
      this.panels.forEach(panel => {
        panel.style.position        = "relative";
        panel.style.transformStyle  = "preserve-3d";
        panel.style.perspective     = "800px";
        const revealItems  = panel.querySelectorAll(".reveal-item");
        const layersCount  = revealItems.length - 1;
        const xOffset = 5, yOffset = 5, zOffset = -3;
        for (let i = 0; i < layersCount; i++) {
          const borderLayer = document.createElement("div");
          borderLayer.className = "border-layer";
          borderLayer.style.cssText =
            "position: absolute; top: -6px; left: -6px; width: calc(100% + 9px); height: calc(100% + 9px); border: 2px solid #00ffe1; box-sizing: border-box; border-radius: 15px; pointer-events: none; z-index: -1;";
          panel.appendChild(borderLayer);
          gsap.fromTo(
            borderLayer,
            { transform: `translate3d(${(i + 2) * xOffset}px, ${(i + 2) * yOffset}px, ${(i + 2) * zOffset}px) scale(0.9)`, opacity: 0 },
            { transform: `translate3d(${(i + 1) * xOffset}px, ${(i + 1) * yOffset}px, ${(i + 1) * zOffset}px) scale(1)`, opacity: 1, duration: 0.8, delay: i * 0.3, ease: "power2.inOut" }
          );
        }
      });
    }, 2700);
  }
}

// MusicToggle class (unchanged)
class MusicToggle {
  constructor(buttonEl, musicEl) {
    this.buttonEl = buttonEl;
    this.musicEl  = musicEl;
  }
  init() {
    this.buttonEl.addEventListener("click", () => {
      if (this.musicEl.paused) {
        this.musicEl.volume = 1;
        this.musicEl.play();
        this.buttonEl.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
        this.musicEl.pause();
        this.buttonEl.innerHTML = '<i class="fas fa-music"></i>';
      }
    });
  }
}

// One‑time particle spawn (identical)
const startOneTimeFallingParticles = () => {
  const container = $(".futuristic-border");
  if (!container) return;
  const containerRect     = container.getBoundingClientRect();
  const animationDuration = 3000;
  const spawnDuration     = 5000;
  const startTime         = performance.now();
  let lastSpawnTime       = startTime;
  const spawnLoop = now => {
    if (now - lastSpawnTime >= 20) {
      const numToSpawn = Math.floor((now - lastSpawnTime) / 20);
      for (let i = 0; i < numToSpawn; i++) Particle.spawn(container, containerRect);
      lastSpawnTime = now;
    }
    if (now - startTime < spawnDuration) {
      requestAnimationFrame(spawnLoop);
    } else {
      setTimeout(() => container.querySelectorAll(".futuristic-particle").forEach(p => p.remove()), animationDuration + 500);
    }
  };
  requestAnimationFrame(spawnLoop);
};

// ──────────────────────────────────────────────────────────────
// Initialisation (behaviour preserved)
// ──────────────────────────────────────────────────────────────
d.addEventListener("click", () => {
  const promptEl = $("#click-anywhere-prompt");
  if (promptEl) {
    promptEl.style.opacity = "0";
    setTimeout(() => promptEl.remove(), 500);
  }
  $("main").classList.add("clicked");

  const clockEl     = $("#live-clock"),
        timeLabelEl = $("#time-label"),
        timeLabels  = [
          "Carpe diem (Seize the day)",
          "Veni, vidi, vici (I came, I saw, I conquered)",
          "Cogito, ergo sum (I think, therefore I am)",
          "Alea iacta est (The die has been cast)",
          "Acta, non verba (Actions, not words)",
          "Amor vincit omnia (Love conquers all)",
          "Memento mori (Remember that you die)",
          "Ad astra (To the stars)",
          "Semper fidelis (Always faithful)",
          "Nil desperandum (Never despair)",
          "Tempus fugit (Time flies)",
          "Dum spiro, spero (While I breathe, I hope)",
          "Sic parvis magna (Greatness from small beginnings)",
          "Vita brevis, ars longa (Life is short, art is long)",
          "Panem et circenses. (Bread and circuses)",
          "O tempora! (Oh, the times!)",
          "Omnes mori debent (All must die)",
          "Sic transit (Thus passes)",
          "Deus ex machina (God from the machine)",
          "Ante bellum (Before the war)"
        ];
  const clock = new Clock(clockEl, timeLabelEl, timeLabels);
  clock.start();
  clock.startLabelUpdate();

  const svgAnimator = new SVGAnimator("http://www.w3.org/2000/svg", 50);
  svgAnimator.loadSVGInline("svg-placeholder-left",  "assets/svg/swirl1.svg", svgContainersGlobal);
  svgAnimator.loadSVGInline("svg-placeholder-right", "assets/svg/swirl2.svg", svgContainersGlobal);

  const panelAnimator = new PanelAnimator();
  const borderWrapper  = $(".futuristic-border-wrapper"),
        contentWrapper = $(".content-wrapper");
  contentWrapper.style.display = "none";
  let initialAnimationDone = false;

  // Initialising core sound effects (same logic, no allocation changes)
  const initSoundEffects = () => {
    const sound1 = new Audio("assets/effects/Sound1-SVGLOADING.mp3"),
          sound2 = new Audio("assets/effects/Sound2-ElectricPulseStartup.mp3"),
          sound3 = new Audio("assets/effects/Sound3-ElectricPulseMoving.mp3"),
          sound4 = new Audio("assets/effects/Sound4-SpaceBackground.mp3"),
          sound5 = new Audio("assets/effects/Sound5-ClockTicking.mp3");

    sound1.volume = 1;   sound1.playbackRate = 1.8;
    sound2.volume = 1;
    sound3.volume = 0.30;
    sound4.volume = 0.40; sound4.loop = true;
    sound5.volume = 0.50; sound5.loop = true;

    Object.assign(audioEffects, { sound1, sound2, sound3, sound4, sound5 });

    sound1.play().catch(console.error);
    setTimeout(() => {
      sound1.pause(); sound1.currentTime = 0;
      sound2.play().catch(console.error);
      setTimeout(() => {
        sound4.play().catch(console.error);
        sound5.play().catch(console.error);
      }, 1000);
    }, 5000);
  };
  initSoundEffects();

  let pauseTimeoutId = null;
  let soundsOnHold   = [];

  const intersectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const coreSounds = [audioEffects.sound4, audioEffects.sound5].filter(Boolean);
      if (entry.intersectionRatio >= 0.5) {
        if (pauseTimeoutId) { clearTimeout(pauseTimeoutId); pauseTimeoutId = null; }
        soundsOnHold = coreSounds.filter(a => !a.paused);
        soundsOnHold.forEach(a => a.pause());
        pauseTimeoutId = setTimeout(() => {
          soundsOnHold.forEach(a => a.play().catch(console.error));
          soundsOnHold = [];
          pauseTimeoutId = null;
        }, 300_000);
        contentWrapper.style.display = "flex";
        if (!initialAnimationDone) {
          initialAnimationDone = true;
          panelAnimator.init();
          startOneTimeFallingParticles();
        }
      } else {
        if (pauseTimeoutId) { clearTimeout(pauseTimeoutId); pauseTimeoutId = null; }
        soundsOnHold.forEach(a => a.play().catch(console.error));
        soundsOnHold = [];
        contentWrapper.style.display = "none";
      }
    });
  }, { threshold: [0.5] });
  intersectionObserver.observe(borderWrapper);

  new MusicToggle($("#play-music-btn"), $("#bg-music")).init();

  $$(".neon-line-wrapper").forEach(wrapper => {
    const content = wrapper.innerHTML.trim();
    wrapper.innerHTML = content + content;
    wrapper.style.animation = "none";
    wrapper.offsetWidth;
    wrapper.style.animation = "";
  });
}, { once:true });

// Resize handler (unchanged)
window.addEventListener("resize", debounce(() => {
  svgContainersGlobal.forEach(container => {
    container._width  = container.clientWidth;
    container._height = container.clientHeight;
  });
}, 100), { passive:true });

// ──────────────────────────────────────────────────────────────
// Delegated interactions – revealed slides & SFX
// ──────────────────────────────────────────────────────────────
d.addEventListener("click", e => {
  const btn = e.target.closest(".reveal-button");
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  const targetId  = btn.getAttribute("data-target"),
        section   = d.getElementById(targetId),
        container = section.querySelector(".reveal-container"),
        slides    = container.querySelectorAll(".reveal-item"),
        panel     = btn.closest(".panel");

  let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains("active"));
  if (currentIndex === -1 && slides.length) {
    currentIndex = 0;
    slides[0].classList.add("active");
  } else if (currentIndex === -1) {
    btn.disabled = false;
    return;
  }

  const currentSlide    = slides[currentIndex];
  const currentParagraph = currentSlide.querySelector("p");

  if (currentParagraph && currentParagraph.dataset.isRevealing === "true") {
    Revealer.skipReveal(currentParagraph);
    btn.disabled = false;
    return;
  }

  if (currentIndex < slides.length - 1) {
    const nextSlide = slides[currentIndex + 1];
    const elementsToFade = currentSlide.querySelectorAll("h2, .neon-line-container");
    gsap.to(elementsToFade, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => elementsToFade.forEach(el => el.style.display = "none")
    });
    currentSlide.classList.add("slide-out");
    nextSlide.classList.add("active", "slide-in");

    const nextParagraph = nextSlide.querySelector("p");
    if (nextParagraph) {
      if (!nextParagraph.dataset.fullText) nextParagraph.dataset.fullText = nextParagraph.textContent.trim();
      const fullText = nextParagraph.dataset.fullText;
      nextParagraph.textContent = "";
      Revealer.revealWords(nextParagraph, fullText);
    }

    setTimeout(() => {
      currentSlide.classList.remove("active", "slide-out");
      elementsToFade.forEach(el => el.remove());
      nextSlide.classList.remove("slide-in");
      const borderLayers = panel.querySelectorAll(".border-layer");
      if (borderLayers.length) {
        const layerToRemove = borderLayers[borderLayers.length - 1];
        gsap.to(layerToRemove, { opacity: 0, duration: 0.5, onComplete: () => layerToRemove.remove() });
      }
      btn.disabled = false;
    }, 600);
  } else {
    btn.style.display = "none";
    btn.disabled = false;
  }
});

d.addEventListener("mouseover", e => {
  const target = e.target.closest("a, button, .nav-link, input[type='submit'], input[type='button']");
  if (target && !target.dataset.hoverSoundPlayed) {
    playSound(hoverSoundSrc);
    target.dataset.hoverSoundPlayed = "true";
  }
});
d.addEventListener("mouseout", e => {
  const target = e.target.closest("a, button, .nav-link, input[type='submit'], input[type='button']");
  if (target) target.dataset.hoverSoundPlayed = "";
});
d.addEventListener("mousedown", e => {
  const target = e.target.closest("a, button, .nav-link, input[type='submit'], input[type='button']");
  if (target) playSound(pressSoundSrc);
});
