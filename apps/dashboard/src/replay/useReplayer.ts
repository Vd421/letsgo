// Drives rrweb's replay engine. rrweb rebuilds the recorded page inside an <iframe> (a mini
// browser) and re-applies every recorded change at the right moment. This hook starts it inside
// the box `mountRef` points at, and gives the page simple controls and the current time.
import type { eventWithTime } from "@rrweb/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Replayer } from "rrweb";

export function useReplayer(events: eventWithTime[] | null) {
  const mountRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const [time, setTime] = useState(0); // milliseconds into the visit
  const [total, setTotal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [skipIdle, setSkipIdleState] = useState(true);
  const [screen, setScreen] = useState({ width: 1280, height: 800 }); // the visitor's window size

  useEffect(() => {
    const mount = mountRef.current;
    if (!events || !mount) return;

    // The visitor's window size is in the first "meta" event (type 4).
    const meta = events.find((e) => e.type === 4)?.data as { width?: number; height?: number };
    if (meta?.width && meta?.height) setScreen({ width: meta.width, height: meta.height });

    const replayer = new Replayer(events, {
      root: mount,
      skipInactive: true, // fast-forward through long pauses
      showWarning: false,
      triggerFocus: false, // don't let the replayed page grab keyboard focus
      mouseTail: { strokeStyle: "rgba(141, 144, 247, 0.6)", lineWidth: 3, duration: 600 },
    });
    replayerRef.current = replayer;
    setTotal(replayer.getMetaData().totalTime);
    replayer.on("finish", () => setPlaying(false));
    replayer.on("resize", (size) => setScreen(size as { width: number; height: number }));
    replayer.play(0); // autoplay as soon as the page opens
    setPlaying(true);

    // Read the engine's clock on every screen refresh (~60 times a second).
    let frame = requestAnimationFrame(function tick() {
      setTime(replayer.getCurrentTime());
      frame = requestAnimationFrame(tick);
    });

    return () => {
      // Leaving the page (or opening another visit): stop everything and remove the iframe.
      cancelAnimationFrame(frame);
      replayer.pause();
      replayer.destroy();
      mount.innerHTML = "";
      replayerRef.current = null;
    };
  }, [events]);

  const seek = useCallback(
    (ms: number) => {
      const replayer = replayerRef.current;
      if (!replayer) return;
      const target = Math.max(0, Math.min(ms, total));
      if (playing) replayer.play(target);
      else replayer.pause(target);
      setTime(target);
    },
    [playing, total],
  );

  const toggle = useCallback(() => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) {
      replayer.pause();
      setPlaying(false);
    } else {
      // At the end? Start again from the beginning.
      replayer.play(time >= total - 50 ? 0 : replayer.getCurrentTime());
      setPlaying(true);
    }
  }, [playing, time, total]);

  const restart = useCallback(() => {
    replayerRef.current?.play(0);
    setPlaying(true);
  }, []);

  const setSpeed = useCallback((value: number) => {
    replayerRef.current?.setConfig({ speed: value });
    setSpeedState(value);
  }, []);

  const setSkipIdle = useCallback((value: boolean) => {
    replayerRef.current?.setConfig({ skipInactive: value });
    setSkipIdleState(value);
  }, []);

  return {
    mountRef,
    time: Math.min(time, total),
    total,
    playing,
    speed,
    skipIdle,
    screen,
    seek,
    toggle,
    restart,
    setSpeed,
    setSkipIdle,
  };
}

export type ReplayControls = ReturnType<typeof useReplayer>;
