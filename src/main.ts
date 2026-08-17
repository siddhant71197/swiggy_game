/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BOOT — and the one place the whole flow is written down.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: scenes that navigate to each other. Once a
 * splash screen knows the name of the level-select screen, the flow lives in
 * seven files and no one of them contains it. Adding a screen then means
 * finding every scene that should now route somewhere else, and missing one.
 *
 * So scenes here take CALLBACKS and navigate nothing. The graph below is the
 * entire flow of the game, and adding a screen is a change to this block and
 * to nothing else.
 *
 * ─── THE AD RULE ───────────────────────────────────────────────────────────
 *
 * The banner's visibility is one derived expression in the render callback,
 * evaluated once per frame from OUTSIDE every scene. A scene that shows and
 * hides the banner itself is a scene that gets it wrong on the one transition
 * nobody tested — and the transition nobody tests is always death-into-pause.
 */

import { COLORS, SAVE_KEY } from './brand';
import { GameLoop } from './core/loop';
import { levelCount } from './game/level';
import { loadGame, saveGame } from './core/storage';
import { Controls } from './input/controls';
import { createViewport } from './render/canvas';
import { loadBrandAssets } from './render/mark';
import { DeliveredScene } from './scenes/delivered';
import { Director } from './scenes/director';
import { GameOverScene } from './scenes/gameOver';
import { LevelSelectScene } from './scenes/levelSelect';
import { PlayScene } from './scenes/play';
import { RulesScene } from './scenes/rules';
import { SplashScene } from './scenes/splash';
import { initAdSlot, setAdVisible } from './ui/adSlot';
import { cancelHaptics, setHapticsEnabled } from './ui/haptics';
import { Sfx } from './ui/sfx';

// The render-foundation harness. Dynamically imported behind the guard so a
// normal boot never downloads or parses it.
if (new URLSearchParams(location.search).get('dev') === 'mark') {
  void import('./render/__devMark').then((m) => m.mountMarkTest());
} else {
  void boot();
}

async function boot(): Promise<void> {
  const save = loadGame(SAVE_KEY);
  const persist = (): void => saveGame(SAVE_KEY, save);

  // BEFORE THE FIRST FRAME, and never skipped as an optimisation.
  //
  // Without this the splash paints on frame one with no artwork decoded, so
  // every mark on screen comes from the vector fallback — which is a tier that
  // exists for a cold connection, not for the common case. It never rejects: a
  // failed decode leaves the fallback in place rather than leaving a frame with
  // no mark on it at all.
  await loadBrandAssets();

  const vp = createViewport('game', 'phone');
  // After the DOM exists, before the first frame: scenes lay out against the
  // space it reserves, so a slot that appears late reflows the first screen.
  initAdSlot();

  const sfx = new Sfx(save, persist);
  setHapticsEnabled(!save.muted);

  const controls = new Controls(vp);
  controls.attach(vp.canvas);
  controls.layout(vp.fieldW);
  vp.onResize((v) => controls.layout(v.fieldW));

  const director = new Director(vp);
  controls.onPointer = (k, id, x, y, t) => director.onPointer(k, id, x, y, t);
  // The AudioContext must be born inside a gesture or it starts suspended and
  // the first sound of the game is silently swallowed.
  controls.onFirstGesture = () => sfx.unlock();
  controls.onMute = () => {
    const muted = sfx.toggleMute();
    setHapticsEnabled(!muted);
  };

  // ── The flow ──────────────────────────────────────────────────────────────

  /**
   * Totals for the completion receipt, accumulated across a run.
   *
   * Here rather than in the session, because a session is one LEVEL and these
   * are the whole run — and here rather than in the save file, because a run is
   * not progress: closing the tab should not leave half a run's rakhis waiting
   * to be added to the next one.
   */
  let run = freshRun();

  function freshRun(): {
    levels: number;
    rakhis: number;
    /** The CURRENT no-death run of levels. Reset by any level with a death. */
    streak: number;
    /** The best `streak` reached this run — what the receipt actually reports. */
    bestStreak: number;
    perfect: number;
    score: number;
  } {
    return { levels: 0, rakhis: 0, streak: 0, bestStreak: 0, perfect: 0, score: 0 };
  }

  /**
   * Where PLAY goes.
   *
   * The `>=` case is not a rounding detail. With `bestLevel` at the last level,
   * `bestLevel + 1` is level 11, which `levelParams` clamps back to 10 — so a
   * player who finished the game would press PLAY and be handed the finale
   * again, forever, with no way back to the start except clearing their
   * storage. Finishing hands you a fresh run instead.
   */
  function nextUp(): number {
    return save.bestLevel >= levelCount() ? 1 : Math.max(1, save.bestLevel + 1);
  }

  const splash: SplashScene = new SplashScene(vp, {
    onPlay: () => {
      if (nextUp() === 1) run = freshRun();
      return save.seenRules ? startLevel(nextUp()) : director.go(rules);
    },
    onLevels: () =>
      director.go(levelSelect, { bestLevel: save.bestLevel, levelBest: save.levelBest }),
    onRules: () => director.go(rules),
  });

  const rules: RulesScene = new RulesScene(vp, {
    // The once-only gate lives HERE, not inside the scene. A scene that decides
    // whether it should have been shown is a scene that has to know why it was
    // opened, and it is opened from two places.
    onSeen: () => {
      const firstRun = !save.seenRules;
      save.seenRules = true;
      persist();
      if (firstRun) startLevel(nextUp());
      else director.go(splash, { best: save.highScore });
    },
  });

  const levelSelect: LevelSelectScene = new LevelSelectScene(vp, {
    onPick: (level: number) => startLevel(level),
    onBack: () => director.go(splash, { best: save.highScore }),
  });

  // The play scene is the one scene that READS input rather than being handed
  // pointers, and the one that makes sounds the sim asked for. Both are owned
  // here, so both are injected — a scene reaching for a module-level singleton
  // is a scene that cannot be driven by the headless harness.
  const play: PlayScene = new PlayScene(vp, controls, sfx, {
    // The receipt is passed through WHOLE. main.ts reads the two fields it
    // persists and forwards the rest untouched — picking fields out here is how
    // the results screen ended up rendering zeros for every line it did not
    // happen to be handed.
    onDelivered: (summary) => {
      // Accumulate BEFORE the payload is built, so the completion receipt counts
      // the level that just finished rather than every level but the last.
      run.levels += 1;
      run.rakhis += summary.rakhis;
      run.score = summary.score;
      if (summary.perfect) {
        run.perfect += 1;
        run.streak += 1;
      } else {
        run.streak = 0;
      }
      run.bestStreak = Math.max(run.bestStreak, run.streak);

      save.bestLevel = Math.max(save.bestLevel, summary.level);
      save.levelBest[summary.level] = Math.max(
        save.levelBest[summary.level] ?? 0,
        summary.score,
      );
      save.highScore = Math.max(save.highScore, summary.score);
      persist();
      director.go(delivered, {
        ...summary,
        // The last level ends the RUN, not just the round — the receipt becomes
        // the completion tableau rather than offering an eleventh order.
        final: summary.level >= levelCount(),
        totals: {
          levels: run.levels,
          rakhis: run.rakhis,
          streak: run.bestStreak,
          perfect: run.perfect,
          score: run.score,
        },
      });
    },
    onGameOver: (level: number, score: number) => {
      save.highScore = Math.max(save.highScore, score);
      persist();
      director.go(gameOver, { score, best: save.highScore, level });
    },
    onQuit: () => director.go(splash, { best: save.highScore }),
  });

  const delivered: DeliveredScene = new DeliveredScene(vp, {
    onNext: (level: number) => startLevel(level),
    // On the completion screen this is PHIR SE, so it starts a whole new run
    // rather than dropping the player on a splash whose PLAY would do the same
    // thing one tap later.
    onHome: () => {
      run = freshRun();
      director.go(splash, { best: save.highScore });
    },
  });

  const gameOver: GameOverScene = new GameOverScene(vp, {
    onRetry: (level: number) => startLevel(level),
    onHome: () => director.go(splash, { best: save.highScore }),
  });

  function startLevel(level: number): void {
    // Held input and a buzzing phone both survive a scene change otherwise, and
    // a run that begins with the d-pad still pressed begins with the agent
    // already walking into the first barrel.
    controls.reset();
    cancelHaptics();
    director.go(play, { level: Math.max(1, level) });
  }

  controls.onPause = () => {
    if (director.scene !== play) return;
    if (play.state === 'paused') play.resume();
    else play.pause();
  };

  // ── Platform lifecycle ────────────────────────────────────────────────────

  // An ad unit gets backgrounded constantly — a notification, a glance at the
  // clock. Pausing on hide freezes the delivery timer; without it the player
  // comes back to a lost round they never saw.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && director.scene === play) play.pause();
    else if (!document.hidden) loop.resync();
  });

  // Android's back button. Pushing a state on boot means back lands here rather
  // than leaving the page, and re-pushing keeps the trap armed.
  history.pushState({ game: true }, '');
  window.addEventListener('popstate', () => {
    history.pushState({ game: true }, '');
    if (director.scene === play) play.pause();
    else if (director.scene !== splash) director.go(splash, { best: save.highScore });
  });

  const loop = new GameLoop({
    update: (dt: number) => {
      // Before the step, or a held key lags a frame behind the pad's own state.
      controls.pumpHeld();
      director.update(dt, loop.simTime);
    },
    render: (alpha: number) => {
      vp.begin();
      vp.clear(COLORS.appBg);
      director.render(vp.ctx, alpha, loop.simTime);
      vp.end();

      // ── THE TWO SCENE-DERIVED RULES. One caller, no edges to miss. ──
      //
      // Both answer "is a round actually being played right now", and both are
      // evaluated here rather than inside a scene for the same reason: a scene
      // that toggles them itself needs a call on every edge into and out of
      // eight states, and the one it misses is the one nobody tests.
      const scene = director.scene;
      const inPlay = scene instanceof PlayScene;
      setAdVisible(!(inPlay && scene.live));
      // Off the play scene the pad and jump button are not drawn, so they must
      // not claim taps either — otherwise the menus carry invisible dead zones
      // exactly where their buttons are.
      controls.gameplayInput = inPlay;
    },
    onQualityDrop: (level: number) => vp.setQuality(level),
  });

  // ?level=N BOOTS STRAIGHT INTO THE ROUND, so a bug report is a URL rather than
  // a sentence describing which buttons to press first. The clamp lives in
  // game/level.ts; asking for level 7 on a two-level build is a playable level.
  const deepLink = Number.parseInt(new URLSearchParams(location.search).get('level') ?? '', 10);
  if (Number.isFinite(deepLink) && deepLink > 0) {
    director.set(play, { level: deepLink });
  } else {
    director.set(splash, { best: save.highScore });
  }
  loop.start();
  document.getElementById('boot')?.classList.add('hidden');
}
